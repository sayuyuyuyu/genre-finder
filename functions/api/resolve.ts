/**
 * GET /api/resolve?url=<Spotify / YouTube / Apple Music / Deezer の URL>
 * リンクから曲名・アーティストを解決し、検索結果も返す。
 */

import type { ResolveResponse } from '../../shared/types';
import { cached, RESOLVE_TTL } from '../_lib/cache';
import type { PagesContext } from '../_lib/env';
import { errorResponse, jsonResponse, toErrorMessage } from '../_lib/http';
import { resolveMediaUrl } from '../_lib/resolve';
import { parseMediaUrl } from '../_lib/url';

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const rawUrl = (url.searchParams.get('url') ?? '').trim();

  if (!rawUrl) {
    return errorResponse('URL を指定してください。', 400);
  }
  const parsed = parseMediaUrl(rawUrl);
  if (!parsed) {
    return errorResponse(
      '対応していないURLです。Spotify / YouTube / Apple Music / Deezer の曲リンクを貼ってください。',
      400,
    );
  }

  try {
    const response = await cached(
      `resolve:${parsed.platform}:${parsed.id}`,
      RESOLVE_TTL,
      () => resolveMediaUrl(parsed, context.env),
      { shouldCache: (value) => value.title !== null },
    );
    const body: ResolveResponse = response;
    return jsonResponse(body);
  } catch (error) {
    return errorResponse('リンクの解決に失敗しました。曲名を直接入力してください。', 500, toErrorMessage(error));
  }
}
