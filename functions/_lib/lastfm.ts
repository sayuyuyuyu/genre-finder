/**
 * Last.fm API クライアント。`LASTFM_API_KEY` が設定されているときだけ使う。
 */

import { fetchJson } from './http';
import type { MbTag } from './musicbrainz';

interface LastfmTopTagsResponse {
  toptags?: { tag?: Array<{ name?: string; count?: number | string }> };
  error?: number;
  message?: string;
}

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

/** 曲のトップタグを取得する。タグが無ければ空配列。 */
export async function lastfmTopTags(
  apiKey: string,
  artist: string,
  title: string,
): Promise<MbTag[]> {
  const params = new URLSearchParams({
    method: 'track.getTopTags',
    api_key: apiKey,
    artist,
    track: title,
    format: 'json',
    autocorrect: '1',
  });
  const data = await fetchJson<LastfmTopTagsResponse>(`${LASTFM_BASE}?${params.toString()}`);
  if (data.error) {
    throw new Error(data.message ?? `Last.fm error ${data.error}`);
  }
  const tags = data.toptags?.tag ?? [];
  return tags
    .filter((tag) => typeof tag.name === 'string' && tag.name.trim().length > 0)
    .map((tag) => {
      const count = typeof tag.count === 'string' ? Number.parseInt(tag.count, 10) : tag.count;
      return { name: (tag.name ?? '').trim(), count: Number.isFinite(count) ? Number(count) : 0 };
    });
}
