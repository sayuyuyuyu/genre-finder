import { useEffect, useRef } from 'react';
import type { GenreJudgment } from '@shared/types';
import type { FinderPhase } from '@/hooks/useGenreFinder';
import { sharedQueryString } from '@/lib/shared-query';

/**
 * 判定結果をURLに反映する。
 * 判定画面は pushState で履歴を積むので、ブラウザの「戻る」で検索結果に戻れる。
 */
export function useShareUrl(
  phase: FinderPhase,
  judgment: GenreJudgment | null,
  onBackToResults: () => void,
): void {
  const backRef = useRef(onBackToResults);
  backRef.current = onBackToResults;

  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      if (!params.get('t')) backRef.current();
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (phase === 'judgment' && judgment) {
      const next = sharedQueryString({
        title: judgment.track.title,
        artist: judgment.track.artist || undefined,
      });
      if (window.location.search !== next) {
        window.history.pushState({ view: 'judgment' }, '', next);
      }
    } else if (phase === 'idle') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [phase, judgment]);
}
