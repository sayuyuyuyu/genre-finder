import type { PreviewState } from '@/hooks/usePreview';

interface PreviewButtonProps {
  preview: PreviewState;
}

const RADIUS = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** 30秒試聴。円のリングが進捗になる。文言は最小限。 */
export default function PreviewButton({ preview }: PreviewButtonProps) {
  const { playing, progress, available, toggle } = preview;
  if (!available) return null;

  return (
    <button
      type="button"
      className={`preview${playing ? ' is-playing' : ''}`}
      onClick={toggle}
      aria-label={playing ? '試聴を止める' : '30秒試聴する'}
      aria-pressed={playing}
      title={playing ? '止める' : '30秒だけ聴く'}
    >
      <span className="preview__ring" aria-hidden="true">
        <svg viewBox="0 0 30 30" width="30" height="30">
          <circle className="preview__track" cx="15" cy="15" r={RADIUS} />
          <circle
            className="preview__progress"
            cx="15"
            cy="15"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <span className="preview__icon" aria-hidden="true">
          {playing ? <i className="preview__pause" /> : <i className="preview__play" />}
        </span>
      </span>
      <span className="preview__label">{playing ? 'STOP' : 'PREVIEW'}</span>
    </button>
  );
}
