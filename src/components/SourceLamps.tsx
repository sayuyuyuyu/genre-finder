import { SOURCE_LABELS } from '@shared/types';
import type { GenreJudgment, SourceName } from '@shared/types';

const DISPLAY: SourceName[] = ['itunes', 'deezer', 'musicbrainz', 'lastfm'];

const SHORT: Partial<Record<SourceName, string>> = {
  itunes: 'iTunes',
  deezer: 'Deezer',
  musicbrainz: 'MB',
  lastfm: 'Last.fm',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

type LampStatus = 'agree' | 'other' | 'empty' | 'failed';

const STATUS_TEXT: Record<LampStatus, string> = {
  agree: '第一候補と同じジャンル',
  other: '別のジャンルを支持',
  empty: 'データなし',
  failed: '接続できなかった',
};

function lampStatus(judgment: GenreJudgment, source: SourceName): LampStatus {
  if (judgment.failedSources.includes(source)) return 'failed';
  const items = judgment.evidence.filter((item) => item.source === source);
  if (items.length === 0) return 'empty';
  const primaryId = judgment.primary?.id;
  return items.some((item) => item.canonicalId && item.canonicalId === primaryId)
    ? 'agree'
    : 'other';
}

/**
 * 情報源ごとのランプ。どのソースが同じジャンルを指しているかを、
 * 文字ではなく3つの点で示す（IIDX の判定ランプのような見た目）。
 */
export default function SourceLamps({ judgment }: { judgment: GenreJudgment }) {
  const used = new Set<SourceName>([...judgment.sourcesUsed, ...judgment.failedSources]);
  const sources = DISPLAY.filter((source) => source !== 'lastfm' || used.has(source));
  if (sources.length === 0) return null;

  return (
    <ul className="lamps" aria-label="情報源ごとの一致状況">
      {sources.map((source) => {
        const status = lampStatus(judgment, source);
        const label = SOURCE_LABELS[source];
        return (
          <li
            key={source}
            className={`lamp lamp--${status}`}
            title={`${label}: ${STATUS_TEXT[status]}`}
          >
            <i aria-hidden="true" />
            <span>{SHORT[source] ?? source}</span>
          </li>
        );
      })}
    </ul>
  );
}
