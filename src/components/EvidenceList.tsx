import { SOURCE_LABELS } from '@shared/types';
import type { GenreEvidence } from '@shared/types';
import { formatWeight } from '@/lib/format';

interface EvidenceListProps {
  evidence: GenreEvidence[];
}

export default function EvidenceList({ evidence }: EvidenceListProps) {
  return (
    <section className="evidence-block" aria-labelledby="evidence-title">
      <div className="notes-head">
        <h3 id="evidence-title" className="micro">
          EVIDENCE / 根拠
        </h3>
        <span className="micro">{evidence.length} 件</span>
      </div>
      {evidence.length === 0 ? (
        <p className="muted-text">
          判定に使える根拠が集まりませんでした。曲名かアーティスト名を変えると、判定できることがあります。
        </p>
      ) : (
        <ul className="evidence">
          {evidence.map((item, index) => (
            <li className="evidence__row" key={`${item.source}-${item.raw}-${index}`}>
              <span className="evidence__source">{SOURCE_LABELS[item.source]}</span>
              <span className="evidence__label">
                <span className="evidence__raw">{item.raw}</span>
                {item.note && <span className="evidence__note">{item.note}</span>}
              </span>
              <span className="evidence__weight" aria-label={`重み ${formatWeight(item.weight)}`}>
                <span className="evidence__weight-value">{formatWeight(item.weight)}</span>
                <span className="evidence__weight-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round(item.weight * 100)}%` }} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
