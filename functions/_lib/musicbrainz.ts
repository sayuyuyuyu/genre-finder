/**
 * MusicBrainz API クライアント。
 * - User-Agent 必須
 * - 1 req/sec 制限があるため、モジュール内でリクエストを直列化する（同時リクエスト禁止）
 */

import { similarity } from '../../shared/genre/normalize';
import { scoreMatch } from '../../shared/genre/title';
import { fetchJson, FetchError, sleep } from './http';

export const MB_USER_AGENT = 'GenreFinder/0.1 ( https://genre-finder.pages.dev )';

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MIN_INTERVAL_MS = 1200;

export interface MbTag {
  name: string;
  count: number;
}

export interface MbRecordingMatch {
  recordingId: string;
  artistId?: string;
  title?: string;
  artistName?: string;
  length?: number;
}

interface MbArtistCredit {
  name?: string;
  artist?: { id?: string; name?: string };
}

interface MbRecording {
  id: string;
  title?: string;
  length?: number;
  score?: number;
  'artist-credit'?: MbArtistCredit[];
}

interface MbRecordingSearchResponse {
  recordings?: MbRecording[];
}

interface MbArtistResponse {
  id?: string;
  name?: string;
  genres?: MbTag[];
  tags?: MbTag[];
}

interface MbRecordingResponse {
  id?: string;
  title?: string;
  genres?: MbTag[];
  tags?: MbTag[];
}

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** 1 req/sec を守るため直列化してから実行する。 */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function mbGet<T>(path: string): Promise<T> {
  const url = `${MB_BASE}/${path}`;
  return schedule(async () => {
    let lastError: unknown;
    // MusicBrainz は負荷時に 503 を返すことがあるので、間隔を空けて再試行する
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await fetchJson<T>(url, {
          headers: {
            'user-agent': MB_USER_AGENT,
            accept: 'application/json',
          },
        });
      } catch (error) {
        lastError = error;
        const status = error instanceof FetchError ? error.status : undefined;
        if (status !== 503 && status !== 429) throw error;
        if (attempt < 2) await sleep(1500 * (attempt + 1));
      }
    }
    throw lastError;
  });
}

function normalizeTags(tags: MbTag[] | undefined): MbTag[] {
  return (tags ?? [])
    .filter((tag) => typeof tag?.name === 'string' && tag.name.trim().length > 0)
    .map((tag) => ({ name: tag.name.trim(), count: Number.isFinite(tag.count) ? Number(tag.count) : 0 }));
}

/** Lucene クエリ用に引用符・バックスラッシュを取り除く。 */
function sanitizeQueryPart(value: string): string {
  return value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface RecordingCandidate {
  match: MbRecordingMatch;
  score: number;
}

async function searchRecordings(
  title: string,
  artist: string | undefined,
): Promise<RecordingCandidate[]> {
  const recordingPart = `recording:"${sanitizeQueryPart(title)}"`;
  const query = artist ? `${recordingPart} AND artist:"${sanitizeQueryPart(artist)}"` : recordingPart;
  const params = new URLSearchParams({ query, fmt: 'json', limit: '5' });
  const data = await mbGet<MbRecordingSearchResponse>(`recording?${params.toString()}`);

  return (data.recordings ?? []).flatMap((recording) => {
    if (!recording.id) return [];
    const credit = recording['artist-credit']?.[0];
    const match: MbRecordingMatch = {
      recordingId: recording.id,
      artistId: credit?.artist?.id,
      title: recording.title,
      artistName: credit?.artist?.name ?? credit?.name,
      length: recording.length,
    };
    const score = scoreMatch(
      { title: match.title ?? '', artist: match.artistName },
      { title, artist },
    );
    return [{ match, score }];
  });
}

/**
 * recording 検索。アーティスト付きで見つからなければ曲名だけで再検索し、
 * アーティスト名が近いものだけ採用する（MB は日本語表記のアーティストに弱い）。
 */
export async function mbSearchRecording(
  title: string,
  artist?: string,
): Promise<MbRecordingMatch | null> {
  const candidates = await searchRecordings(title, artist);
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.35) return best.match;

  if (artist) {
    const retry = await searchRecordings(title, undefined);
    const retryBest = retry
      .filter((candidate) => similarity(candidate.match.artistName ?? '', artist) >= 0.3)
      .sort((a, b) => b.score - a.score)[0];
    if (retryBest) return retryBest.match;
  }
  return best?.match ?? null;
}

export async function mbArtistGenres(
  mbid: string,
): Promise<{ name?: string; genres: MbTag[]; tags: MbTag[] }> {
  const params = new URLSearchParams({ inc: 'genres+tags', fmt: 'json' });
  const data = await mbGet<MbArtistResponse>(
    `artist/${encodeURIComponent(mbid)}?${params.toString()}`,
  );
  return {
    name: data.name,
    genres: normalizeTags(data.genres),
    tags: normalizeTags(data.tags),
  };
}

export async function mbRecordingTags(
  mbid: string,
): Promise<{ genres: MbTag[]; tags: MbTag[] }> {
  const params = new URLSearchParams({ inc: 'genres+tags', fmt: 'json' });
  const data = await mbGet<MbRecordingResponse>(
    `recording/${encodeURIComponent(mbid)}?${params.toString()}`,
  );
  return {
    genres: normalizeTags(data.genres),
    tags: normalizeTags(data.tags),
  };
}
