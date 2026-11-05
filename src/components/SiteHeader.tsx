interface SiteHeaderProps {
  onOpenGenres: () => void;
}

export default function SiteHeader({ onOpenGenres }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" focusable="false">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <circle
                cx="20"
                cy="20"
                r="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                opacity="0.55"
              />
              <circle
                cx="20"
                cy="20"
                r="8"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                opacity="0.35"
              />
              <circle cx="20" cy="20" r="3.4" fill="currentColor" />
              <circle cx="28.5" cy="11.5" r="1.4" fill="#f5efe6" />
            </svg>
          </span>
          <span className="brand__text">
            <span className="brand__name">これ何ジャンル？</span>
            <span className="brand__sub">GENRE IDENTIFIER</span>
          </span>
        </div>
        <div className="site-header__right">
          <p className="site-header__meta" aria-hidden="true">
            iTunes / Deezer / MusicBrainz
          </p>
          <button type="button" className="site-header__genres" onClick={onOpenGenres}>
            GENRES
          </button>
        </div>
      </div>
    </header>
  );
}
