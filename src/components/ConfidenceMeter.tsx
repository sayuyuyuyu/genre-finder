import type { ConfidenceLevel } from '@shared/types';
import { CONFIDENCE_HINTS, CONFIDENCE_LABELS, toPercent } from '@/lib/format';

interface ConfidenceMeterProps {
  level: ConfidenceLevel;
  value: number;
}

export default function ConfidenceMeter({ level, value }: ConfidenceMeterProps) {
  const percent = toPercent(value);
  const label = CONFIDENCE_LABELS[level];

  return (
    <section className={`confidence confidence--${level}`} aria-label="信頼度">
      <div className="confidence__head">
        <p className="micro">CONFIDENCE / 信頼度</p>
        <span className={`confidence__level confidence__level--${level}`}>{label}</span>
      </div>
      <div className="confidence__row">
        <p className="confidence__value">
          {percent}
          <span className="confidence__unit">%</span>
        </p>
        <p className="confidence__hint">{CONFIDENCE_HINTS[level]}</p>
      </div>
      <div
        className="confidence__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`信頼度 ${percent} パーセント（${label}）`}
      >
        <span className="confidence__fill" style={{ width: `${percent}%` }} />
        <span className="confidence__tick" style={{ left: '35%' }} aria-hidden="true" />
        <span className="confidence__tick" style={{ left: '60%' }} aria-hidden="true" />
      </div>
      <div className="confidence__scale" aria-hidden="true">
        <span className="confidence__scale-label" style={{ left: '0%' }}>
          低
        </span>
        <span className="confidence__scale-label" style={{ left: '35%' }}>
          中
        </span>
        <span className="confidence__scale-label" style={{ left: '60%' }}>
          高
        </span>
      </div>
    </section>
  );
}
