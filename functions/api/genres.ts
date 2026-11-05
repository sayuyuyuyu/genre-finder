/**
 * GET /api/genres
 * ジャンル一覧（IIDX のジャンル索引のような参照データ）。実装は taxonomy をそのまま返す。
 */

import { FAMILIES, GENRES } from '../../shared/genre/taxonomy';
import type { GenreIndexResponse, GenreIndexEntry } from '../../shared/types';
import { cached } from '../_lib/cache';
import type { PagesContext } from '../_lib/env';
import { errorResponse, jsonResponse, toErrorMessage } from '../_lib/http';

const GENRES_TTL = 86_400;

export async function onRequest(_context: PagesContext): Promise<Response> {
  try {
    const response = await cached<GenreIndexResponse>('genres:index', GENRES_TTL, async () => {
      const genres: GenreIndexEntry[] = GENRES.map((genre) => ({
        id: genre.id,
        labelJa: genre.labelJa,
        labelEn: genre.labelEn,
        arcade: genre.arcade ?? genre.labelEn.toUpperCase(),
        family: genre.family,
        ...(genre.tagline ? { tagline: genre.tagline } : {}),
      }));
      return { families: [...FAMILIES], genres };
    });
    return jsonResponse(response);
  } catch (error) {
    return errorResponse('ジャンル一覧の取得に失敗しました。', 500, toErrorMessage(error));
  }
}
