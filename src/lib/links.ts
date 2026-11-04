import type { ResolvedPlatform } from '@shared/types';

/** 解決 API が対応しているプラットフォーム（unknown を除く）。 */
export type LinkPlatform = Exclude<ResolvedPlatform, 'unknown'>;

export interface DetectedLink {
  platform: LinkPlatform;
  /** 画面表示用のサービス名。 */
  label: string;
  /** 正規化した URL。 */
  url: string;
}

export const PLATFORM_LABELS: Record<ResolvedPlatform, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  apple: 'Apple Music',
  deezer: 'Deezer',
  unknown: 'リンク',
};

const HOST_RULES: Array<{ platform: LinkPlatform; pattern: RegExp }> = [
  { platform: 'spotify', pattern: /^open\.spotify\.com$/i },
  { platform: 'youtube', pattern: /^(?:www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/i },
  { platform: 'apple', pattern: /^music\.apple\.com$/i },
  { platform: 'deezer', pattern: /^(?:www\.)?deezer\.com$/i },
];

/**
 * 入力欄の値が Spotify / YouTube / Apple Music / Deezer のリンクなら検出する。
 * スキーム無し（open.spotify.com/...）でも受け付ける。
 */
export function detectLink(input: string): DetectedLink | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const rule = HOST_RULES.find((entry) => entry.pattern.test(url.hostname));
  if (!rule) return null;

  return {
    platform: rule.platform,
    label: PLATFORM_LABELS[rule.platform],
    url: url.toString(),
  };
}
