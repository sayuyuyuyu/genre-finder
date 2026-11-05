import { useState } from 'react';
import { SOURCE_LABELS } from '@shared/types';
import type { GenreJudgment } from '@shared/types';

interface FineTagsProps {
  tags: GenreJudgment['fineTags'];
}

export function FineTags({ tags }: FineTagsProps) {
  if (tags.length === 0) return null;
  return (
    <section className="notes-block" aria-labelledby="fine-tags-label">
      <p id="fine-tags-label" className="micro">
        TAGS
      </p>
      <ul className="chips">
        {tags.map((tag) => (
          <li
            className="chip chip--tag"
            key={`${tag.source}-${tag.name}`}
            title={`${SOURCE_LABELS[tag.source]} / 票数 ${tag.count}`}
          >
            {tag.name}
            {tag.count > 0 && <span className="chip__count">{tag.count}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RelatedGenresProps {
  related: Array<{
    id: string;
    labelJa: string;
    arcade?: string;
    tagline?: string;
    family?: string;
  }>;
}

/**
 * 関連ジャンル。押すとそのジャンルの一行コメントが出る（文章ではなく短い手触り）。
 */
export function RelatedGenres({ related }: RelatedGenresProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (related.length === 0) return null;

  const selected = related.find((genre) => genre.id === selectedId) ?? null;

  return (
    <section className="notes-block" aria-labelledby="related-label">
      <p id="related-label" className="micro">
        RELATED
      </p>
      <ul className="chips">
        {related.map((genre) => {
          const active = genre.id === selectedId;
          return (
            <li key={genre.id}>
              <button
                type="button"
                className={`chip chip--related${active ? ' is-active' : ''}`}
                onClick={() => setSelectedId((prev) => (prev === genre.id ? null : genre.id))}
                aria-pressed={active}
                title={genre.family ?? genre.labelJa}
              >
                {genre.arcade ?? genre.labelJa}
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <p className="related-note" aria-live="polite">
          <span className="related-note__genre">{selected.arcade ?? selected.labelJa}</span>
          <span className="related-note__text">
            {selected.tagline ?? selected.family ?? selected.labelJa}
          </span>
        </p>
      )}
    </section>
  );
}
