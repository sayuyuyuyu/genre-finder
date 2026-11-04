import { useEffect, useRef, useState } from 'react';
import DropZone from '@/components/DropZone';
import ErrorView from '@/components/ErrorView';
import ExampleChips from '@/components/ExampleChips';
import Hero from '@/components/Hero';
import JudgmentView from '@/components/JudgmentView';
import ResultsView from '@/components/ResultsView';
import SearchPanel from '@/components/SearchPanel';
import SiteHeader from '@/components/SiteHeader';
import { JudgmentSkeleton, ResultsSkeleton } from '@/components/Skeletons';
import { useGenreFinder } from '@/hooks/useGenreFinder';

export default function App() {
  const finder = useGenreFinder();
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

  useEffect(() => {
    const base = 'これ何ジャンル？ — 音楽ジャンル判定';
    if (phase === 'judgment' && judgment) {
      document.title = `${judgment.track.title} のジャンル — これ何ジャンル？`;
    } else if (phase === 'results' && tracks.length > 0) {
      document.title = `検索結果 ${tracks.length}件 — これ何ジャンル？`;
    } else {
      document.title = base;
    }
  }, [phase, judgment, tracks.length]);

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
