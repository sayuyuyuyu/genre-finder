/**
 * iTunes Search API クライアント（キー不要）。
 * https://itunes.apple.com/search と /lookup を使う。
 */

import { cached } from './cache';
import { FetchError, fetchJson, sleep } from './http';

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

interface ItunesSearchResponse {
  resultCount?: number;
  results?: Array<ItunesTrack & { wrapperType?: string; kind?: string }>;
}

const ITUNES_BASE = 'https://itunes.apple.com';

/**
 * Apple 側のレート制限（429/403）対策。
 * Cloudflare Workers の共有 IP から叩くと 429 が返ることがあるため、
 * 失敗したら短時間は iTunes を呼ばずに他ソースへフォールバックする。
 */
const RATE_LIMIT_BLOCK_MS = 45_000;
const RETRY_WAIT_MS = 250;
let blockedUntil = 0;

function isRateLimited(error: unknown): boolean {
  return error instanceof FetchError && (error.status === 403 || error.status === 429);
}

async function itunesFetch<T>(url: string): Promise<T> {
  if (Date.now() < blockedUntil) {
    throw new FetchError('iTunes は一時的に利用できません', 429);
  }
  try {
    return await fetchJson<T>(url);
  } catch (error) {
    if (!isRateLimited(error)) throw error;
    // 1回だけ短い間隔で再試行する（別のコネクションに当たることがある）
    await sleep(RETRY_WAIT_MS);
    if (Date.now() < blockedUntil) throw error;
    try {
      return await fetchJson<T>(url);
    } catch (retryError) {
      if (isRateLimited(retryError)) blockedUntil = Date.now() + RATE_LIMIT_BLOCK_MS;
      throw retryError;
    }
  }
}

function isSong(result: ItunesTrack & { wrapperType?: string; kind?: string }): boolean {
  return typeof result.trackId === 'number' && Boolean(result.trackName) && result.kind !== 'podcast';
}

/** アートワーク URL を大きめに差し替える（100x100 → 600x600）。 */
export function artworkUrl(track: Pick<ItunesTrack, 'artworkUrl100'>, size = 600): string | undefined {
  if (!track.artworkUrl100) return undefined;
  return track.artworkUrl100.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);
}

export interface ItunesSearchOptions {
  /** ストアフロント。クエリの文字種で search.ts / analyze.ts が選ぶ。 */
  country?: 'jp' | 'us';
  limit?: number;
  /** 検索対象の属性。タイトルだけ・アーティストだけを狙うときに使う。 */
  attribute?: 'songTerm' | 'artistTerm' | 'albumTerm' | 'genreTerm';
}

export async function itunesSearch(
  term: string,
  options: ItunesSearchOptions = {},
): Promise<ItunesTrack[]> {
  const params = new URLSearchParams({
    term,
    entity: 'song',
    limit: String(options.limit ?? 15),
    country: options.country ?? 'jp',
  });
  if (options.attribute) params.set('attribute', options.attribute);
  // 短時間の重複検索を減らす（レート制限対策）
  const key = `itunes-search:${params.toString()}`;
  return cached(key, 600, async () => {
    const data = await itunesFetch<ItunesSearchResponse>(
      `${ITUNES_BASE}/search?${params.toString()}`,
    );
    return (data.results ?? []).filter(isSong);
  });
}

const LOOKUP_TTL = 86_400;

export async function itunesLookup(id: string | number): Promise<ItunesTrack | null> {
  // 同じ曲を何度も調べても iTunes を叩かない（レート制限対策）
  return cached(`itunes-lookup:${id}`, LOOKUP_TTL, () => fetchItunesLookup(id));
}

async function fetchItunesLookup(id: string | number): Promise<ItunesTrack | null> {
  const params = new URLSearchParams({ id: String(id), entity: 'song' });
  const data = await itunesFetch<ItunesSearchResponse>(
    `${ITUNES_BASE}/lookup?${params.toString()}`,
  );
  const results = (data.results ?? []).filter(isSong);
  return results[0] ?? null;
}
