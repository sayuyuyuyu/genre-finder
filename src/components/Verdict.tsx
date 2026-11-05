import type { ConfidenceLevel, GenreJudgment } from '@shared/types';
import SourceLamps from '@/components/SourceLamps';
import { arcadeOf, commentOf, levelOf } from '@/lib/arcade';
import { toPercent } from '@/lib/format';

interface VerdictProps {
  judgment: GenreJudgment;
}

/** 判定の主役。IIDX のジャンル表示のように、全大文字のジャンル名を大きく出す。 */
export default function Verdict({ judgment }: VerdictProps) {
  const { track, primary, confidence, genreInfo } = judgment;
  const level = levelOf(primary?.confidence ?? 0);
  const arcade = primary ? arcadeOf(primary) : 'UNKNOWN';
  const comment = commentOf(track, primary, confidence, genreInfo?.tagline);
  const percent = primary ? toPercent(primary.confidence) : 0;

  return (
    <section className="verdict" aria-labelledby="verdict-genre">
      <div className="verdict__head">
        <p className="micro">GENRE</p>
        <p className="micro verdict__head-right">
          {primary ? `${percent}% / ${LEVEL_LABELS[confidence]}` : '判定不能'}
        </p>
      </div>

      <h2 id="verdict-genre" className="verdict__arcade" data-stage-heading tabIndex={-1}>
        {arcade}
      </h2>

      {judgment.workTitle && (
        <p className="verdict__work">
          <span className="verdict__work-label">WORK</span>
          <a
            className="verdict__work-link"
            href={`https://music.apple.com/jp/search?term=${encodeURIComponent(judgment.workTitle)}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`${judgment.workTitle} を Apple Music で探す`}
          >
            {judgment.workTitle}
            <span aria-hidden="true">↗</span>
          </a>
        </p>
      )}

      <p className="verdict__meta">
        {primary ? (
          <>
            <span className="verdict__ja">{primary.labelJa}</span>
            <span className="verdict__slash" aria-hidden="true">
              /
            </span>
            <span className="verdict__family">{primary.family}</span>
          </>
        ) : (
          <span className="verdict__ja">判定できませんでした</span>
        )}
      </p>

      <div
        className={`level level--${confidence}`}
        role="meter"
        aria-label="判定の強さ"
        aria-valuemin={1}
        aria-valuemax={12}
        aria-valuenow={level}
        aria-valuetext={`レベル ${level} / 12`}
      >
        <span className="level__label">LV</span>
        <span className="level__value">{String(level).padStart(2, '0')}</span>
        <span className="level__ticks" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} className={index < level ? 'is-on' : undefined} />
          ))}
        </span>
      </div>

      <p className="verdict__comment">{comment}</p>

      <SourceLamps judgment={judgment} />
    </section>
  );
}

const LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  high: 'HIGH',
  medium: 'MID',
  low: 'LOW',
  unknown: 'N/A',
};
