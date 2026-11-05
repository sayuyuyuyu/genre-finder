import { useEffect, useRef, useState } from 'react';
import { SOURCE_LABELS } from '@shared/types';
import type { TrackCandidate } from '@shared/types';
import TrackArtwork from '@/components/TrackArtwork';
import { displayQuery, formatDuration } from '@/lib/format';

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
  // カバー・カラオケ版を隠せるようにする（既定は表示）
  const [showCovers, setShowCovers] = useState(true);
  // 並び順: 関連度（既定） / 新しい順
  const [sortBy, setSortBy] = useState<'match' | 'newest'>('match');
  const coverCount = tracks.filter((track) => track.isCover).length;
  const hasYear = tracks.some((track) => Boolean(track.year));
  const filteredTracks = showCovers ? tracks : tracks.filter((track) => !track.isCover);
  const visibleTracks =
    sortBy === 'newest'
      ? [...filteredTracks].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      : filteredTracks;

  // 選曲カーソル（↑↓ で移動、Enter で判定）
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    setCursor(0);
  }, [visibleTracks.length, showCovers, sortBy]);

  useEffect(() => {
    function isInteractive(element: Element | null): boolean {
      return Boolean(element?.closest('a, button, input, textarea, select, [contenteditable="true"]'));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractive(document.activeElement)) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((prev) => {
          const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1;
          return Math.max(0, Math.min(visibleTracks.length - 1, next));
        });
        return;
      }
      if (event.key === 'Enter' && visibleTracks[cursor]) {
        event.preventDefault();
        onSelect(visibleTracks[cursor]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursor, visibleTracks, onSelect]);

  // カーソルが動いたら見える位置までスクロール
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('.track.is-active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <section className="stage" aria-labelledby="results-title">
      <header className="stage__head">
        <div>
          <p className="micro">RESULTS / 検索結果</p>
          <h2 id="results-title" className="stage__title" data-stage-heading tabIndex={-1}>
            「{displayQuery(queryLabel)}」
          </h2>
          <p className="stage__sub">
            {visibleTracks.length > 0 ? `${visibleTracks.length} 曲 · 選ぶと判定` : '候補なし'}
          </p>
        </div>
        <div className="stage__actions">
          {hasYear && (
            <button
              type="button"
              className={`btn btn--ghost btn--small${sortBy === 'newest' ? ' is-active' : ''}`}
              onClick={() => setSortBy((value) => (value === 'match' ? 'newest' : 'match'))}
              aria-pressed={sortBy === 'newest'}
              title="並び順を切り替える（関連度 / 新しい順）"
            >
              SORT {sortBy === 'newest' ? 'NEWEST' : 'MATCH'}
            </button>
          )}
          {coverCount > 0 && (
            <button
              type="button"
              className={`btn btn--ghost btn--small${showCovers ? '' : ' is-active'}`}
              onClick={() => setShowCovers((value) => !value)}
              aria-pressed={!showCovers}
              title="カバー・カラオケ版の表示を切り替える"
            >
              COVERS {showCovers ? 'ON' : 'OFF'}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
            別の曲を調べる
          </button>
        </div>
      </header>

      {notice && (
        <p className="notice" role="note">
          {notice}
        </p>
      )}

      {visibleTracks.length === 0 ? (
        <div className="empty">
          <div className="empty__art" aria-hidden="true">
            <span className="empty__disc" />
            <span className="empty__mark">?</span>
          </div>
          <div className="empty__body">
            <p className="micro">{tracks.length > 0 ? 'COVERS HIDDEN' : 'NO MATCH'}</p>
            <h3 className="empty__title">
              {tracks.length > 0 ? '原曲が見つかりません' : '曲が見つかりません'}
            </h3>
            <ul className="empty__chips" aria-label="検索のヒント">
              <li className="chip">曲名 アーティスト</li>
              <li className="chip">英語表記</li>
              <li className="chip">Spotify / YouTube のリンク</li>
              <li className="chip">音声ファイル</li>
            </ul>
            <div className="empty__actions">
              {tracks.length > 0 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCovers(true)}
                >
                  カバーも表示する
                </button>
              )}
              <button type="button" className="btn btn--primary" onClick={onReset}>
                曲名を入れ直す
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ol className="results" ref={listRef}>
          {visibleTracks.map((track, index) => (
            <li key={track.id || `${track.source}-${track.sourceId}-${index}`}>
              <TrackRow
                track={track}
                index={index}
                featured={index === 0}
                active={index === cursor}
                onSelect={onSelect}
              />
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
  index: number;
  featured: boolean;
  /** 選曲カーソルが当たっている行。 */
  active?: boolean;
  onSelect: (track: TrackCandidate) => void;
}

/** IIDX の選曲リストのように、番号・ジャンル・時間を並べた1行。 */
function TrackRow({ track, index, featured, active = false, onSelect }: TrackRowProps) {
  // 時間は右端に出すので、メタ情報はアルバムと年だけ
  const meta = [track.album, track.year ? String(track.year) : null]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  const duration = formatDuration(track.durationMs);
  const genre = track.arcadeGenre ?? track.rawGenre ?? null;

  return (
    <button
      type="button"
      className={`track${featured ? ' track--featured' : ''}${active ? ' is-active' : ''}`}
      data-active={active ? 'true' : undefined}
      onClick={() => onSelect(track)}
      aria-label={`${track.title} / ${track.artist} のジャンルを調べる`}
    >
      <span className="track__index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="track__art">
        <TrackArtwork artworkUrl={track.artworkUrl} size={featured ? 'md' : 'sm'} />
      </span>
      <span className="track__body">
        {featured && <span className="badge">これかも</span>}
        <span className="track__title">{track.title}</span>
        <span className="track__artist">{track.artist}</span>
        {meta && <span className="track__meta">{meta}</span>}
      </span>
      <span className="track__genre">
        {genre && <span className="track__arcade">{genre}</span>}
        <span className="micro track__source">{SOURCE_LABELS[track.source]}</span>
      </span>
      {duration && <span className="track__time">{duration}</span>}
      <span className="track__arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
