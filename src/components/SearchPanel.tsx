import type { ClipboardEvent, FormEvent } from 'react';
import type { FinderPhase } from '@/hooks/useGenreFinder';
import { detectLink } from '@/lib/links';

interface SearchPanelProps {
  value: string;
  phase: FinderPhase;
  compact: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onResolve: (url: string) => void;
}

/**
 * 曲名検索とリンク貼り付けを兼ねる入力欄。
 * URL を貼り付けた瞬間に検出して /api/resolve に渡す。
 */
export default function SearchPanel({
  value,
  phase,
  compact,
  onChange,
  onSubmit,
  onResolve,
}: SearchPanelProps) {
  const detected = detectLink(value);
  const searching = phase === 'searching';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (detected) {
      onResolve(detected.url);
      return;
    }
    onSubmit();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    const link = detectLink(pasted);
    if (!link) return;
    event.preventDefault();
    onChange(link.url);
    onResolve(link.url);
  }

  return (
    <form
      className={`search${compact ? ' search--compact' : ''}`}
      role="search"
      onSubmit={handleSubmit}
    >
      <div className="search__head">
        <span className="micro" aria-hidden="true">
          SEARCH
        </span>
        <label className="sr-only" htmlFor="song-query">
          曲名・アーティスト、または Spotify / YouTube のリンク
        </label>
        <span className="micro search__enter" aria-hidden="true">
          ENTER
        </span>
      </div>
      <div className="search__field">
        <span className="search__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="m16 16 4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          id="song-query"
          className="search__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPaste={handlePaste}
          placeholder="例）米津玄師 / Get Lucky"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        <button type="submit" className="btn btn--primary btn--search">
          {searching ? (
            <>
              <span className="spinner" aria-hidden="true" />
              検索中
            </>
          ) : (
            '調べる'
          )}
        </button>
      </div>
      {detected && (
        <p className="search__detected" role="note">
          <span className="micro micro--amber">LINK DETECTED</span>
          <span>{detected.label}</span>
          <button type="button" className="text-button" onClick={() => onResolve(detected.url)}>
            このリンクを読み取る →
          </button>
        </p>
      )}
    </form>
  );
}
