import { useEffect, useState } from 'react';
import type { GenreJudgment, GenreScore } from '@shared/types';
import DataFeed from '@/components/DataFeed';
import { FineTags, RelatedGenres } from '@/components/GenreChips';
import PreviewButton from '@/components/PreviewButton';
import Spectrum from '@/components/Spectrum';
import TrackArtwork from '@/components/TrackArtwork';
import Verdict from '@/components/Verdict';
import { usePreview } from '@/hooks/usePreview';
import { arcadeOf } from '@/lib/arcade';
import { externalSearchLinks, trackMeta } from '@/lib/format';

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
  const { track, primary, others, fineTags, evidence, failedSources, caveats, explanation } =
    judgment;
  const genreInfo = judgment.genreInfo;
  const meta = trackMeta(track);
  const links = externalSearchLinks(track);
  const preview = usePreview(track.previewUrl);

  // SPECTRUM の行を選ぶと DATA FEED がそのジャンルの根拠だけになる
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => setSelectedId(null), [judgment]);
  const scores = [primary, ...others].filter((score): score is GenreScore => Boolean(score));
  const selected = scores.find((score) => score.id === selectedId) ?? null;
  const feedEvidence = selected ? selected.evidence : evidence;
  const feedLabel = selected ? arcadeOf(selected) : null;
  const failed = failedSources.length > 0;

  return (
    <article className="judgment" aria-labelledby="verdict-genre">
      <div className="judgment__topbar">
        {canGoBack ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
            ← 戻る
          </button>
        ) : (
          <span className="judgment__topbar-spacer" aria-hidden="true" />
        )}
        <p className="micro">JUDGMENT</p>
        <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
          別の曲
        </button>
      </div>

      <div className="judgment__grid">
        <div className="judgment__record">
          <div className="judgment__cover">
            <TrackArtwork artworkUrl={track.artworkUrl ?? undefined} size="lg" priority />
          </div>
          <div className="judgment__track">
            <p className="micro">TRACK</p>
            <h2 className="judgment__track-title">{track.title}</h2>
            <p className="judgment__artist">{track.artist}</p>
            {meta && <p className="judgment__meta">{meta}</p>}
            <PreviewButton preview={preview} />
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

        <div className="judgment__verdict" title={explanation}>
          <Verdict judgment={judgment} />
          <Spectrum
            primary={primary}
            others={others}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />
        </div>
      </div>

      <div className="judgment__lower">
        <DataFeed evidence={feedEvidence} filterLabel={feedLabel} />
        <div className="judgment__side">
          <FineTags tags={fineTags} />
          <RelatedGenres related={genreInfo?.related ?? []} />
        </div>
      </div>

      {(caveats.length > 0 || failed || warnings.length > 0) && (
        <ul className="judgment__notes" role="note">
          {failed && (
            <li className="judgment__note judgment__note--warn">
              一部の情報源に接続できませんでした（
              {failedSources.map((source) => SOURCE_NAMES[source] ?? source).join(' / ')}）
            </li>
          )}
          {caveats.slice(0, 2).map((caveat) => (
            <li className="judgment__note" key={caveat}>
              {caveat}
            </li>
          ))}
          {warnings.map((warning) => (
            <li className="judgment__note" key={warning}>
              {warning}
            </li>
          ))}
        </ul>
      )}

      <footer className="judgment__footer">
        <button type="button" className="btn btn--primary" onClick={onReset}>
          別の曲を調べる
        </button>
        <p className="micro">PRESS START</p>
      </footer>
    </article>
  );
}

const SOURCE_NAMES: Record<string, string> = {
  itunes: 'iTunes',
  deezer: 'Deezer',
  musicbrainz: 'MusicBrainz',
  lastfm: 'Last.fm',
  spotify: 'Spotify',
  youtube: 'YouTube',
};
