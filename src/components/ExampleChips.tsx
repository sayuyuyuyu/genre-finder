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
      <p id="examples-label" className="micro">
        EXAMPLES / 例
      </p>
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
