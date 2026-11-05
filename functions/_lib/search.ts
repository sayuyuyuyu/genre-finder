/**
 * 検索のオーケストレーション。
 * クエリの文字種でストアフロントを選び、iTunes は段階的に検索語を変えて
 * （曲名+アーティスト → 曲名 → アーティスト）候補を集める。Deezer は並行。
 */

import type { TrackCandidate } from '../../shared/types';
import { SOURCE_LABELS } from '../../shared/types';
import { containsJapanese } from '../../shared/genre/normalize';
import {
  buildSearchTerm,
  candidateArtistSplits,
  chooseStorefront,
  parseSearchQuery,
  titleSimilarity,
} from '../../shared/genre/title';
import { deezerSearchTracks } from './deezer';
import { itunesSearch } from './itunes';
import { deezerToCandidate, itunesToCandidate, MIN_CANDIDATE_SCORE, rankCandidates } from './candidates';

const ITUNES_LIMIT = 15;
const DEEZER_LIMIT = 10;
/** これだけ閾値以上の候補が集まったら探索を打ち切る。 */
const GOOD_RESULT_COUNT = 5;
/** Deezer で追加検索を始める閾値。 */
const DEEZER_GOOD_COUNT = 3;

export interface SearchOutcome {
  query: { title: string; artist?: string };
  tracks: TrackCandidate[];
  warnings: string[];
}

interface LadderStep {
  term: string;
  attribute?: 'songTerm' | 'artistTerm';
}

