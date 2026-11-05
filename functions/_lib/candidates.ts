/**
 * 外部 API の結果を TrackCandidate に変換し、クエリとの近さで並べる。
 */

import type { TrackCandidate } from '../../shared/types';
import { normalize, trackKey } from '../../shared/genre/normalize';
import { getGenre } from '../../shared/genre/taxonomy';
import { scoreMatch } from '../../shared/genre/title';
import { artworkUrl, type ItunesTrack } from './itunes';
import type { DeezerTrack } from './deezer';

/** iTunes の粗いジャンル名を IIDX 風表記に寄せる（対応表に無ければ undefined）。 */
function arcadeGenreFor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const hit = normalize(raw);
  if (!hit) return undefined;
  const genre = getGenre(hit.id);
  if (!genre) return undefined;
  return genre.arcade ?? genre.labelEn.toUpperCase();
}

export function itunesToCandidate(track: ItunesTrack): TrackCandidate {
  const year = track.releaseDate ? Number.parseInt(track.releaseDate.slice(0, 4), 10) : undefined;
  return {
    id: `itunes:${track.trackId}`,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    year: Number.isFinite(year) ? year : undefined,
    releaseDate: track.releaseDate,
    artworkUrl: artworkUrl(track),
    durationMs: track.trackTimeMillis,
    previewUrl: track.previewUrl || undefined,
    source: 'itunes',
    sourceId: String(track.trackId),
    rawGenre: track.primaryGenreName,
    arcadeGenre: arcadeGenreFor(track.primaryGenreName),
    links: track.trackViewUrl ? { itunes: track.trackViewUrl } : undefined,
  };
}

export function deezerToCandidate(track: DeezerTrack): TrackCandidate {
  const year = track.release_date
    ? Number.parseInt(track.release_date.slice(0, 4), 10)
    : undefined;
  return {
    id: `deezer:${track.id}`,
    title: track.title,
    artist: track.artist?.name ?? '',
    album: track.album?.title,
    year: Number.isFinite(year) ? year : undefined,
    releaseDate: track.release_date,
    artworkUrl: track.album?.cover_medium,
    durationMs: typeof track.duration === 'number' ? track.duration * 1000 : undefined,
    previewUrl: track.preview || undefined,
    source: 'deezer',
    sourceId: String(track.id),
    popularity: typeof track.rank === 'number' ? track.rank : undefined,
    links: track.link ? { deezer: track.link } : undefined,
  };
}

const SOURCE_PRIORITY: Record<string, number> = { itunes: 0, deezer: 1, musicbrainz: 2 };

/** スコアが近い候補同士では人気度が高い方を前にする（カバーより原曲が上に来やすくする）。 */
const SCORE_TIE_BAND = 0.03;

function compareCandidates(a: TrackCandidate, b: TrackCandidate): number {
  const scoreA = a.score ?? 0;
  const scoreB = b.score ?? 0;
  if (Math.abs(scoreA - scoreB) > SCORE_TIE_BAND) return scoreB - scoreA;

  // 人気度は両方に値があるときだけ比較する（iTunes 側が一律不利にならないように）
  const popularityA = a.popularity ?? 0;
  const popularityB = b.popularity ?? 0;
  if (popularityA > 0 && popularityB > 0 && popularityA !== popularityB) {
    return popularityB - popularityA;
  }

  const priorityA = SOURCE_PRIORITY[a.source] ?? 9;
  const priorityB = SOURCE_PRIORITY[b.source] ?? 9;
  if (priorityA !== priorityB) return priorityA - priorityB;
  return scoreB - scoreA;
}

/** これ未満のスコアの候補は検索結果から除外する。 */
export const MIN_CANDIDATE_SCORE = 0.12;
/** 全候補が閾値未満だったときに残す件数（UI が空にならないように）。 */
export const FALLBACK_CANDIDATE_COUNT = 5;
/** 検索結果として返す最大件数。 */
export const MAX_CANDIDATE_COUNT = 20;

export interface RankOptions {
  minScore?: number;
  fallbackCount?: number;
  maxCount?: number;
}

/**
 * スコアを付けて重複を排除し、クエリに近い順に並べる。
 * 重複は「正規化した曲名 + アーティスト」で判定し、スコアが高い方（同点なら iTunes）を残す。
 * 閾値未満の候補は捨てるが、全滅する場合は上位数件を残す。
 */
export function rankCandidates(
  candidates: TrackCandidate[],
  query: { title: string; artist?: string },
  options: RankOptions = {},
): TrackCandidate[] {
  const best = new Map<string, TrackCandidate>();
  for (const candidate of candidates) {
    if (!candidate.title) continue;
    const score = scoreMatch(
      { title: candidate.title, artist: candidate.artist, album: candidate.album },
      query,
    );
    const scored: TrackCandidate = { ...candidate, score };
    const key = trackKey(candidate.title, candidate.artist);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, scored);
      continue;
    }
    const existingScore = existing.score ?? 0;
    const priority = SOURCE_PRIORITY[candidate.source] ?? 9;
    const existingPriority = SOURCE_PRIORITY[existing.source] ?? 9;
    if (score > existingScore || (score === existingScore && priority < existingPriority)) {
      best.set(key, scored);
    }
  }

  const sorted = [...best.values()].sort(compareCandidates);
  const minScore = options.minScore ?? MIN_CANDIDATE_SCORE;
  const maxCount = options.maxCount ?? MAX_CANDIDATE_COUNT;
  const passing = sorted.filter((candidate) => (candidate.score ?? 0) >= minScore);
  if (passing.length > 0) return passing.slice(0, maxCount);
  return sorted.slice(0, options.fallbackCount ?? FALLBACK_CANDIDATE_COUNT);
}
