import { useCallback, useState } from 'react';
import type { RecentEntry } from '@/lib/recent';
import { addRecent, clearRecent, loadRecent } from '@/lib/recent';

/** 最近調べた曲の管理。判定が終わるたびに App から add する。 */
export function useRecent() {
  const [items, setItems] = useState<RecentEntry[]>(() => loadRecent());

  const add = useCallback((entry: RecentEntry) => {
    setItems((prev) => addRecent(prev, entry));
  }, []);

  const clear = useCallback(() => {
    setItems(clearRecent());
  }, []);

  return { items, add, clear };
}
