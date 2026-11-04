/**
 * GET /api/search?q=<曲名 or "曲名 アーティスト">&artist=<任意>
 * 曲名から候補一覧を返す。実装は functions/_lib/search.ts。
 */

import type { SearchResponse } from '../../shared/types';
import { cached, SEARCH_TTL } from '../_lib/cache';
import type { PagesContext } from '../_lib/env';
import { errorResponse, jsonResponse, toErrorMessage } from '../_lib/http';
import { searchTracks } from '../_lib/search';

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const artist = url.searchParams.get('artist')?.trim() || undefined;

  if (!q) {
    return errorResponse('検索キーワードを入力してください。', 400);
  }

  try {
    const outcome = await cached(
      `search:${q}|${artist ?? ''}`,
      SEARCH_TTL,
      () => searchTracks(q, artist),
      { shouldCache: (value) => value.warnings.length === 0 },
    );
    const response: SearchResponse = {
      query: outcome.query,
      tracks: outcome.tracks,
      warnings: outcome.warnings,
    };
    return jsonResponse(response);
  } catch (error) {
    return errorResponse('検索に失敗しました。時間をおいてもう一度お試しください。', 500, toErrorMessage(error));
  }
}
