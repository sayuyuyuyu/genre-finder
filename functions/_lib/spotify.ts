/**
 * Spotify クライアント。
 * - SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET があれば Web API（Client Credentials）
 * - 無ければ oEmbed + 埋め込みページの HTML から曲名・アーティストを拾う
 */

import { fetchJson, fetchText } from './http';
import { envValue, type Env } from './env';

export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  year?: number;
  artworkUrl?: string;
  durationMs?: number;
}

interface SpotifyApiTrack {
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: {
    name?: string;
    release_date?: string;
    images?: Array<{ url?: string; width?: number }>;
  };
  duration_ms?: number;
}

interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SpotifyOEmbed {
  title?: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(env: Env | undefined): Promise<string | null> {
  const clientId = envValue(env, 'SPOTIFY_CLIENT_ID');
  const clientSecret = envValue(env, 'SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const basic = btoa(`${clientId}:${clientSecret}`);
  const data = await fetchJson<SpotifyTokenResponse>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!data.access_token) return null;
  const ttl = (data.expires_in ?? 3600) * 1000;
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl };
  return data.access_token;
}

function pickImage(images: Array<{ url?: string; width?: number }> | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url;
}

/** Web API で正確に取得する。認証情報が無い/失敗時は null。 */
export async function spotifyTrackFromApi(
  id: string,
  env: Env | undefined,
): Promise<SpotifyTrackInfo | null> {
  const token = await getAccessToken(env);
  if (!token) return null;
  const track = await fetchJson<SpotifyApiTrack>(
    `https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!track.name) return null;
  const releaseDate = track.album?.release_date;
  return {
    title: track.name,
    artist: (track.artists ?? []).map((artist) => artist.name).filter(Boolean).join(', '),
    album: track.album?.name,
    releaseDate,
    year: releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) || undefined : undefined,
    artworkUrl: pickImage(track.album?.images),
    durationMs: track.duration_ms,
  };
}

interface EmbedEntity {
  title?: string;
  artists?: Array<{ name?: string }>;
  releaseDate?: { isoString?: string };
  duration?: number;
}

function parseEntity(html: string): EmbedEntity | null {
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData?.[1]) {
    try {
      const parsed = JSON.parse(nextData[1]) as {
        props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
      };
      const entity = parsed.props?.pageProps?.state?.data?.entity;
      if (entity?.title) return entity;
    } catch {
      // 埋め込み JSON の形が変わった場合は正規表現フォールバックへ
    }
  }
  // フォールバック: "artists":[{"name":"..."}] を拾う
  const titleMatch = html.match(/"title":"((?:[^"\\]|\\.)+)"/);
  const artistMatch = html.match(/"artists":\[\{"name":"((?:[^"\\]|\\.)+)"/);
  if (!titleMatch?.[1] && !artistMatch?.[1]) return null;
  const decode = (value: string): string => {
    try {
      return JSON.parse(`"${value}"`) as string;
    } catch {
      return value;
    }
  };
  return {
    title: titleMatch?.[1] ? decode(titleMatch[1]) : undefined,
    artists: artistMatch?.[1] ? [{ name: decode(artistMatch[1]) }] : undefined,
  };
}

/** 認証なしで oEmbed と埋め込みページから曲名・アーティストを取得する。 */
export async function spotifyPublicMeta(
  url: string,
  id: string,
): Promise<SpotifyTrackInfo | null> {
  let title: string | undefined;
  let artist: string | undefined;
  let releaseDate: string | undefined;
  let durationMs: number | undefined;

  try {
    const oembed = await fetchJson<SpotifyOEmbed>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    );
    title = oembed.title?.trim();
  } catch {
    // oEmbed が落ちても埋め込みページから拾えればよい
  }

  try {
    const html = await fetchText(`https://open.spotify.com/embed/track/${encodeURIComponent(id)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GenreFinder/0.1)' },
    });
    const entity = parseEntity(html);
    if (entity) {
      title = entity.title ?? title;
      artist = entity.artists?.map((item) => item.name).filter(Boolean).join(', ') || artist;
      releaseDate = entity.releaseDate?.isoString ?? releaseDate;
      durationMs = typeof entity.duration === 'number' ? entity.duration : durationMs;
    }
  } catch {
    // 埋め込みページが取れなくても oEmbed のタイトルだけで返す
  }

  if (!title && !artist) return null;
  return {
    title: title ?? '',
    artist: artist ?? '',
    releaseDate,
    year: releaseDate ? Number.parseInt(releaseDate.slice(0, 4), 10) || undefined : undefined,
    durationMs,
  };
}
