import { useEffect, useMemo, useRef, useState } from 'react';
import type { GenreIndexResponse } from '@shared/types';
import { fetchGenreIndex } from '@/lib/api';

interface GenreIndexProps {
  onClose: () => void;
}

/**
 * ジャンル索引。IIDX のジャンル一覧のように、全ジャンルを大分類ごとに並べる。
 * 文章説明は出さず、arcade 名と一言コメントだけを見せる。
 */
export default function GenreIndex({ onClose }: GenreIndexProps) {
  const [data, setData] = useState<GenreIndexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGenreIndex()
      .then(setData)
      .catch(() => {
        setError('ジャンル一覧を読み込めませんでした。');
      });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const groups = useMemo(() => {
    if (!data) return [];
    const word = query.trim().toLowerCase();
    const matches = data.genres.filter((genre) => {
      if (!word) return true;
      return (
        genre.arcade.toLowerCase().includes(word) ||
        genre.labelJa.toLowerCase().includes(word) ||
        genre.labelEn.toLowerCase().includes(word) ||
        genre.family.toLowerCase().includes(word) ||
        (genre.tagline ?? '').toLowerCase().includes(word)
      );
    });
    return data.families
      .map((family) => ({ family, genres: matches.filter((genre) => genre.family === family) }))
      .filter((group) => group.genres.length > 0);
  }, [data, query]);

  const total = groups.reduce((sum, group) => sum + group.genres.length, 0);

  return (
    <div className="index-overlay" role="dialog" aria-modal="true" aria-labelledby="index-title">
      <button type="button" className="index-overlay__backdrop" onClick={onClose} aria-label="閉じる" />
      <section className="index-panel">
        <header className="index-panel__head">
          <div>
            <p className="micro">GENRE INDEX</p>
            <h2 id="index-title" className="index-panel__title">
              {data ? `${total} GENRES` : '…'}
            </h2>
          </div>
          <div className="index-panel__actions">
            <input
              ref={inputRef}
              className="index-panel__search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="FILTER"
              aria-label="ジャンルを絞り込む"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
              閉じる
            </button>
          </div>
        </header>

        {error && <p className="index-panel__error">{error}</p>}

        <div className="index-panel__body">
          {groups.map((group) => (
            <section className="index-group" key={group.family}>
              <p className="micro index-group__label">{group.family}</p>
              <ul className="index-list">
                {group.genres.map((genre) => (
                  <li className="index-item" key={genre.id}>
                    <span className="index-item__arcade">{genre.arcade}</span>
                    {genre.tagline && <span className="index-item__tagline">{genre.tagline}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
