/**
 * 外部 API 呼び出しと JSON レスポンスの共通ヘルパ。
 * Cloudflare Workers / Node の両方で動く標準 fetch だけを使う。
 */

export const DEFAULT_TIMEOUT_MS = 5000;

export class FetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

type FetchOptions = RequestInit & { timeoutMs?: number };

function signalFor(options?: FetchOptions): AbortSignal {
  return AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/** JSON を取得する。タイムアウトと HTTP エラーは FetchError にする。 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs: _timeoutMs, ...init } = options;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.headers ?? {}),
      },
      signal: signalFor(options),
    });
  } catch (error) {
    throw new FetchError(toErrorMessage(error), undefined);
  }
  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new FetchError(`JSON の解析に失敗しました: ${toErrorMessage(error)}`);
  }
}

/** HTML / テキストを取得する（Spotify の埋め込みページなど）。 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { timeoutMs: _timeoutMs, ...init } = options;
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: signalFor(options) });
  } catch (error) {
    throw new FetchError(toErrorMessage(error), undefined);
  }
  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`, response.status);
  }
  return response.text();
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'タイムアウトしました';
    return error.message;
  }
  return String(error);
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function errorResponse(message: string, status: number, detail?: string): Response {
  return jsonResponse(detail ? { error: message, detail } : { error: message }, status);
}

/** 現在時刻をミリ秒で返す（テストで差し替えやすいように 1 か所にまとめる）。 */
export function now(): number {
  return Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
