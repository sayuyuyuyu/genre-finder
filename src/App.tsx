import { useEffect, useRef, useState } from 'react';
import DropZone from '@/components/DropZone';
import ErrorView from '@/components/ErrorView';
import ExampleChips from '@/components/ExampleChips';
import RecentList from '@/components/RecentList';
import Hero from '@/components/Hero';
import JudgmentView from '@/components/JudgmentView';
import ResultsView from '@/components/ResultsView';
import SearchPanel from '@/components/SearchPanel';
import SiteHeader from '@/components/SiteHeader';
import { JudgmentSkeleton, ResultsSkeleton } from '@/components/Skeletons';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useGenreFinder } from '@/hooks/useGenreFinder';
import { useRecent } from '@/hooks/useRecent';
import { useShareUrl } from '@/hooks/useShareUrl';
import { arcadeOf } from '@/lib/arcade';
import { readSharedQuery } from '@/lib/shared-query';

export default function App() {
  const finder = useGenreFinder();
  const recent = useRecent();
  // 共有URL（?t=曲名&a=アーティスト）から開かれたら、その場で判定する
  const initialShare = useRef(readSharedQuery(window.location.search)).current;
  const [input, setInput] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const { phase, judgment, tracks, error, selectedTrack, readingFile } = finder;

  const busy = phase === 'searching' || phase === 'analyzing' || readingFile;
  const showSearch = phase !== 'judgment';
  const canGoBack = tracks.length > 0;

  // 画面が切り替わったら、見出しにフォーカスを移して読み上げの起点にする。
  useEffect(() => {
    if (phase !== 'results' && phase !== 'judgment' && phase !== 'error') return;
    const frame = window.requestAnimationFrame(() => {
      const heading = stageRef.current?.querySelector<HTMLElement>('[data-stage-heading]');
      heading?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  // 判定が終わったら履歴に積む（同じ曲は1件にまとめる）
  useEffect(() => {
    if (phase !== 'judgment' || !judgment) return;
    recent.add({
      track: judgment.track,
      arcade: judgment.primary ? arcadeOf(judgment.primary) : 'UNKNOWN',
      labelJa: judgment.primary?.labelJa ?? '判定不能',
      at: Date.now(),
    });
  }, [phase, judgment, recent.add]);

  useEffect(() => {
    if (!initialShare) return;
    void finder.analyzeTrack({
      id: `share:${initialShare.title}:${initialShare.artist ?? ''}`,
      title: initialShare.title,
      artist: initialShare.artist ?? '',
      source: 'itunes',
      sourceId: '',
    });
    // マウント時のみ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 判定URLの履歴管理（戻るで検索結果へ）とタブタイトル
  useShareUrl(phase, judgment, finder.backToResults);
  useDocumentTitle(phase, judgment, tracks.length);

  function handleSearch() {
    finder.search(input);
  }

  function handleResolve(url: string) {
    setInput('');
    void finder.resolveUrl(url);
  }

  function handleFile(file: File) {
    setInput('');
    void finder.searchFile(file);
  }

  function handleExample(query: string) {
    setInput(query);
    finder.search(query);
  }

  function handleReset() {
    setInput('');
    finder.reset();
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />
      <main id="main" className="main" tabIndex={-1}>
        {phase === 'idle' ? (
          <Hero />
        ) : (
          <h1 className="sr-only">これ何ジャンル？ — 音楽ジャンル判定</h1>
        )}

        {showSearch && (
          <SearchPanel
            value={input}
            phase={phase}
            compact={phase !== 'idle'}
            onChange={setInput}
            onSubmit={handleSearch}
            onResolve={handleResolve}
          />
        )}

        {phase === 'idle' && (
          <>
            <DropZone onFile={handleFile} reading={readingFile} />
            <ExampleChips onPick={handleExample} />
            <RecentList
              items={recent.items}
              onPick={(entry) => {
                void finder.analyzeTrack(entry.track);
              }}
              onClear={recent.clear}
            />
          </>
        )}

        <div className="stage-area" ref={stageRef} aria-live="polite" aria-busy={busy}>
          {phase === 'searching' && <ResultsSkeleton />}
          {phase === 'results' && (
            <ResultsView
              tracks={tracks}
              queryLabel={finder.searchRequest?.display ?? ''}
              notice={finder.notice}
              warnings={finder.warnings}
              onSelect={(track) => {
                void finder.analyzeTrack(track);
              }}
              onReset={handleReset}
            />
          )}
          {phase === 'analyzing' && (
            <JudgmentSkeleton
              trackTitle={selectedTrack?.title}
              canGoBack={canGoBack}
              onBack={() => finder.backToResults()}
            />
          )}
          {phase === 'judgment' && judgment && (
            <JudgmentView
              judgment={judgment}
              warnings={finder.warnings}
              canGoBack={canGoBack}
              onBack={() => finder.backToResults()}
              onReset={handleReset}
              onSearchArtist={(artist: string) => {
                setInput(artist);
                finder.search(artist);
              }}
            />
          )}
          {phase === 'error' && error && (
            <ErrorView
              error={error}
              canGoBack={canGoBack}
              onRetry={() => finder.retry()}
              onBack={() => finder.backToResults()}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>iTunes / Deezer / MusicBrainz の情報を突き合わせて判定します。</p>
          <p className="micro">GENRE IDENTIFIER — LINER NOTES FOR THE UNKNOWN</p>
        </div>
      </footer>
    </div>
  );
}
