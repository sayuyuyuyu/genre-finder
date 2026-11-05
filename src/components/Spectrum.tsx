import type { GenreScore } from '@shared/types';
import { arcadeOf } from '@/lib/arcade';
import { toPercent } from '@/lib/format';

interface SpectrumProps {
  primary: GenreScore | null;
  others: GenreScore[];
  /** 選択中のジャンル ID。null なら全体表示。 */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * ジャンルの分布。1曲を1ジャンルに決めつけず、候補の混ざり具合を棒で見せる。
 * 行を押すとそのジャンルを選択し、DATA FEED がその根拠だけになる。
 */
export default function Spectrum({ primary, others, selectedId, onSelect }: SpectrumProps) {
  const rows = [primary, ...others].filter((row): row is GenreScore => Boolean(row)).slice(0, 5);
  if (rows.length === 0) return null;

  return (
    <section className="spectrum" aria-labelledby="spectrum-title">
      <div className="spectrum__head">
        <p id="spectrum-title" className="micro">
          SPECTRUM
        </p>
        <p className="micro">{selectedId ? 'FILTER ON' : 'ALL'}</p>
      </div>
      <ul className="spectrum__list">
        {rows.map((row, index) => {
          const active = row.id === selectedId;
          return (
            <li key={row.id}>
              <button
                type="button"
                className={`spectrum__row${index === 0 ? ' is-primary' : ''}${active ? ' is-active' : ''}`}
                onClick={() => onSelect(row.id)}
                aria-pressed={active}
                aria-label={`${arcadeOf(row)} の根拠を見る（${toPercent(row.confidence)}%）`}
              >
                <span className="spectrum__label">{arcadeOf(row)}</span>
                <span className="spectrum__bar" aria-hidden="true">
                  <i style={{ width: `${toPercent(row.confidence)}%` }} />
                </span>
                <span className="spectrum__value">{toPercent(row.confidence)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
