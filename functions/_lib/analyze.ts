/**
 * ジャンル判定エンジン本体。
 * iTunes / Deezer / MusicBrainz（+ 任意で Last.fm）から証拠を集め、
 * タクソノミーで正規化して重み付きの信頼度を出す。
 */

import type {
  ConfidenceLevel,
  GenreEvidence,
  GenreJudgment,
  GenreScore,
  SourceName,
  TrackCandidate,
} from '../../shared/types';
import { SOURCE_LABELS } from '../../shared/types';
import {
  containsJapanese,
  normalize,
  normalizeText,
  normalizeTitle,
} from '../../shared/genre/normalize';
import {
  aggregateGenres,
  confidenceLevel,
  DEEZER_WEIGHT,
  ITUNES_WEIGHT,
  lastfmWeight,
  musicbrainzArtistWeight,
  musicbrainzRecordingWeight,
} from '../../shared/genre/score';
import { getGenre, relatedGenres } from '../../shared/genre/taxonomy';
import { buildSearchTerm, chooseStorefront, scoreMatch } from '../../shared/genre/title';
import { deezerAlbum, deezerSearchTracks, deezerTrack, type DeezerAlbum, type DeezerTrack } from './deezer';
import { envValue, type Env } from './env';
import { toErrorMessage } from './http';
import { itunesLookup, itunesSearch, type ItunesTrack } from './itunes';
import { lastfmTopTags } from './lastfm';
import { mbArtistGenres, mbRecordingTags, mbSearchRecording, type MbRecordingMatch, type MbTag } from './musicbrainz';
import { cached } from './cache';
import { deezerToCandidate, itunesToCandidate } from './candidates';
import { detectGameMusic, detectGameWork, type GameDetectionField } from './game-detect';

/** 検索結果のジャンルで補完したときの note。 */
const HINT_NOTE = '検索結果のジャンル情報から補完';

export interface AnalyzeInput {
  title: string;
  artist?: string;
  itunesId?: string;
  deezerId?: string;
  /** 検索結果が持っていたジャンル（iTunes がレート制限のときの補完に使う）。 */
  genreHint?: string;
}

export interface AnalyzeOutcome {
  judgment: GenreJudgment;
  warnings: string[];
}

interface ItunesData {
  track: ItunesTrack | null;
  score: number;
}

interface DeezerData {
  track: DeezerTrack | null;
  album: DeezerAlbum | null;
  genres: string[];
  score: number;
}

interface MusicBrainzData {
  match: MbRecordingMatch | null;
  artistGenres: MbTag[];
  artistTags: MbTag[];
  recordingGenres: MbTag[];
  recordingTags: MbTag[];
}

