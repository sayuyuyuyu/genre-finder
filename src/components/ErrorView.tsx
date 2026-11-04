import type { FinderError } from '@/hooks/useGenreFinder';

interface ErrorViewProps {
  error: FinderError;
  canGoBack: boolean;
  onRetry: () => void;
  onBack: () => void;
  onReset: () => void;
}

export default function ErrorView({
  error,
  canGoBack,
  onRetry,
  onBack,
  onReset,
}: ErrorViewProps) {
  return (
    <section className="stage">
      <div className="error-card" role="alert">
        <p className="micro">ERROR / エラー</p>
        <h2 className="error-card__title" data-stage-heading tabIndex={-1}>
          {error.title}
        </h2>
        <p className="error-card__message">{error.message}</p>
        {error.detail && (
          <p className="error-card__detail">
            <span className="micro">DETAIL</span>
            {error.detail}
          </p>
        )}
        <div className="error-card__actions">
          {error.retry && (
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              再試行する
            </button>
          )}
          {canGoBack && (
            <button type="button" className="btn btn--ghost" onClick={onBack}>
              検索結果に戻る
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onReset}>
            最初からやり直す
          </button>
        </div>
      </div>
    </section>
  );
}
