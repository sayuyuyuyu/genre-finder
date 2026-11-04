import { SOURCE_LABELS } from '@shared/types';
import type { TrackCandidate } from '@shared/types';
import TrackArtwork from '@/components/TrackArtwork';
import { displayQuery, trackMeta } from '@/lib/format';

interface ResultsViewProps {
  tracks: TrackCandidate[];
  queryLabel: string;
  notice: string | null;
  warnings: string[];
  onSelect: (track: TrackCandidate) => void;
  onReset: () => void;
}

export default function ResultsView({
  tracks,
  queryLabel,
  notice,
  warnings,
  onSelect,
  onReset,
}: ResultsViewProps) {
  return (
    <section className="stage" aria-labelledby="results-title">
      <header className="stage__head">
        <div>
          <p className="micro">RESULTS / 検索結果</p>
          <h2 id="results-title" className="stage__title" data-stage-heading tabIndex={-1}>
            「{displayQuery(queryLabel)}」
          </h2>
          <p className="stage__sub">
            {tracks.length > 0
              ? `${tracks.length}曲の候補が見つかりました。曲を選ぶとジャンルを判定します。`
              : '条件に合う曲が見つかりませんでした。'}
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
          別の曲を調べる
        </button>
      </header>

      {notice && (
        <p className="notice" role="note">
          {notice}
        </p>
      )}

      {tracks.length === 0 ? (
        <div className="empty">
          <p className="micro">NO MATCH</p>
          <h3 className="empty__title">曲が見つかりませんでした</h3>
          <p className="empty__text">
            表記を変えると見つかることがあります。アーティスト名を添える、英語表記（ローマ字）にする、リンクを貼る、などを試してください。
          </p>
          <ul className="empty__tips">
            <li>「曲名 アーティスト」の順で入力する</li>
            <li>「feat.」や記号を省いてみる</li>
            <li>Spotify / YouTube の曲リンクを貼り付ける</li>
          </ul>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={onReset}>
              曲名を入れ直す
            </button>
          </div>
        </div>
      ) : (
        <ol className="results">
          {tracks.map((track, index) => (
            <li key={track.id || `${track.source}-${track.sourceId}-${index}`}>
              <TrackRow track={track} featured={index === 0} onSelect={onSelect} />
            </li>
          ))}
        </ol>
      )}

      {warnings.length > 0 && (
        <div className="warnings">
          <p className="micro">NOTES / 検索メモ</p>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface TrackRowProps {
  track: TrackCandidate;
  featured: boolean;
  onSelect: (track: TrackCandidate) => void;
}

function TrackRow({ track, featured, onSelect }: TrackRowProps) {
  const meta = trackMeta(track);
  return (
    <button
      type="button"
      className={`track${featured ? ' track--featured' : ''}`}
      onClick={() => onSelect(track)}
      aria-label={`${track.title} / ${track.artist} のジャンルを調べる`}
    >
      <span className="track__art">
        <TrackArtwork artworkUrl={track.artworkUrl} size={featured ? 'md' : 'sm'} />
      </span>
      <span className="track__body">
        {featured && <span className="badge">これかも</span>}
        <span className="track__title">{track.title}</span>
        <span className="track__artist">{track.artist}</span>
        {meta && <span className="track__meta">{meta}</span>}
      </span>
      <span className="track__side">
        {track.rawGenre && <span className="tag">{track.rawGenre}</span>}
        <span className="micro track__source">{SOURCE_LABELS[track.source]}</span>
      </span>
      <span className="track__arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
