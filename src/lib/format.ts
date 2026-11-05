import type { ConfidenceLevel, TrackCandidate } from '@shared/types';

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: '高',
  medium: '中',
  low: '低',
  unknown: '判定不能',
};

export const CONFIDENCE_HINTS: Record<ConfidenceLevel, string> = {
  high: '複数の情報源が同じジャンルを示しています。',
  medium: '情報源はおおむね一致していますが、根拠は十分ではありません。',
  low: '根拠が少ないため、参考程度に読んでください。',
  unknown: 'ジャンルを特定できるだけの根拠が集まりませんでした。',
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 0-1 の信頼度を 0-100 の整数（%）にする。 */
export function toPercent(value: number): number {
  return Math.round(clamp01(value) * 100);
}

/** 証拠の重みを「0.90」のような固定小数表記にする。 */
export function formatWeight(weight: number): string {
  return clamp01(weight).toFixed(2);
}

export function formatDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 「アルバム · 2001 · 3:45」のような一行メタ情報。無ければ空文字。 */
export function trackMeta(track: TrackCandidate): string {
  const parts = [track.album, track.year ? String(track.year) : null, formatDuration(track.durationMs)];
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
}

export interface ExternalSearchLink {
  label: string;
  url: string;
  /** 曲の実ページに直接開ける場合 true（検索ページではなく曲ページ）。 */
  exact: boolean;
}

/**
 * 各サービスで開く URL を作る。
 * iTunes / Apple Music は実ページの URL が分かっているときはそれを優先し、
 * 分からないときだけ検索ページにフォールバックする。
 */
export function externalSearchLinks(
  track: Pick<TrackCandidate, 'title' | 'artist' | 'links'>,
): ExternalSearchLink[] {
  const term = [track.title, track.artist].filter((value) => value && value.trim()).join(' ');
  const encoded = encodeURIComponent(term);
  const appleMusic = track.links?.itunes;
  return [
    {
      label: 'Apple Music',
      url: appleMusic ?? `https://music.apple.com/jp/search?term=${encoded}`,
      exact: Boolean(appleMusic),
    },
    {
      label: 'Spotify',
      url: track.links?.spotify ?? `https://open.spotify.com/search/${encoded}`,
      exact: Boolean(track.links?.spotify),
    },
    {
      label: 'YouTube',
      url: `https://www.youtube.com/results?search_query=${encoded}`,
      exact: false,
    },
  ];
}

/** 画面用に日本語を含む検索語を整える。 */
export function displayQuery(display: string): string {
  return display.trim() || 'この曲';
}
