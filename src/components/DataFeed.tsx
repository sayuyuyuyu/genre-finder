import { SOURCE_LABELS } from '@shared/types';
import type { GenreEvidence } from '@shared/types';
import { formatWeight } from '@/lib/format';

interface DataFeedProps {
  evidence: GenreEvidence[];
}

const SHORT_SOURCE: Record<string, string> = {
  itunes: 'iTunes',
  deezer: 'Deezer',
  musicbrainz: 'MB',
  lastfm: 'Last.fm',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

/**
 * 判定の材料。文章ではなく、どの情報源が何と言ったかをそのまま並べる。
 */
const MAX_ROWS = 6;

export default function DataFeed({ evidence }: DataFeedProps) {
  return (
    <section className="feed" aria-labelledby="feed-title">
      <div className="feed__head">
        <p id="feed-title" className="micro">
          DATA FEED
        </p>
        <p className="micro">{evidence.length}</p>
      </div>
      {evidence.length === 0 ? (
        <p className="feed__empty">参照できるデータがありませんでした。</p>
      ) : (
        <ul className="feed__list">
          {evidence.slice(0, MAX_ROWS).map((item, index) => (
            <li className="feed__row" key={`${item.source}-${item.raw}-${index}`}>
              <span className="feed__source" title={SOURCE_LABELS[item.source]}>
                {SHORT_SOURCE[item.source] ?? item.source}
              </span>
              <span className="feed__raw" title={item.note ?? undefined}>
                {item.raw}
              </span>
              <span className="feed__weight" aria-label={`重み ${formatWeight(item.weight)}`}>
                <i style={{ width: `${Math.round(item.weight * 100)}%` }} aria-hidden="true" />
                <span>{formatWeight(item.weight)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
