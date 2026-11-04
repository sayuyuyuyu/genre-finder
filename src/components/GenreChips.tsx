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
        FINE TAGS / 細分類タグ
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
  related: Array<{ id: string; labelJa: string }>;
}

export function RelatedGenres({ related }: RelatedGenresProps) {
  if (related.length === 0) return null;
  return (
    <section className="notes-block" aria-labelledby="related-label">
      <p id="related-label" className="micro">
        RELATED / 関連ジャンル
      </p>
      <ul className="chips">
        {related.map((genre) => (
          <li className="chip chip--related" key={genre.id}>
            {genre.labelJa}
          </li>
        ))}
      </ul>
    </section>
  );
}
