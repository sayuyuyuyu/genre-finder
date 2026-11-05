import { SOURCE_LABELS } from '@shared/types';
import type { GenreJudgment } from '@shared/types';
import ConfidenceMeter from '@/components/ConfidenceMeter';
import EvidenceList from '@/components/EvidenceList';
import { FineTags, RelatedGenres } from '@/components/GenreChips';
import TrackArtwork from '@/components/TrackArtwork';
import { externalSearchLinks, toPercent, trackMeta } from '@/lib/format';

interface JudgmentViewProps {
  judgment: GenreJudgment;
  warnings: string[];
  canGoBack: boolean;
  onBack: () => void;
  onReset: () => void;
}

export default function JudgmentView({
  judgment,
  warnings,
  canGoBack,
  onBack,
  onReset,
}: JudgmentViewProps) {
  const { track, primary, others, fineTags, evidence, failedSources, confidence, explanation, caveats } =
    judgment;
  const genreInfo = judgment.genreInfo;
  const meta = trackMeta(track);
  const links = externalSearchLinks(track);
  const failedLabels = failedSources.map((source) => SOURCE_LABELS[source]);

  return (
    <article className="judgment" aria-labelledby="judgment-title">
      <div className="judgment__topbar">
        {canGoBack ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
            ← 検索結果に戻る
          </button>
        ) : (
          <span className="judgment__topbar-spacer" aria-hidden="true" />
        )}
        <p className="micro">JUDGMENT / 判定</p>
        <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
          別の曲を調べる
        </button>
      </div>

      <div className="judgment__grid">
        <div className="judgment__record">
          <div className="judgment__cover">
            <TrackArtwork artworkUrl={track.artworkUrl ?? undefined} size="lg" priority />
          </div>
          <div className="judgment__track">
            <p className="micro">TRACK</p>
            <h2 id="judgment-title" className="judgment__track-title" data-stage-heading tabIndex={-1}>
              {track.title}
            </h2>
            <p className="judgment__artist">{track.artist}</p>
            {meta && <p className="judgment__meta">{meta}</p>}
            {(track.rawGenre || track.source) && (
              <p className="judgment__raw">
                {track.rawGenre && <span className="tag">{track.rawGenre}</span>}
                <span className="micro">SOURCE / {SOURCE_LABELS[track.source]}</span>
              </p>
            )}
            <div className="ext-links" aria-label="外部サービスで開く">
              {links.map((link) => (
                <a
                  key={link.label}
                  className="ext-link"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.exact ? '曲のページを開く' : '検索結果を開く'}
                >
                  {link.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="judgment__verdict">
          <p className="micro">GENRE / ジャンル</p>
          {primary ? (
            <>
              <p className="judgment__family">
                <span className="micro">FAMILY / 大分類</span>
                {primary.family}
              </p>
              <h3 className="judgment__genre">{primary.labelJa}</h3>
              <p className="judgment__genre-en">{primary.labelEn}</p>
              <ConfidenceMeter level={confidence} value={primary.confidence} />
            </>
          ) : (
            <>
              <p className="judgment__family">
                <span className="micro">FAMILY / 大分類</span>
                分類できませんでした
              </p>
              <h3 className="judgment__genre judgment__genre--unknown">判定不能</h3>
              <p className="judgment__genre-en">UNKNOWN</p>
              <ConfidenceMeter level={confidence} value={0} />
            </>
          )}

          <p className="judgment__explanation">{explanation}</p>

          {others.length > 0 && (
            <div className="others">
              <p className="micro">OTHER CANDIDATES / 次点</p>
              <ul className="others__list">
                {others.slice(0, 3).map((candidate) => (
                  <li className="others__row" key={candidate.id}>
                    <span className="others__name">{candidate.labelJa}</span>
                    <span className="others__bar" aria-hidden="true">
                      <i style={{ width: `${toPercent(candidate.confidence)}%` }} />
                    </span>
                    <span className="others__value">{toPercent(candidate.confidence)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {caveats.length > 0 && (
            <div className="caveats">
              <p className="micro">CAVEATS / 注意</p>
              <ul className="caveats__list">
                {caveats.map((caveat, index) => (
                  <li key={index}>{caveat}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="judgment__notes">
        <EvidenceList evidence={evidence} />
        <div className="judgment__side">
          {genreInfo?.description && (
            <section className="notes-block" aria-labelledby="about-label">
              <p id="about-label" className="micro">
                ABOUT / このジャンル
              </p>
              <p className="notes-block__text">{genreInfo.description}</p>
            </section>
          )}
          <FineTags tags={fineTags} />
          <RelatedGenres related={genreInfo?.related ?? []} />
        </div>
      </div>

      {failedSources.length > 0 && (
        <p className="failed-sources" role="note">
          <span className="failed-sources__mark">NOTICE</span>
          <span>
            一部の情報源に接続できませんでした（{failedLabels.join('、')}
            ）。表示中の判定は、取得できた情報だけをもとにしています。
          </span>
        </p>
      )}

      {warnings.length > 0 && (
        <div className="warnings">
          <p className="micro">NOTES / 判定メモ</p>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="judgment__footer">
        <button type="button" className="btn btn--primary" onClick={onReset}>
          別の曲を調べる
        </button>
        <p className="micro">END OF LINER NOTES</p>
      </footer>
    </article>
  );
}
