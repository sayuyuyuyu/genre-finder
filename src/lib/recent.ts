import type { TrackCandidate } from '@shared/types';

export interface RecentEntry {
  track: TrackCandidate;
  /** 判定したジャンル（全大文字）。 */
  arcade: string;
  labelJa: string;
  at: number;
}

const STORAGE_KEY = 'genre-finder:recent:v1';
const MAX = 6;

function isEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecentEntry>;
  return Boolean(
    entry.track &&
      typeof entry.track === 'object' &&
      typeof entry.track.title === 'string' &&
      typeof entry.track.artist === 'string' &&
      typeof entry.arcade === 'string',
  );
}

/** 最近調べた曲。localStorage が使えない環境では空配列。 */
export function loadRecent(): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function save(entries: RecentEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 保存できなくても致命的ではない
  }
}

/** 先頭に追加する。同じ曲は1件にまとめる。 */
export function addRecent(entries: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  const key = `${entry.track.id}|${entry.track.title}|${entry.track.artist}`;
  const rest = entries.filter(
    (item) => `${item.track.id}|${item.track.title}|${item.track.artist}` !== key,
  );
  const next = [{ ...entry, at: Date.now() }, ...rest].slice(0, MAX);
  save(next);
  return next;
}

export function clearRecent(): RecentEntry[] {
  save([]);
  return [];
}
