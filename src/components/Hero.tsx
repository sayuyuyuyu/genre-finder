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
      <p className="hero__lead">
        曲名でも、Spotify / YouTube のリンクでも、手元の音声ファイルでも。
        iTunes・Deezer・MusicBrainz の情報を突き合わせて、根拠つきでジャンルを判定します。
      </p>
    </section>
  );
}
