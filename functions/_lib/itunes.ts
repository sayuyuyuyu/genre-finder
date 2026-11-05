/**
 * iTunes Search API クライアント（キー不要）。
 * https://itunes.apple.com/search と /lookup を使う。
 */

import { cached } from './cache';
import { fetchJson } from './http';

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
  const data = await fetchJson<ItunesSearchResponse>(`${ITUNES_BASE}/search?${params.toString()}`);
  return (data.results ?? []).filter(isSong);
}

const LOOKUP_TTL = 86_400;

export async function itunesLookup(id: string | number): Promise<ItunesTrack | null> {
  // 同じ曲を何度も調べても iTunes を叩かない（レート制限対策）
  return cached(`itunes-lookup:${id}`, LOOKUP_TTL, () => fetchItunesLookup(id));
}

async function fetchItunesLookup(id: string | number): Promise<ItunesTrack | null> {
  const params = new URLSearchParams({ id: String(id), entity: 'song' });
  const data = await fetchJson<ItunesSearchResponse>(`${ITUNES_BASE}/lookup?${params.toString()}`);
  const results = (data.results ?? []).filter(isSong);
  return results[0] ?? null;
}
