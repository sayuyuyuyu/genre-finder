import type { RecentEntry } from '@/lib/recent';
import TrackArtwork from '@/components/TrackArtwork';

interface RecentListProps {
  items: RecentEntry[];
  onPick: (entry: RecentEntry) => void;
  onClear: () => void;
}

/** 最近調べた曲。押すとその曲をもう一度判定する。 */
export default function RecentList({ items, onPick, onClear }: RecentListProps) {
  if (items.length === 0) return null;

  // 調べたジャンルの集計（IIDX の PLAY DATA 風）
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.arcade, (counts.get(item.arcade) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section className="recent" aria-labelledby="recent-label">
      <div className="recent__head">
        <p id="recent-label" className="micro">
          RECENT
        </p>
        <button type="button" className="recent__clear micro" onClick={onClear}>
          CLEAR
        </button>
      </div>
      {items.length >= 2 && (
        <ul className="recent__top" aria-label="調べたジャンルの集計">
          <li className="recent__top-label micro">PLAY DATA</li>
          {top.map(([arcade, count]) => (
            <li className="recent__top-item" key={arcade}>
              {arcade}
              <i>{count}</i>
            </li>
          ))}
        </ul>
      )}
      <ul className="recent__list">
        {items.map((entry) => (
          <li key={`${entry.track.id}-${entry.track.title}`}>
            <button
              type="button"
              className="recent__row"
              onClick={() => onPick(entry)}
              aria-label={`${entry.track.title} / ${entry.track.artist} を判定し直す`}
            >
              <span className="recent__art">
                <TrackArtwork artworkUrl={entry.track.artworkUrl} size="sm" />
              </span>
              <span className="recent__body">
                <span className="recent__arcade">{entry.arcade}</span>
                <span className="recent__title">
                  {entry.track.title}
                  <span className="recent__artist">{entry.track.artist}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
