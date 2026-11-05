import { useEffect } from 'react';
import type { GenreJudgment } from '@shared/types';
import type { FinderPhase } from '@/hooks/useGenreFinder';

const BASE_TITLE = 'これ何ジャンル？ — 音楽ジャンル判定';

/** 画面に応じてタブのタイトルを変える。 */
export function useDocumentTitle(
  phase: FinderPhase,
  judgment: GenreJudgment | null,
  trackCount: number,
): void {
  useEffect(() => {
    if (phase === 'judgment' && judgment) {
      document.title = `${judgment.track.title} のジャンル — これ何ジャンル？`;
    } else if (phase === 'results' && trackCount > 0) {
      document.title = `検索結果 ${trackCount}件 — これ何ジャンル？`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [phase, judgment, trackCount]);
}
