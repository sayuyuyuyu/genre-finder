import { useEffect, useMemo, useState } from 'react';
import type { GenreIndexResponse } from '@shared/types';
import { fetchGenreIndex } from '@/lib/api';
import { analyzePreview, type AcousticResult } from '@/lib/audio-engine';
import { toPercent } from '@/lib/format';

interface AcousticPanelProps {
  previewUrl?: string;
}

type Phase = 'idle' | 'analyzing' | 'done' | 'failed';

/**
 * 自作の音響解析（BPM・4つ打ち・音色）によるジャンル推定。
 * メタデータ判定とは別の「もう一つの意見」として、数値と票だけを出す。
 */
export default function AcousticPanel({ previewUrl }: AcousticPanelProps) {
  const [phase, setPhase] = useState<Phase>(previewUrl ? 'analyzing' : 'idle');
  const [result, setResult] = useState<AcousticResult | null>(null);
  const [genres, setGenres] = useState<GenreIndexResponse | null>(null);

  useEffect(() => {
    if (!previewUrl) {
      setPhase('idle');
      return;
    }
    let cancelled = false;
    setPhase('analyzing');
    setResult(null);
    analyzePreview(previewUrl)
      .then((value) => {
        if (cancelled) return;
        setResult(value);
        setPhase('done');
      })
      .catch(() => {
        if (cancelled) return;
        setPhase('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  useEffect(() => {
    fetchGenreIndex()
      .then(setGenres)
      .catch(() => {});
  }, []);

  const labelFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const genre of genres?.genres ?? []) map.set(genre.id, genre.arcade);
    return (id: string): string => map.get(id) ?? id.toUpperCase();
  }, [genres]);

  if (!previewUrl) return null;

  return (
    <section className="acoustic" aria-labelledby="acoustic-title" aria-busy={phase === 'analyzing'}>
      <div className="acoustic__head">
        <p id="acoustic-title" className="micro">
          ACOUSTIC
        </p>
        <p className="micro">
          {phase === 'analyzing' ? 'ANALYZING' : phase === 'failed' ? 'N/A' : 'OWN ENGINE'}
        </p>
      </div>

      {phase === 'analyzing' && (
        <div className="acoustic__loading" aria-hidden="true">
          <span className="sk-line" style={{ width: '70%' }} />
          <span className="sk-line" style={{ width: '46%' }} />
        </div>
      )}

      {phase === 'failed' && (
        <p className="acoustic__note">プレビュー音源を読み取れませんでした。</p>
      )}

      {phase === 'done' && result && (
        <>
          <p className="acoustic__stats">{result.featuresText}</p>
          <ul className="acoustic__votes">
            {result.verdict.votes.length === 0 && (
              <li className="acoustic__note">特徴が足りず、ジャンルを推定できませんでした。</li>
            )}
            {result.verdict.votes.map((vote) => (
              <li className="acoustic__row" key={vote.id}>
                <span className="acoustic__label">{labelFor(vote.id)}</span>
                <span className="acoustic__bar" aria-hidden="true">
                  <i style={{ width: `${toPercent(vote.weight)}%` }} />
                </span>
                <span className="acoustic__value">{toPercent(vote.weight)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
