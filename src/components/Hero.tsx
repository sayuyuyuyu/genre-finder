const MODES = [
  { id: 'type', label: 'TYPE', text: '曲名を打つ' },
  { id: 'paste', label: 'PASTE', text: 'リンクを貼る' },
  { id: 'drop', label: 'DROP', text: '音声を落とす' },
] as const;

function ModeIcon({ id }: { id: (typeof MODES)[number]['id'] }) {
  if (id === 'type') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="5" width="13" height="7" rx="1.5" />
        <path d="M4.5 8.5h.01M8 8.5h.01M11.5 8.5h.01" />
      </svg>
    );
  }
  if (id === 'paste') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.6 9.4a2.4 2.4 0 0 0 3.4 0l2-2a2.4 2.4 0 1 0-3.4-3.4l-1 1" />
        <path d="M9.4 6.6a2.4 2.4 0 0 0-3.4 0l-2 2a2.4 2.4 0 1 0 3.4 3.4l1-1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2v7.5M5.2 6.9 8 9.7l2.8-2.8" />
      <path d="M2.5 11v2.5h11V11" />
    </svg>
  );
}

/**
 * 入口の説明は文章ではなく3つのモードで示す。
 * 実際の入力欄・ドロップ領域はこの下に並ぶ。
 */
export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__disc" aria-hidden="true">
        <span className="hero__disc-label" />
      </div>
      <p className="eyebrow">WHAT GENRE IS THIS?</p>
      <h1 id="hero-title" className="hero__title">
        <span className="hero__title-line">この曲、</span>
        <span className="hero__title-line">
          何ジャンル<span className="hero__title-mark">？</span>
        </span>
      </h1>
      <ul className="modes">
        {MODES.map((mode) => (
          <li className="modes__item" key={mode.id}>
            <span className="modes__icon">
              <ModeIcon id={mode.id} />
            </span>
            <span className="modes__label">{mode.label}</span>
            <span className="modes__text">{mode.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