type Attempt<T> = { ok: true; value: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

/** iTunes の証拠を集める。itunesId があれば lookup、無ければ検索の最上位候補。 */
async function gatherItunes(input: AnalyzeInput, title: string, artist?: string): Promise<ItunesData> {
  if (input.itunesId) {
    // ID 指定の lookup が落ちても検索でリカバーする
    const track = await itunesLookup(input.itunesId).catch(() => null);
    if (track) return { track, score: 1 };
  }

  const term = buildSearchTerm(title, artist);
  const store = chooseStorefront(term);
  const pickBest = (results: ItunesTrack[]): ItunesData => {
    const scored = results
      .map((track) => ({
        track,
        score: scoreMatch(
          { title: track.trackName, artist: track.artistName, album: track.collectionName },
          { title, artist },
        ),
      }))
      .sort((a, b) => b.score - a.score);
    return scored[0] ?? { track: null, score: 0 };
  };

  const primary = pickBest(await itunesSearch(term, { country: store.primary, limit: 8 }));
  if (primary.track && primary.score >= 0.5) return primary;

  // 優先ストアで決め手が無ければもう一方のストアも見る
  const fallback = pickBest(await itunesSearch(term, { country: store.fallback, limit: 8 }));
  return fallback.score > primary.score ? fallback : primary;
}

/** Deezer の証拠を集める。トラック → アルバム詳細の genres。 */
async function gatherDeezer(input: AnalyzeInput, title: string, artist?: string): Promise<DeezerData> {
  let track: DeezerTrack | null = null;
  let score = 0;
  const language = containsJapanese(buildSearchTerm(title, artist)) ? 'ja' : 'en';

  if (input.deezerId) {
    track = await deezerTrack(input.deezerId, { language }).catch(() => null);
    if (track) score = 1;
  }
  if (!track) {
    const results = await deezerSearchTracks(buildSearchTerm(title, artist), 8, { language });
    const scored = results
      .map((candidate) => ({
        track: candidate,
        score: scoreMatch(
          {
            title: candidate.title,
            artist: candidate.artist?.name,
            album: candidate.album?.title,
          },
          { title, artist },
        ),
      }))
      .sort((a, b) => b.score - a.score);
    track = scored[0]?.track ?? null;
    score = scored[0]?.score ?? 0;
  }

  let album: DeezerAlbum | null = null;
  if (track?.album?.id) {
    // アルバム詳細が落ちてもトラック自体は使えるので、失敗は握りつぶす
    album = await deezerAlbum(track.album.id, { language }).catch(() => null);
  }
  const genres = (album?.genres?.data ?? []).map((genre) => genre.name).filter(Boolean);
  return { track, album, genres, score };
}

/** MusicBrainz の証拠を集める（内部で 1 req/sec に直列化される）。 */
async function gatherMusicBrainz(title: string, artist?: string): Promise<MusicBrainzData> {
  const match = await mbSearchRecording(title, artist);
  if (!match) {
    return { match: null, artistGenres: [], artistTags: [], recordingGenres: [], recordingTags: [] };
  }
  // アーティストのジャンルは同じアーティストの別曲でも使えるので長めにキャッシュする
  const artistInfo = match.artistId
    ? await cached(`mb-artist:${match.artistId}`, 86_400, () => mbArtistGenres(match.artistId!))
    : { genres: [], tags: [] };

  // MusicBrainz は 1 req/sec 制限があるため、アーティストのジャンルが十分に取れているときは
  // レコーディングのタグ取得を省略する（応答が 1〜1.2 秒短くなる）。
  const artistGenreVotes = artistInfo.genres.reduce((sum, tag) => sum + tag.count, 0);
  const needsRecordingInfo = artistInfo.genres.length < 3 || artistGenreVotes < 20;
  const recordingInfo = needsRecordingInfo
    ? await mbRecordingTags(match.recordingId)
    : { genres: [], tags: [] };
  return {
    match,
    artistGenres: artistInfo.genres,
    artistTags: artistInfo.tags,
    recordingGenres: recordingInfo.genres,
    recordingTags: recordingInfo.tags,
  };
}

function toEvidence(
  source: SourceName,
  raw: string,
  weight: number,
  note?: string,
): GenreEvidence {
  const normalized = normalize(raw);
  return {
    source,
    raw: raw.trim(),
    canonicalId: normalized?.id ?? null,
    weight: Math.round(weight * 1000) / 1000,
    ...(note ? { note } : {}),
  };
}

/**
 * iTunes に曲が見つかっている場合、表示中のトラックへ Apple Music の曲ページ URL を足す。
 * 検索結果のソースが Deezer でも、実ページへ直接飛べるようにするため。
 */
function withItunesLink(track: TrackCandidate, itunes: ItunesTrack | null): TrackCandidate {
  if (!itunes?.trackViewUrl) return track;
  const links = { ...(track.links ?? {}) };
  if (!links.itunes) links.itunes = itunes.trackViewUrl;
  return { ...track, links };
}

function pickTrack(
  input: AnalyzeInput,
  itunes: ItunesTrack | null,
  deezer: DeezerData | null,
  mb: MusicBrainzData | null,
  title: string,
  artist?: string,
): TrackCandidate {
  if (input.deezerId && deezer?.track) return deezerToCandidate(deezer.track);
  if (itunes) return itunesToCandidate(itunes);
  if (deezer?.track) return deezerToCandidate(deezer.track);
  if (mb?.match) {
    return {
      id: `musicbrainz:${mb.match.recordingId}`,
      title: mb.match.title ?? title,
      artist: mb.match.artistName ?? artist ?? '',
      durationMs: mb.match.length,
      source: 'musicbrainz',
      sourceId: mb.match.recordingId,
    };
  }
  return {
    id: `query:${normalizeText(title)}`,
    title,
    artist: artist ?? '',
    source: 'itunes',
    sourceId: '',
  };
}

function buildExplanation(primary: GenreScore | null, level: ConfidenceLevel): string {
  if (!primary) {
    return 'どの情報源からもジャンル情報が得られませんでした。曲名とアーティストを変えて、もう一度試してみてください。';
  }

  // ソースごとにラベルを集める（"Pop" と "ポップ" のように正規化後に同じものは1つにまとめる）
  const labelsBySource = new Map<SourceName, string[]>();
  for (const item of primary.evidence) {
    const labels = labelsBySource.get(item.source) ?? [];
    const key = normalizeText(item.raw);
    if (!labels.some((label) => normalizeText(label) === key)) labels.push(item.raw);
    labelsBySource.set(item.source, labels);
  }

  // 同じラベル群を持つソースはまとめて列挙する
  const groups = new Map<string, { sources: string[]; labels: string[] }>();
  for (const [source, labels] of labelsBySource) {
    const key = labels.map((label) => normalizeText(label)).join('|');
    const group = groups.get(key) ?? { sources: [], labels };
    group.sources.push(SOURCE_LABELS[source]);
    groups.set(key, group);
  }
  const clauses = [...groups.values()].map(
    (group) =>
      `${group.sources.join(' と ')} は${group.labels.map((label) => `「${label}」`).join('')}`,
  );
  // ゲーム音楽の検出だけが根拠のときは「手がかり」ベースの文にする
  const detectionNotes = primary.evidence
    .map((item) => item.note)
    .filter((note): note is string => Boolean(note && note.includes('に「')));
  if (detectionNotes.length === primary.evidence.length && detectionNotes.length > 0) {
    const clues = [...new Set(detectionNotes)];
    const label =
      primary.family.includes(primary.labelJa)
        ? primary.labelJa
        : `${primary.labelJa}（${primary.family}）`;
    const percent = Math.round(primary.confidence * 100);
    return `検出した手がかり（${clues.join('、')}）から、${label}と判断しました（一致度 ${percent}%）。`;
  }

  const basis = `${clauses.join('、')}と分類しています。`;
  // 「R&B（R&B・ソウル）」のような重複表記を避ける
  const label = primary.family.includes(primary.labelJa)
    ? primary.labelJa
    : `${primary.labelJa}（${primary.family}）`;
  const percent = Math.round(primary.confidence * 100);

  if (labelsBySource.size >= 2) {
    if (level === 'high') return `${basis}総合して${label}と判断しました（一致度 ${percent}%）。`;
    if (level === 'medium') {
      return `${basis}総合して${label}の可能性が高いと判断しました（一致度 ${percent}%）。`;
    }
    return `${basis}総合して${label}の可能性があります（一致度 ${percent}%）。`;
  }
  return `${basis}情報源が1つだけなので、${label}という判定は参考程度に受け取ってください（一致度 ${percent}%）。`;
}

function buildCaveats(options: {
  artist?: string;
  primary: GenreScore | null;
  level: ConfidenceLevel;
  itunesRaw?: string;
  itunesScore: number;
  mb: MusicBrainzData | null;
  failedSources: SourceName[];
}): string[] {
  const caveats: string[] = [];
  const { artist, primary, level, itunesRaw, itunesScore, mb, failedSources } = options;

  if (!artist) {
    caveats.push('アーティスト名が指定されていないため、同名の別曲と混同している可能性があります。');
  }

  if (itunesRaw) {
    const canonicalId = normalize(itunesRaw)?.id;
    const def = canonicalId ? getGenre(canonicalId) : undefined;
    if (def?.broad && primary && primary.id !== canonicalId) {
      caveats.push(`iTunes は「${itunesRaw}」としか分類していません。`);
    } else if (def?.broad && primary?.id === canonicalId) {
      caveats.push(
        `iTunes の「${itunesRaw}」は大まかな分類です。より細かいジャンルは特定できませんでした。`,
      );
    }
  }

  if (itunesScore > 0 && itunesScore < 0.5) {
    caveats.push('タイトルとアーティストに完全一致する曲が見つからず、近い曲の情報を使っています。');
  }

  if (mb && mb.artistGenres.length === 0 && mb.recordingTags.length === 0) {
    caveats.push('MusicBrainz にはこの曲・アーティストのジャンルタグが付いていません。');
  }

  if (!primary) {
    caveats.push('iTunes・Deezer・MusicBrainz のいずれからもジャンルを取得できませんでした。');
  } else if (level === 'low') {
    caveats.push('判定の根拠が薄いため、参考程度にしてください。');
  }

  if (failedSources.length > 0) {
    caveats.push(`${failedSources.map((source) => SOURCE_LABELS[source]).join('・')} に接続できませんでした。`);
  }
  return caveats;
}

/** ジャンル判定のメイン処理。 */
export async function analyzeTrack(input: AnalyzeInput, env?: Env): Promise<AnalyzeOutcome> {
  const title = input.title.trim();
  const artist = input.artist?.trim() || undefined;
  const warnings: string[] = [];
  const failedSources: SourceName[] = [];
  const lastfmKey = envValue(env, 'LASTFM_API_KEY');

  const [itunesAttempt, deezerAttempt, mbAttempt, lastfmAttempt] = await Promise.all([
    attempt(() => gatherItunes(input, title, artist)),
    attempt(() => gatherDeezer(input, title, artist)),
    attempt(() =>
      // 同じ曲を別経路（別バージョンの itunesId 等）で調べても MB を叩き直さない
      cached(
        // バージョン表記（Live / Remix 等）を除いた曲名でまとめる
        `mb-gather:${normalizeTitle(title)}|${normalizeText(artist ?? '')}`,
        86_400,
        () => gatherMusicBrainz(title, artist),
      ),
    ),
    artist && lastfmKey
      ? attempt(() => lastfmTopTags(lastfmKey, artist, title))
      : Promise.resolve({ ok: true as const, value: [] as MbTag[] }),
  ]);

  const itunes = itunesAttempt.ok ? itunesAttempt.value : null;
  const deezer = deezerAttempt.ok ? deezerAttempt.value : null;
  const mb = mbAttempt.ok ? mbAttempt.value : null;
  const lastfmTags = lastfmAttempt.ok ? lastfmAttempt.value : [];

  const recordFailure = (source: SourceName, message: string): void => {
    failedSources.push(source);
    warnings.push(`${SOURCE_LABELS[source]} から情報を取得できませんでした（${message}）。`);
  };
  if (!itunesAttempt.ok) recordFailure('itunes', itunesAttempt.error);
  if (!deezerAttempt.ok) recordFailure('deezer', deezerAttempt.error);
  if (!mbAttempt.ok) recordFailure('musicbrainz', mbAttempt.error);
  if (!lastfmAttempt.ok) recordFailure('lastfm', lastfmAttempt.error);

  /* ------------------------------- 証拠を組み立てる ------------------------------- */
  const evidence: GenreEvidence[] = [];
  if (itunes?.track?.primaryGenreName) {
    evidence.push(
      toEvidence('itunes', itunes.track.primaryGenreName, ITUNES_WEIGHT, 'iTunes の公式ジャンル分類'),
    );
  } else if (input.genreHint) {
    // iTunes が 429 などで落ちても、検索結果が持っていたジャンルで補完する
    evidence.push(toEvidence('itunes', input.genreHint, 0.6, HINT_NOTE));
  }
  // Deezer は 1 アルバムに複数ジャンルを返すことがあるため、合計が 0.75 になるよう分割する
  const deezerGenres = deezer?.genres ?? [];
  const deezerGenreWeight = deezerGenres.length > 0 ? DEEZER_WEIGHT / deezerGenres.length : 0;
  for (const genre of deezerGenres) {
    evidence.push(toEvidence('deezer', genre, deezerGenreWeight, 'Deezer のアルバムジャンル'));
  }
  for (const tag of mb?.artistGenres ?? []) {
    evidence.push(
      toEvidence(
        'musicbrainz',
        tag.name,
        musicbrainzArtistWeight(tag.count),
        `MusicBrainz のアーティストジャンル（投票数 ${tag.count}）`,
      ),
    );
  }
  for (const tag of mb?.recordingGenres ?? []) {
    evidence.push(
      toEvidence(
        'musicbrainz',
        tag.name,
        musicbrainzRecordingWeight(tag.count),
        `MusicBrainz のレコーディングジャンル（投票数 ${tag.count}）`,
      ),
    );
  }
  for (const tag of mb?.recordingTags ?? []) {
    evidence.push(
      toEvidence(
        'musicbrainz',
        tag.name,
        musicbrainzRecordingWeight(tag.count),
        `MusicBrainz のレコーディングタグ（投票数 ${tag.count}）`,
      ),
    );
  }
  for (const tag of lastfmTags) {
    evidence.push(
      toEvidence('lastfm', tag.name, lastfmWeight(tag.count), `Last.fm のタグ（${tag.count}票）`),
    );
  }

  /* ------------------- ゲーム音楽らしさの検出（曲名・アルバム名・タグ） ------------------- */
  const trackSource: SourceName =
    input.deezerId && deezer?.track
      ? 'deezer'
      : itunes?.track
        ? 'itunes'
        : deezer?.track
          ? 'deezer'
          : 'itunes';
  const detectionFields: GameDetectionField[] = [
    { label: '曲名', text: title, source: trackSource, scale: 1 },
    { label: 'アーティスト名', text: artist, source: trackSource, scale: 0.9 },
    { label: 'アルバム名', text: itunes?.track?.collectionName, source: 'itunes', scale: 1 },
    {
      label: 'アルバム名',
      text: deezer?.album?.title ?? deezer?.track?.album?.title,
      source: 'deezer',
      scale: 1,
    },
    { label: 'iTunesのジャンル', text: itunes?.track?.primaryGenreName, source: 'itunes', scale: 1 },
  ];
  for (const tag of mb?.artistTags ?? []) {
    detectionFields.push({ label: 'MusicBrainzのタグ', text: tag.name, source: 'musicbrainz', scale: 0.9 });
  }
  for (const tag of mb?.recordingTags ?? []) {
    detectionFields.push({ label: 'MusicBrainzのタグ', text: tag.name, source: 'musicbrainz', scale: 0.9 });
  }
  for (const tag of lastfmTags) {
    detectionFields.push({ label: 'Last.fmのタグ', text: tag.name, source: 'lastfm', scale: 0.9 });
  }
  const gameDetections = detectGameMusic(detectionFields);
  for (const detection of gameDetections) {
    evidence.push({
      source: detection.source,
      raw: getGenre(detection.canonicalId)?.labelEn ?? detection.raw,
      canonicalId: detection.canonicalId,
      weight: detection.weight,
      note: detection.note,
    });
  }
  // 細分類（チップチューン・東方など）だけ検出された場合も、ゲーム音楽の傘を薄く足す
  const gameSubgenreIds = new Set([
    'chiptune',
    'fm-synth',
    'game-orchestral',
    'rhythm-game',
    'touhou-arrange',
    'visual-novel',
  ]);
  const hasGameUmbrella = gameDetections.some((detection) => detection.canonicalId === 'game-music');
  const strongestSubgenre = gameDetections.find((detection) =>
    gameSubgenreIds.has(detection.canonicalId),
  );
  if (!hasGameUmbrella && strongestSubgenre) {
    evidence.push({
      source: strongestSubgenre.source,
      raw: getGenre('game-music')?.labelEn ?? 'Game Music',
      canonicalId: 'game-music',
      weight: 0.5,
      note: 'ゲーム音楽の細分類から推定',
    });
  }

  // ゲーム固有の強い手がかりは、coarse な大分類より優先して primary に昇格させる
  const priorityGameIds = [
    ...new Set(
      gameDetections
        .filter((detection) =>
          detection.canonicalId === 'game-music'
            ? detection.weight >= 0.6
            : gameSubgenreIds.has(detection.canonicalId) && detection.weight >= 0.6,
        )
        .map((detection) => detection.canonicalId),
    ),
  ];
  const { primary, others } = aggregateGenres(evidence, { priorityIds: priorityGameIds });
  // 検索結果のジャンルだけが根拠のときは参考程度に留める（自信ありげに見せない）
  const onlyHintEvidence = evidence.length === 1 && evidence[0]?.note === HINT_NOTE;
  if (primary && onlyHintEvidence) {
    primary.confidence = Math.min(primary.confidence, 0.45);
  }
  // ゲーム音楽と判定した曲だけ作品名を出す（それ以外はキー自体を出さない）
  const gameWorkIds = new Set([...gameSubgenreIds, 'game-music']);
  const isGameJudgment =
    primary?.family === 'ゲームミュージック' ||
    evidence.some((item) => Boolean(item.canonicalId && gameWorkIds.has(item.canonicalId)));
  const detectedWork = detectGameWork(detectionFields);
  const workTitle = isGameJudgment ? detectedWork ?? undefined : undefined;
  const matchedCount = evidence.filter((item) => item.canonicalId).length;
  const level = confidenceLevel(primary?.confidence ?? 0, matchedCount);

  /* ------------------------------- 細分類タグ ------------------------------- */
  const fineTagMap = new Map<string, { name: string; count: number; source: SourceName }>();
  const addFineTag = (name: string, count: number, source: SourceName): void => {
    const key = normalizeText(name);
    if (!key) return;
    if (normalize(name)) return; // 対応表に載っているものは証拠側で扱う
    const existing = fineTagMap.get(key);
    if (!existing || count > existing.count) fineTagMap.set(key, { name, count, source });
  };
  for (const tag of mb?.artistTags ?? []) addFineTag(tag.name, tag.count, 'musicbrainz');
  for (const tag of mb?.recordingTags ?? []) addFineTag(tag.name, tag.count, 'musicbrainz');
  for (const tag of mb?.artistGenres ?? []) addFineTag(tag.name, tag.count, 'musicbrainz');
  for (const tag of mb?.recordingGenres ?? []) addFineTag(tag.name, tag.count, 'musicbrainz');
  for (const tag of lastfmTags) addFineTag(tag.name, tag.count, 'lastfm');
  // ゲーム音楽の検出語も細分類タグとして見せる（既に同じ表記があれば増やさない）
  for (const detection of gameDetections) {
    const key = normalizeText(detection.raw);
    if (!key || fineTagMap.has(key)) continue;
    fineTagMap.set(key, { name: detection.raw, count: 1, source: detection.source });
  }

  const fineTags = [...fineTagMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  /* --------------------------------- 曲情報 --------------------------------- */
  const track = withItunesLink(
    pickTrack(input, itunes?.track ?? null, deezer, mb, title, artist),
    itunes?.track ?? null,
  );
  if (!track.rawGenre) {
    track.rawGenre =
      primary?.labelEn ?? deezer?.genres[0] ?? itunes?.track?.primaryGenreName ?? undefined;
  }

  const usedSources = new Set<SourceName>();
  for (const item of evidence) usedSources.add(item.source);
  for (const tag of fineTags) usedSources.add(tag.source);

  const explanation = buildExplanation(primary, level);
  const caveats = buildCaveats({
    artist,
    primary,
    level,
    itunesRaw: itunes?.track?.primaryGenreName,
    itunesScore: itunes?.score ?? 0,
    mb,
    failedSources,
  });
  if (onlyHintEvidence) {
    caveats.push('iTunes が混雑していたため、検索結果のジャンルだけで判定しています。');
  }

  const primaryGenre = primary ? getGenre(primary.id) : undefined;
  const genreInfo =
    primary && primaryGenre
      ? {
          description: primaryGenre.description,
          tagline: primaryGenre.tagline ?? `${primaryGenre.labelJa}。${primaryGenre.family}の音。`,
          related: relatedGenres(primary.id),
        }
      : undefined;

  const judgment: GenreJudgment = {
    track,
    primary,
    others,
    fineTags,
    evidence: [...evidence].sort((a, b) => b.weight - a.weight),
    sourcesUsed: [...usedSources],
    failedSources,
    confidence: level,
    explanation,
    caveats,
    ...(genreInfo ? { genreInfo } : {}),
    ...(workTitle ? { workTitle } : {}),
  };

  return { judgment, warnings };
}
