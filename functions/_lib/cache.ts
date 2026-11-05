/**
 * CDN キャッシュ（caches.default）とメモリ Map のフォールバック。
 * vite dev の Node には caches.default が無いので、その場合は Map だけを使う。
 */

/** 検索結果の TTL（秒）。 */
export const SEARCH_TTL = 600;
/** ジャンル判定の TTL（秒）。 */
export const ANALYZE_TTL = 3600;
/** リンク解決の TTL（秒）。 */
export const RESOLVE_TTL = 3600;

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

const MEMORY_LIMIT = 500;
const memory = new Map<string, MemoryEntry>();

/**
 * キャッシュのスキーマ版。レスポンスの形やタクソノミーを変えたらここを上げる。
 * デプロイ直後に古いレスポンスが返るのを防ぐ（キーが変わるので前のキャッシュを引かない）。
 */
export const CACHE_VERSION = 'v10';

const CACHE_ORIGIN = 'https://genre-finder.internal/__cache/';

interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function cacheStore(): CacheLike | undefined {
  const maybe = (globalThis as unknown as { caches?: { default?: CacheLike } }).caches;
  return maybe?.default;
}

function cacheRequest(key: string): Request {
  return new Request(`${CACHE_ORIGIN}${CACHE_VERSION}/${encodeURIComponent(key)}`);
}

function remember(key: string, value: unknown, ttlSeconds: number): void {
  if (memory.size >= MEMORY_LIMIT) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export interface CacheOptions<T> {
  /** false を返すと結果を保存しない（失敗を含む結果を 1 時間キャッシュしないため）。 */
  shouldCache?: (value: T) => boolean;
}

/** キャッシュから取得する。無ければ producer を実行して保存する。 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
  options: CacheOptions<T> = {},
): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const store = cacheStore();
  if (store) {
    try {
      const response = await store.match(cacheRequest(key));
      if (response) {
        const value = (await response.json()) as T;
        remember(key, value, ttlSeconds);
        return value;
      }
    } catch {
      // キャッシュの読み取り失敗は無視して本来の処理を続ける
    }
  }

  const value = await producer();
  if (options.shouldCache && !options.shouldCache(value)) return value;
  remember(key, value, ttlSeconds);
  if (store) {
    try {
      await store.put(
        cacheRequest(key),
        new Response(JSON.stringify(value), {
          headers: {
            'content-type': 'application/json',
            'cache-control': `public, max-age=${ttlSeconds}`,
          },
        }),
      );
    } catch {
      // キャッシュへの書き込み失敗は無視する
    }
  }
  return value;
}

/** テスト用: メモリキャッシュを空にする。 */
export function clearMemoryCache(): void {
  memory.clear();
}
