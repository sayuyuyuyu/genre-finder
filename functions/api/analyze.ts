/**
 * GET /api/analyze?title=&artist=&itunesId=&deezerId=
 * 曲のジャンルを判定して返す。実装は functions/_lib/analyze.ts。
 */

import type { AnalyzeResponse } from '../../shared/types';
import { analyzeTrack } from '../_lib/analyze';
import { ANALYZE_TTL, cached } from '../_lib/cache';
import type { PagesContext } from '../_lib/env';
import { errorResponse, jsonResponse, toErrorMessage } from '../_lib/http';

export async function onRequest(context: PagesContext): Promise<Response> {
  const url = new URL(context.request.url);
  const title = (url.searchParams.get('title') ?? '').trim();
  const artist = url.searchParams.get('artist')?.trim() || undefined;
  const itunesId = url.searchParams.get('itunesId')?.trim() || undefined;
  const deezerId = url.searchParams.get('deezerId')?.trim() || undefined;

  if (!title) {
    return errorResponse('曲名を指定してください。', 400);
  }

  const startedAt = Date.now();
  try {
    const cacheKey = `analyze:${title}|${artist ?? ''}|${itunesId ?? ''}|${deezerId ?? ''}`;
    const outcome = await cached(
      cacheKey,
      ANALYZE_TTL,
      () => analyzeTrack({ title, artist, itunesId, deezerId }, context.env),
      // 一部ソースが落ちた判定はキャッシュせず、次のアクセスで取り直す
      { shouldCache: (value) => value.judgment.failedSources.length === 0 },
    );
    const response: AnalyzeResponse = {
      judgment: outcome.judgment,
      warnings: outcome.warnings,
      elapsedMs: Date.now() - startedAt,
    };
    return jsonResponse(response);
  } catch (error) {
    return errorResponse('ジャンルの判定に失敗しました。時間をおいてもう一度お試しください。', 500, toErrorMessage(error));
  }
}
