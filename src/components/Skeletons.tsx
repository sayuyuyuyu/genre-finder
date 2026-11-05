function SkLine({ width }: { width?: string }) {
  return <span className="sk-line" style={width ? { width } : undefined} />;
}

export function ResultsSkeleton() {
  return (
    <section className="stage" aria-busy="true">
      <p className="sr-only">検索しています。しばらくお待ちください。</p>
      <div className="stage__head skeleton-head">
        <div className="skeleton-copy">
          <span className="sk-line sk-line--micro" />
          <span className="sk-line sk-line--title" />
          <span className="sk-line sk-line--sub" />
        </div>
      </div>
      <div className="skeleton-featured">
        <span className="sk-line sk-index" />
        <span className="sk-block sk-art sk-art--md" />
        <div className="skeleton-copy">
          <SkLine width="52%" />
          <SkLine width="30%" />
          <SkLine width="42%" />
        </div>
        <span className="sk-line sk-genre" />
      </div>
      <div className="skeleton-rows">
        {[0, 1, 2, 3].map((index) => (
          <div className="skeleton-row" key={index}>
            <span className="sk-line sk-index" />
            <span className="sk-block sk-art sk-art--sm" />
            <div className="skeleton-copy">
              <SkLine width={`${58 - index * 7}%`} />
              <SkLine width={`${32 - index * 3}%`} />
            </div>
            <span className="sk-line sk-genre" />
          </div>
        ))}
      </div>
    </section>
  );
}

interface JudgmentSkeletonProps {
  trackTitle?: string;
  canGoBack: boolean;
  onBack: () => void;
}

export function JudgmentSkeleton({ trackTitle, canGoBack, onBack }: JudgmentSkeletonProps) {
  return (
    <section className="stage" aria-busy="true">
      <p className="sr-only">ジャンルを判定しています。しばらくお待ちください。</p>
      <div className="judgment__topbar">
        {canGoBack ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
            ← 検索結果に戻る
          </button>
        ) : (
          <span className="judgment__topbar-spacer" aria-hidden="true" />
        )}
        <p className="micro">ANALYZING / 判定中</p>
        <span className="micro">{trackTitle ? `「${trackTitle}」` : ''}</span>
      </div>
      <div className="judgment__grid skeleton-judgment">
        <div>
          <span className="sk-block sk-art sk-art--lg" />
          <span className="sk-line sk-line--title" style={{ marginTop: 24 }} />
          <SkLine width="42%" />
          <SkLine width="30%" />
        </div>
        <div className="sk-verdict">
          <span className="sk-line sk-line--micro" />
          <span className="sk-line sk-line--arcade" />
          <SkLine width="46%" />
          <span className="sk-level" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <i key={index} />
            ))}
          </span>
          <SkLine width="52%" />
          <div className="sk-spectrum" aria-hidden="true">
            {[92, 64, 42].map((width) => (
              <span key={width} style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
