/**
 * 曲名・アーティスト名の文字列解析。
 * YouTube の oEmbed タイトルや「曲名 アーティスト」形式の検索クエリを分解する。
 * 外部 API に依存しない純粋関数のみ。
 */

import {
  containsJapanese,
  normalizeArtist,
  normalizeText,
  normalizeTitle,
  similarity,
} from './normalize';

const FEAT_PATTERN = /\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;

/** 曲名から "feat. X" を取り出し、タイトル本体と客演アーティストに分ける。 */
export function splitFeaturing(raw: string): { title: string; feat?: string } {
  const match = raw.match(FEAT_PATTERN);
  if (!match) return { title: raw.trim() };
  const index = match.index ?? 0;
  const feat = (match[1] ?? '').trim();
  return {
    title: raw.slice(0, index).trim(),
    feat: feat.length > 0 ? feat : undefined,
  };
}

const BRACKET_NOISE =
  /[([（【{｛](?:official|lyrics?|audio|video|mv|music video|visuali[sz]er|remaster(?:ed)?|live|hd|4k|full version|short version|公式|ミュージックビデオ|リリック|歌詞|高音質)[^)\]）】}｝]*[)\]）】}｝]/gi;

/** 曲名から (Official Video) などのノイズを除去する。 */
export function cleanTrackTitle(raw: string): string {
  let text = raw.normalize('NFKC');
  text = text.replace(BRACKET_NOISE, ' ');
  text = text.replace(/[([（【{｛][^)\]）】}｝]*[)\]）】}｝]/g, ' ');
  text = text.replace(FEAT_PATTERN, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.replace(/^[-,–—\s]+|[-,–—\s]+$/g, '');
}

const ARTIST_NOISE =
  /\b(?:vevo|official|topic|music|records|channel|tv|jp|japan|オフィシャル|公式|チャンネル)\b/gi;

