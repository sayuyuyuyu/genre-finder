/**
 * Deezer API クライアント（キー不要）。
 * アルバム詳細の genres は日本語にローカライズされる（例: "ダンス", "ポップス"）。
 */

import { fetchJson, FetchError } from './http';

export interface DeezerArtist {
  id?: number;
  name: string;
}

export interface DeezerAlbumRef {
  id: number;
  title: string;
  cover_medium?: string;
  cover_big?: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  duration?: number;
  link?: string;
  release_date?: string;
  /** 30秒の試聴用 mp3。 */
  preview?: string;
  artist: DeezerArtist;
  album?: DeezerAlbumRef;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  release_date?: string;
  cover_medium?: string;
  cover_big?: string;
  genres?: { data?: Array<{ id?: number; name: string }> };
  artist?: DeezerArtist;
}

interface DeezerListResponse {
  data?: DeezerTrack[];
  total?: number;
  error?: { type?: string; message?: string; code?: number };
}

const DEEZER_BASE = 'https://api.deezer.com';

/**
 * 欧文クエリでは英語タイトルを返させ、和文クエリでは日本語のまま返させる。
 * （Deezer は既定だと Despacito を「デスパシート」と日本語化してしまう）
 */
export interface DeezerLanguageOptions {
  language?: 'en' | 'ja';
}

function languageHeaders(options?: DeezerLanguageOptions): Record<string, string> | undefined {
  return options?.language === 'en' ? { 'accept-language': 'en-US,en;q=0.9' } : undefined;
}

/** Deezer はエラーでも HTTP 200 + {error} を返すことがあるので明示的に判定する。 */
function assertNoError(payload: { error?: { message?: string; code?: number } }): void {
  if (payload.error) {
    throw new FetchError(payload.error.message ?? 'Deezer API エラー', payload.error.code);
  }
}

export async function deezerSearchTracks(
  query: string,
  limit = 10,
  options?: DeezerLanguageOptions,
): Promise<DeezerTrack[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await fetchJson<DeezerListResponse>(`${DEEZER_BASE}/search/track?${params.toString()}`, {
    headers: languageHeaders(options),
  });
  assertNoError(data);
  return (data.data ?? []).filter((track) => track.id && track.title);
}

export async function deezerTrack(
  id: string | number,
  options?: DeezerLanguageOptions,
): Promise<DeezerTrack | null> {
  const data = await fetchJson<DeezerTrack & { error?: { message?: string; code?: number } }>(
    `${DEEZER_BASE}/track/${encodeURIComponent(String(id))}`,
    { headers: languageHeaders(options) },
  );
  assertNoError(data);
  return data.id ? data : null;
}

export async function deezerAlbum(
  id: string | number,
  options?: DeezerLanguageOptions,
): Promise<DeezerAlbum | null> {
  const data = await fetchJson<DeezerAlbum & { error?: { message?: string; code?: number } }>(
    `${DEEZER_BASE}/album/${encodeURIComponent(String(id))}`,
    { headers: languageHeaders(options) },
  );
  assertNoError(data);
  return data.id ? data : null;
}

/** アルバム詳細からジャンル名の配列を取り出す。 */
export function albumGenres(album: DeezerAlbum | null | undefined): string[] {
  return (album?.genres?.data ?? []).map((genre) => genre.name).filter(Boolean);
}
