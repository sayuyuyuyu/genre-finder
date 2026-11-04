/**
 * 実行環境のバインディング。すべて任意で、未設定でも動く。
 */

export interface Env {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  LASTFM_API_KEY?: string;
  [key: string]: string | undefined;
}

/** Cloudflare Pages Functions のハンドラに渡るコンテキスト（必要な分だけ）。 */
export interface PagesContext {
  request: Request;
  env: Env;
}

export function envValue(env: Env | undefined, key: keyof Env): string | undefined {
  const value = env?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