/** YouTube のチャンネル名などからアーティスト名を推定する。 */
export function cleanArtistName(raw: string): string {
  let text = raw.normalize('NFKC');
  text = text.replace(/\s*-\s*topic\s*$/i, ' ');
  // "LuisFonsiVEVO" のように語の境界が無い末尾ノイズを落とす
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  text = text.replace(/(?:vevo|official|topic|music|records|channel)$/i, ' ');
  text = text.replace(ARTIST_NOISE, ' ');
  text = text.replace(/[^\p{L}\p{N}\s&.,'’-]+/gu, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.replace(/^[-,–—\s]+|[-,–—\s]+$/g, '');
}

const SEPARATOR = /\s+[-–—]\s+/;

/**
 * "アーティスト - 曲名" 形式を分解する（YouTube / Deezer でよくある形式）。
 * 区切りが無い場合は title だけ返す。
 */
export function splitArtistTitle(raw: string): { artist?: string; title: string } {
  const text = raw.normalize('NFKC').trim();
  const match = text.match(SEPARATOR);
  if (!match) return { title: cleanTrackTitle(text) };
  const index = match.index ?? 0;
  const left = text.slice(0, index).trim();
  const right = text.slice(index + match[0].length).trim();
  if (!left || !right) return { title: cleanTrackTitle(text) };
  return {
    artist: cleanArtistName(left),
    title: cleanTrackTitle(right),
  };
}

/**
 * 検索クエリを title / artist に分ける。
 * - artist が明示されていればそのまま使う
 * - "アーティスト - 曲名" なら分解する
 * - それ以外（「曲名 アーティスト」を含む）は全文をタイトル扱いにして検索に投げる
 */
export function parseSearchQuery(
  q: string,
  artistParam?: string | null,
): { title: string; artist?: string } {
  const query = q.normalize('NFKC').trim();
  const explicitArtist = artistParam?.trim();
  if (explicitArtist) {
    return { title: query, artist: explicitArtist };
  }
  const split = splitArtistTitle(query);
  if (split.artist) return { title: split.title, artist: split.artist };
  return { title: query };
}

/**
 * 区切りの無いクエリから「曲名 アーティスト」形式の分割候補を作る。
 * 例: "Lemon 米津玄師" → [{ title: "Lemon", artist: "米津玄師" }, ...]
 * 実際にどの分割が正しいかは、アーティスト検索の結果で API 側が検証する。
 */
export function candidateArtistSplits(raw: string): Array<{ title: string; artist: string }> {
  const tokens = raw.normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return [];

  const splits: Array<{ title: string; artist: string }> = [
    // 末尾1語をアーティスト（"Lemon 米津玄師"）
    { title: tokens.slice(0, -1).join(' '), artist: tokens.slice(-1).join(' ') },
    // 先頭1語をアーティスト（"NewJeans Ditto"）
    { title: tokens.slice(1).join(' '), artist: tokens[0] ?? '' },
    // 末尾2語をアーティスト（"Megalovania Toby Fox"）
    { title: tokens.slice(0, -2).join(' '), artist: tokens.slice(-2).join(' ') },
    // 先頭2語をアーティスト（"Daft Punk Get Lucky"）
    { title: tokens.slice(2).join(' '), artist: tokens.slice(0, 2).join(' ') },
  ];
  if (tokens.length >= 3) {
    // 末尾2語をアーティスト（"Megalovania Toby Fox"）
    splits.push({ title: tokens.slice(0, -2).join(' '), artist: tokens.slice(-2).join(' ') });
    // 先頭2語をアーティスト（"Daft Punk Get Lucky"）
    splits.push({ title: tokens.slice(2).join(' '), artist: tokens.slice(0, 2).join(' ') });
  }

  const seen = new Set<string>();
  return splits.filter((split) => {
    const title = split.title.trim();
    const artist = split.artist.trim();
    if (!title || !artist) return false;
    const key = `${title}|${artist}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 検索語を作る。アーティストがあれば足してフルテキスト検索に投げる。 */
export function buildSearchTerm(title: string, artist?: string | null): string {
  const parts = [title.trim(), artist?.trim()].filter((part): part is string => Boolean(part));
  return parts.join(' ');
}

/** 候補側にだけ現れたら減点するバージョン表記。feat. / Remastered / Live / 年号は対象外。 */
const TITLE_VERSION_MARKER =
  /(remix|\bmix\b|karaoke|instrumental|\bcover\b|tribute|lullaby|8-?bit|backing track|made famous|originally performed|in the style of|string quartet|rockabye|rendition|acoustic|demo|extended|sped up|slowed|nightcore|versi[oó]n|\bedit\b)/i;

/** かっこ書きのバリアント表記。クエリに無ければ小さく減点して原曲を優先する。 */
const BRACKET_VARIANT =
  /[([（【][^)\]）】]*?(?:live|remix|\bedit\b|acoustic|demo|instrumental|versi[oó]n|mono|stereo)[^)\]）】]*[)\]）】]/i;

/** カバー・非公式版のシグナル。候補側にだけ含まれる場合は大きく減点する。 */
const COVER_SIGNAL =
  /(cover|karaoke|tribute|lullaby|8-?bit|backing track|instrumental|made famous|originally performed|in the style of|string quartet|rockabye|rendition|music box|piano version|原曲歌手|ガイド無し|ガイドなし|カラオケ|歌っちゃ王|歌ってみた|弾いてみた|オルゴール|カバー|インスト|ピアノver|キー[+\-－＋]?\d)/gi;

/** クエリの文字種で iTunes のストアフロントを選ぶ。日本語なら jp、それ以外は us を優先。 */
export function chooseStorefront(query: string): { primary: 'jp' | 'us'; fallback: 'jp' | 'us' } {
  return containsJapanese(query)
    ? { primary: 'jp', fallback: 'us' }
    : { primary: 'us', fallback: 'jp' };
}

export interface ScorableCandidate {
  title: string;
  artist?: string | null;
  album?: string | null;
}

export interface ScorableQuery {
  title: string;
  artist?: string | null;
}

/** クエリに無いバージョン語が候補タイトルに含まれる場合の減点係数。 */
function versionPenalty(candidateTitle: string, queryTitle: string): number {
  const candidate = candidateTitle.normalize('NFKC');
  const query = queryTitle.normalize('NFKC');
  if (!TITLE_VERSION_MARKER.test(candidate)) return 1;
  if (TITLE_VERSION_MARKER.test(query)) return 1;
  return 0.72;
}

/** 正規化後のタイトルで、クエリに無い語の数。 */
function extraTitleTokens(candidate: string, query: string): number {
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean));
  const queryTokens = new Set(query.split(' ').filter(Boolean));
  let extra = 0;
  for (const token of candidateTokens) {
    if (!queryTokens.has(token)) extra += 1;
  }
  return extra;
}

/** タイトルの一致度（0-1）。余分な語とバージョン表記を減点する。 */
export function titleSimilarity(candidateTitle: string, queryTitle: string): number {
  const candidate = normalizeTitle(candidateTitle);
  const query = normalizeTitle(queryTitle);
  if (!candidate || !query) return 0;
  const version = versionPenalty(candidateTitle, queryTitle);
  if (candidate === query) return version;
  const base = similarity(candidate, query);
  const extra = extraTitleTokens(candidate, query);
  const extraPenalty = Math.max(0.55, 1 - 0.12 * extra);
  return Math.max(0, Math.min(1, base * extraPenalty * version));
}

/**
 * アーティストの一致度（0-1）。
 * 完全一致は 1。クエリの語がすべて含まれても余分な語があれば大きく下げる
 * （例: "Daft Punk Experience" は "Daft Punk" の 0.35）。無関係なら 0。
 */
export function artistSimilarity(
  candidateArtist: string | null | undefined,
  queryArtist: string | null | undefined,
): number {
  const candidate = normalizeArtist(candidateArtist);
  const query = normalizeArtist(queryArtist);
  if (!candidate || !query) return 0;
  if (candidate === query) return 1;
  const candidateTokens = candidate.split(' ').filter(Boolean);
  const queryTokens = query.split(' ').filter(Boolean);
  const queryAllIncluded =
    queryTokens.length > 0 && queryTokens.every((token) => candidateTokens.includes(token));
  const extra = candidateTokens.filter((token) => !queryTokens.includes(token)).length;
  if (queryAllIncluded && extra > 0) return 0.2;
  if (candidate.includes(query) || query.includes(candidate)) return 0.6;
  return similarity(candidate, query) * 0.5;
}

/**
 * クエリのアーティスト語を含みつつ余分な語がある候補か。
 * 例: クエリ "Daft Punk" に対する "Daft Punk Experience"（トリビュートバンド）。
 */
function hasExtraArtistWords(
  candidateArtist: string | null | undefined,
  queryArtist: string | null | undefined,
): boolean {
  const candidate = normalizeArtist(candidateArtist);
  const query = normalizeArtist(queryArtist);
  if (!candidate || !query || candidate === query) return false;
  const candidateTokens = candidate.split(' ').filter(Boolean);
  const queryTokens = query.split(' ').filter(Boolean);
  return (
    queryTokens.length > 0 &&
    queryTokens.every((token) => candidateTokens.includes(token)) &&
    candidateTokens.length > queryTokens.length
  );
}

/** クエリに無いバリアント表記（Live / Remix / Acoustic など）による小さな減点。 */
function bracketVariantPenalty(candidateTitle: string, queryTitle: string): number {
  if (!BRACKET_VARIANT.test(candidateTitle)) return 0;
  if (BRACKET_VARIANT.test(queryTitle)) return 0;
  return 0.05;
}

/** 候補に含まれるカバー・非公式版シグナル（クエリ側にも含まれるものは除外）。 */
export function coverSignalsIn(
  candidate: ScorableCandidate,
  query?: ScorableQuery,
): string[] {
  const candidateText =
    `${candidate.title} ${candidate.artist ?? ''} ${candidate.album ?? ''}`
      .normalize('NFKC')
      .toLowerCase();
  const matches = candidateText.match(COVER_SIGNAL);
  if (!matches || matches.length === 0) return [];
  const queryText = query
    ? `${query.title} ${query.artist ?? ''}`.normalize('NFKC').toLowerCase()
    : '';
  return [...new Set(matches.map((signal) => signal.toLowerCase()))].filter(
    (signal) => !queryText.includes(signal),
  );
}

/** 候補側にだけ現れるカバー・非公式版シグナルによる減点（0 か 0.4）。 */
function coverPenalty(candidate: ScorableCandidate, query: ScorableQuery): number {
  return coverSignalsIn(candidate, query).length > 0 ? 0.4 : 0;
}

/**
 * クエリと候補の一致度（0-1）。
 * タイトルとアーティストを半分ずつ見て、カバー・カラオケ等のシグナルを減点する。
 */
export function scoreMatch(candidate: ScorableCandidate, query: ScorableQuery): number {
  const title = titleSimilarity(candidate.title, query.title);
  const queryArtist = normalizeText(query.artist ?? '');
  let score: number;
  if (queryArtist) {
    const artist = artistSimilarity(candidate.artist, query.artist);
    score = title * 0.5 + artist * 0.5;
    // アーティストがまったく重ならない候補は大きく減点する（カバー・別アーティスト対策）
    if (artist === 0) score *= 0.5;
  } else {
    // アーティスト未指定のときはタイトル重視。候補のアーティスト名の長さで
    // スコアが変わるのを避ける（"Blinding Lights" で短い名前のカバーが勝つ対策）。
    const artistOnly = artistSimilarity(candidate.artist, query.title);
    score = title * 0.8 + artistOnly * 0.2;
  }
  score = Math.max(0, score - bracketVariantPenalty(candidate.title, query.title));
  score = Math.max(0, score - coverPenalty(candidate, query));
  // アーティスト名に余分な語が付くトリビュート/カバーバンドも大きく減点する
  if (queryArtist && hasExtraArtistWords(candidate.artist, query.artist)) {
    score = Math.max(0, score - 0.4);
  }
  return Math.round(Math.min(1, score) * 100) / 100;
}
