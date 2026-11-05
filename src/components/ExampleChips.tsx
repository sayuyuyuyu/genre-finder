import { pickRandomQuery } from '@/lib/random-picks';

const EXAMPLES = [
  '米津玄師',
  'Daft Punk - Get Lucky',
  'YOASOBI - 夜に駆ける',
  '宇多田ヒカル - First Love',
  'NewJeans - Ditto',
];

interface ExampleChipsProps {
  onPick: (query: string) => void;
}

export default function ExampleChips({ onPick }: ExampleChipsProps) {
  return (
    <section className="examples" aria-labelledby="examples-label">
      <div className="examples__head">
        <p id="examples-label" className="micro">
          EXAMPLES / 例
        </p>
        <button
          type="button"
          className="examples__random"
          onClick={() => onPick(pickRandomQuery())}
          title="ランダムに1曲調べる"
        >
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M1 3h3l6 8h3M1 11h3l2-2.7M10 3h3M11.5 1.5 13 3l-1.5 1.5M11.5 9.5 13 11l-1.5 1.5" />
          </svg>
          RANDOM
        </button>
      </div>
      <ul className="examples__list">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button type="button" className="chip chip--example" onClick={() => onPick(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
