/**
 * メディア URL（Spotify / YouTube / Apple Music / Deezer）の解析。
 * 外部通信しない純粋関数。テスト対象。
 */

import type { ResolvedPlatform } from '../../shared/types';

export type KnownPlatform = Exclude<ResolvedPlatform, 'unknown'>;

export interface ParsedMediaUrl {
  platform: KnownPlatform;
  /** Spotify のトラック ID、YouTube の動画 ID、Apple の曲 ID、Deezer のトラック ID */
  id: string;
  /** API 呼び出し・キャッシュに使う正規化 URL */
  url: string;
  /** Apple Music のアルバム ID（?i= 付き URL のとき） */
  albumId?: string;
  /** Apple Music で曲ではなくアルバムを指している場合 */
  kind?: 'song' | 'album';
  /** 元の入力 */
  raw: string;
}

function withScheme(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function firstPathSegment(segments: string[], name: string): string | null {
  const index = segments.indexOf(name);
  if (index < 0) return null;
  const value = segments[index + 1];
  return value && value.length > 0 ? value : null;
}

function parseSpotify(url: URL, raw: string): ParsedMediaUrl | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const id = firstPathSegment(segments, 'track');
  if (!id || !/^[A-Za-z0-9]{10,40}$/.test(id)) return null;
  return {
    platform: 'spotify',
    id,
    url: `https://open.spotify.com/track/${id}`,
    raw,
  };
}

function parseYouTube(url: URL, raw: string): ParsedMediaUrl | null {
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else {
    const segments = url.pathname.split('/').filter(Boolean);
    id =
      url.searchParams.get('v') ??
      firstPathSegment(segments, 'shorts') ??
      firstPathSegment(segments, 'embed') ??
      firstPathSegment(segments, 'live');
  }
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return {
    platform: 'youtube',
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    raw,
  };
}

function parseApple(url: URL, raw: string): ParsedMediaUrl | null {
  const segments = url.pathname.split('/').filter(Boolean);
  // /jp/album/slug/123456?i=789 または /jp/song/slug/789
  const kindIndex = segments.findIndex((segment) => segment === 'album' || segment === 'song');
  if (kindIndex < 0) return null;
  const kind = segments[kindIndex] === 'song' ? 'song' : 'album';
  const pathId = [...segments].reverse().find((segment) => /^\d{5,}$/.test(segment));
  const trackId = url.searchParams.get('i');
  const albumId = kind === 'album' ? pathId ?? undefined : undefined;
  const id = trackId ?? pathId;
  if (!id) return null;
  return {
    platform: 'apple',
    id,
    albumId,
    kind: trackId ? 'song' : kind,
    url: `https://music.apple.com/${segments[0] && /^[a-z]{2}$/i.test(segments[0]) ? segments[0] : 'jp'}/${kind}/${segments[kindIndex + 1] ?? 'x'}/${id}`,
    raw,
  };
}

function parseDeezer(url: URL, raw: string): ParsedMediaUrl | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const id = firstPathSegment(segments, 'track');
  if (!id || !/^\d+$/.test(id)) return null;
  return {
    platform: 'deezer',
    id,
    url: `https://www.deezer.com/track/${id}`,
    raw,
  };
}

/**
 * 対応 URL を解析する。未対応・不正な URL は null。
 * スキーム省略（open.spotify.com/track/...）も受け付ける。
 */
export function parseMediaUrl(raw: string | null | undefined): ParsedMediaUrl | null {
  if (!raw || raw.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(withScheme(raw));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    return parseSpotify(url, raw);
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    return parseYouTube(url, raw);
  }
  if (host === 'music.apple.com' || host === 'itunes.apple.com') {
    return parseApple(url, raw);
  }
  if (host === 'deezer.com' || host.endsWith('.deezer.com')) {
    return parseDeezer(url, raw);
  }
  return null;
}