function dedupeSteps(steps: LadderStep[]): LadderStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const term = step.term.trim();
    if (!term) return false;
    const key = `${step.attribute ?? 'all'}|${term.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * アーティスト名が未指定のクエリからアーティスト候補を推定する。
 * 例: "BABYMONSTER SICK MODE" → ["BABYMONSTER", "BABYMONSTER SICK"]
 */
function deriveArtistTerms(
  query: { title: string; artist?: string },
  rawQuery: string,
): string[] {
  if (query.artist) return [query.artist];
  const words = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  const first = words[0] ?? '';
  const firstTwo = words.slice(0, 2).join(' ');
  return [...new Set([first, firstTwo])].filter((term) => term.length >= 2);
}

/**
 * 区切りの無いクエリ（"Lemon 米津玄師" など）からアーティストを推定する。
 * 分割候補ごとに iTunes の artistTerm 検索を1回だけ試し、曲名が一致するものを採用する。
 */
async function inferArtistSplit(
  rawQuery: string,
  country: 'jp' | 'us',
): Promise<{ title: string; artist: string } | null> {
  const splits = candidateArtistSplits(rawQuery).slice(0, 4);
  for (const split of splits) {
    try {
      const results = await itunesSearch(split.artist, {
        country,
        limit: 10,
        attribute: 'artistTerm',
      });
      if (results.length === 0) continue;
      const best = results.reduce(
        (max, result) => Math.max(max, titleSimilarity(result.trackName, split.title)),
        0,
      );
      // 曲名がほぼ完全一致するときだけ採用する（Blinding Lights を Blinding + Lights に割らない）
      if (best >= 0.85) return split;
    } catch {
      // 推定に失敗しても致命的ではない
    }
  }
  return null;
}

/** iTunes の検索フォールバック階梯。上から順に試す。 */
function buildLadder(query: { title: string; artist?: string }, rawQuery: string): LadderStep[] {
  const fullTerm = buildSearchTerm(query.title, query.artist) || rawQuery.trim();
  const steps: LadderStep[] = [{ term: fullTerm }];
  if (query.title && query.title !== fullTerm) {
    steps.push({ term: query.title, attribute: 'songTerm' });
  }
  for (const artist of deriveArtistTerms(query, rawQuery)) {
    steps.push({ term: artist, attribute: 'artistTerm' });
  }
  return dedupeSteps(steps);
}

/** 閾値以上の候補が何件あるか。 */
function goodCount(candidates: TrackCandidate[], query: { title: string; artist?: string }): number {
  return rankCandidates(candidates, query).filter(
    (candidate) => (candidate.score ?? 0) >= MIN_CANDIDATE_SCORE,
  ).length;
}

interface DeezerCollectResult {
  candidates: TrackCandidate[];
  failed: boolean;
}

async function collectDeezer(
  term: string,
  query: { title: string; artist?: string },
  language: 'ja' | 'en',
  artistTerms: string[],
): Promise<DeezerCollectResult> {
  const candidates: TrackCandidate[] = [];
  try {
    const tracks = await deezerSearchTracks(term, DEEZER_LIMIT, { language });
    candidates.push(...tracks.map(deezerToCandidate));
    if (goodCount(candidates, query) < DEEZER_GOOD_COUNT && artistTerms.length > 0) {
      for (const artist of artistTerms.slice(0, 2)) {
        const extra = await deezerSearchTracks(artist, DEEZER_LIMIT, { language });
        candidates.push(...extra.map(deezerToCandidate));
        if (goodCount(candidates, query) >= DEEZER_GOOD_COUNT) break;
      }
    }
    return { candidates, failed: false };
  } catch {
    return { candidates, failed: true };
  }
}

/** 曲名（+任意でアーティスト）から候補一覧を作る。1ソース失敗でも残りで返す。 */
export async function searchTracks(
  q: string,
  artistParam?: string | null,
): Promise<SearchOutcome> {
  const query = parseSearchQuery(q, artistParam);
  const fullTerm = buildSearchTerm(query.title, query.artist) || q.trim();
  const store = chooseStorefront(fullTerm);
  const language = containsJapanese(fullTerm) ? 'ja' : 'en';
  const warnings: string[] = [];
  const itunesCandidates: TrackCandidate[] = [];
  const artistTerms = deriveArtistTerms(query, q);

  // Deezer は最初の iTunes 検索と並行に走らせる
  const deezerPromise = collectDeezer(fullTerm, query, language, artistTerms);

  let itunesFailed = false;
  const runItunes = async (steps: LadderStep[], country: 'jp' | 'us'): Promise<void> => {
    for (const step of steps) {
      try {
        const results = await itunesSearch(step.term, {
          country,
          limit: ITUNES_LIMIT,
          attribute: step.attribute,
        });
        itunesCandidates.push(...results.map(itunesToCandidate));
      } catch {
        itunesFailed = true;
        return;
      }
      if (goodCount(itunesCandidates, query) >= GOOD_RESULT_COUNT) return;
    }
  };

  const ladder = buildLadder(query, q);
  await runItunes(ladder, store.primary);
  // 優先ストアで足りなければもう一方のストアでも試す
  if (goodCount(itunesCandidates, query) < GOOD_RESULT_COUNT) {
    await runItunes(ladder.slice(0, 2), store.fallback);
  }

  const deezer = await deezerPromise;
  if (itunesFailed) warnings.push(`${SOURCE_LABELS.itunes} に接続できませんでした。`);
  if (deezer.failed) warnings.push(`${SOURCE_LABELS.deezer} に接続できませんでした。`);

  // 「曲名 アーティスト」を分割できていない場合は、アーティストを推定して原曲を補完する
  let resolvedQuery: { title: string; artist?: string } = query;
  if (!query.artist) {
    const split = await inferArtistSplit(q, store.primary);
    if (split) {
      resolvedQuery = split;
      try {
        const extra = await itunesSearch(split.artist, {
          country: store.primary,
          limit: ITUNES_LIMIT,
          attribute: 'artistTerm',
        });
        itunesCandidates.push(...extra.map(itunesToCandidate));
      } catch {
        // 補完に失敗しても既存候補で判定する
      }
    }
  }

  const tracks = rankCandidates([...itunesCandidates, ...deezer.candidates], resolvedQuery);
  const hasStrongMatch = tracks.some((track) => (track.score ?? 0) >= MIN_CANDIDATE_SCORE);
  if (!hasStrongMatch && !itunesFailed && !deezer.failed) {
    warnings.push(
      `「${q.trim()}」に一致する曲が見つかりませんでした。近い候補を表示しています。曲名やアーティスト名を変えて試してください。`,
    );
  }

  return { query: resolvedQuery, tracks, warnings };
}
