import type { GenreScore } from '@shared/types';
import { arcadeOf } from '@/lib/arcade';
import { toPercent } from '@/lib/format';

interface SpectrumProps {
  primary: GenreScore | null;
  others: GenreScore[];
}

/**
 * ジャンルの分布。1曲を1ジャンルに決めつけず、候補の混ざり具合を棒で見せる。
 */
export default function Spectrum({ primary, others }: SpectrumProps) {
  const rows = [primary, ...others].filter((row): row is GenreScore => Boolean(row)).slice(0, 5);
  if (rows.length === 0) return null;

  return (
    <section className="spectrum" aria-labelledby="spectrum-title">
      <div className="spectrum__head">
        <p id="spectrum-title" className="micro">
          SPECTRUM
        </p>
        <p className="micro">MIX</p>
      </div>
      <ol className="spectrum__list">
        {rows.map((row, index) => (
          <li className={`spectrum__row${index === 0 ? ' is-primary' : ''}`} key={row.id}>
            <span className="spectrum__label">{arcadeOf(row)}</span>
            <span className="spectrum__bar" aria-hidden="true">
              <i style={{ width: `${toPercent(row.confidence)}%` }} />
            </span>
            <span className="spectrum__value">{toPercent(row.confidence)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
