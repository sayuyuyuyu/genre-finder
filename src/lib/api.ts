import type {
  AnalyzeResponse,
  ApiError,
  GenreIndexResponse,
  GenreJudgment,
  ResolveResponse,
  SearchResponse,
} from '@shared/types';

/** API 呼び出しの失敗。message はそのまま日本語 UI に出せる文にする。 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.detail = detail;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function statusMessage(status: number): string {
  if (status === 400) return 'リクエストの内容を確認してください。';
  if (status === 404) return 'API が見つかりませんでした。サーバーが準備中の可能性があります。';
  if (status === 408 || status === 429) {
    return 'リクエストが混み合っています。少し時間をおいて再試行してください。';
  }
  if (status >= 500) return 'サーバー側でエラーが発生しました。時間をおいて再試行してください。';
  return 'データを取得できませんでした。もう一度お試しください。';
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, headers: { accept: 'application/json' } });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiRequestError(
      'サーバーに接続できませんでした。通信環境を確認して、もう一度お試しください。',
      0,
    );
  }

  const raw = await response.text().catch(() => '');
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const parsed = (body ?? {}) as Partial<ApiError>;
    const detail = [parsed.error, parsed.detail]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' / ');
    throw new ApiRequestError(statusMessage(response.status), response.status, detail || undefined);
  }

  if (body === null) {
    throw new ApiRequestError(
      'サーバーから想定外の応答が返りました。時間をおいて再試行してください。',
      response.status,
    );
  }

  return body as T;
}

export interface SearchParams {
  q: string;
  artist?: string;
}

export interface AnalyzeParams {
  title: string;
  artist?: string;
  itunesId?: string;
  deezerId?: string;
  /** 検索結果のジャンル。iTunes が混雑しているときの補完用。 */
  genreHint?: string;
}

function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.trim()) search.set(key, value.trim());
  }
  return search.toString();
}

function malformed(what: string): ApiRequestError {
  return new ApiRequestError(`${what}を読み取れませんでした。サーバーの応答形式が想定と異なります。`, 200);
}

export async function fetchSearch(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const data = await getJson<Partial<SearchResponse>>(
    `/api/search?${queryString({ q: params.q, artist: params.artist })}`,
    signal,
  );
  if (!Array.isArray(data.tracks)) throw malformed('検索結果');
  return {
    query: data.query ?? { title: params.q, artist: params.artist },
    tracks: data.tracks,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

export async function fetchAnalyze(
  params: AnalyzeParams,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const data = await getJson<Partial<AnalyzeResponse>>(
    `/api/analyze?${queryString({
      title: params.title,
      artist: params.artist,
      itunesId: params.itunesId,
      deezerId: params.deezerId,
      genreHint: params.genreHint,
    })}`,
    signal,
  );
  if (!data.judgment || typeof data.judgment !== 'object') throw malformed('判定結果');

  const judgment = data.judgment as GenreJudgment;
  return {
    judgment: {
      ...judgment,
      evidence: Array.isArray(judgment.evidence) ? judgment.evidence : [],
      others: Array.isArray(judgment.others) ? judgment.others : [],
      fineTags: Array.isArray(judgment.fineTags) ? judgment.fineTags : [],
      caveats: Array.isArray(judgment.caveats) ? judgment.caveats : [],
      failedSources: Array.isArray(judgment.failedSources) ? judgment.failedSources : [],
      sourcesUsed: Array.isArray(judgment.sourcesUsed) ? judgment.sourcesUsed : [],
    },
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : 0,
  };
}

export async function fetchResolve(url: string, signal?: AbortSignal): Promise<ResolveResponse> {
  const data = await getJson<Partial<ResolveResponse>>(
    `/api/resolve?${queryString({ url })}`,
    signal,
  );
  if (!Array.isArray(data.tracks)) throw malformed('リンクの内容');
  return {
    platform: data.platform ?? 'unknown',
    title: data.title ?? null,
    artist: data.artist ?? null,
    tracks: data.tracks,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  };
}

/** ジャンル一覧（初回のみ取得して使い回す）。 */
let genreIndexPromise: Promise<GenreIndexResponse> | null = null;

export function fetchGenreIndex(): Promise<GenreIndexResponse> {
  // 全体で1回だけ取得する。AbortSignal は渡さない（React StrictMode の
  // 二重マウントでキャッシュ中の Promise を中断してしまわないように）。
  if (!genreIndexPromise) {
    genreIndexPromise = getJson<GenreIndexResponse>('/api/genres').catch((error) => {
      genreIndexPromise = null;
      throw error;
    });
  }
  return genreIndexPromise;
}
