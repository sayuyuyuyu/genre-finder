/**
 * 証拠の重み付けと信頼度の計算。
 *
 * - ジャンル ID ごとに重みを合算
 * - 非 broad ジャンルは子ジャンルの重みを 0.6 倍でロールアップして支持重みとする
 * - broad（Pop / Rock / Electronic などの傘）はロールアップを受けない
 * - broad が首位でも、同 family の細分類の支持が十分なら primary を昇格させる
 */

import type { ConfidenceLevel, GenreEvidence, GenreScore, SourceName } from '../types';
import { childrenOf, getGenre, isDescendantOf } from './taxonomy';

/** ソースごとの基本重み（SPEC の表）。 */
export const ITUNES_WEIGHT = 0.9;
export const DEEZER_WEIGHT = 0.75;

/** 子ジャンルの支持重みを親へ回す比率。 */
export const CHILD_ROLLUP_RATIO = 0.6;
/** broad から細分類への昇格条件（同 family の支持重みが broad の own の何倍以上か）。 */
export const BROAD_PROMOTION_SUPPORT_RATIO = 0.5;
/** broad から細分類への昇格条件（細分類の confidence が broad の何倍以上か）。 */
export const BROAD_PROMOTION_CONFIDENCE_RATIO = 0.75;
/** 昇格時に broad の重みを細分類へ移す比率（表示の矛盾を防ぐ）。 */
export const BROAD_TRANSFER_RATIO = 0.5;
/** これ以上は信頼度を上げない。 */
export const MAX_CONFIDENCE = 0.97;
/** 大分類（傘）が primary のときの信頼度上限。 */
export const BROAD_CONFIDENCE_CAP = 0.65;
/** 粗いラベル（iTunes / Deezer のみ）しか無いときの上限。high の 0.6 を跨がないよう 0.59。 */
export const COARSE_CONFIDENCE_CAP = 0.59;

/** MusicBrainz のアーティストジャンル: 0.45 + 0.55 * min(count/25, 1) */
export function musicbrainzArtistWeight(count: number): number {
  return 0.45 + 0.55 * Math.min(Math.max(count, 0) / 25, 1);
}

/** MusicBrainz のレコーディングタグ: アーティストジャンル重み × 0.9 */
export function musicbrainzRecordingWeight(count: number): number {
  return musicbrainzArtistWeight(count) * 0.9;
}

/** Last.fm のタグ: 0.40 + 0.60 * min(count/100, 1) */
export function lastfmWeight(count: number): number {
  return 0.4 + 0.6 * Math.min(Math.max(count, 0) / 100, 1);
}

/** ジャンル ID ごとの集計結果。 */
export interface AggregatedGenres {
  /** primary を先頭に confidence 降順。 */
  scores: GenreScore[];
  primary: GenreScore | null;
  others: GenreScore[];
}

export interface AggregateOptions {
  /**
   * coarse ラベルより優先したいジャンル ID（例: ゲーム音楽の検出結果）。
   * primary が大分類や Soundtrack のとき、ここに含まれる細分類へ昇格させる。
   */
  priorityIds?: string[];
}

interface Bucket {
  /** 直接の証拠の重み合計。 */
  own: number;
  evidence: GenreEvidence[];
  sources: Set<SourceName>;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function byConfidence(a: GenreScore, b: GenreScore): number {
  return b.confidence - a.confidence || a.id.localeCompare(b.id);
}

/** primary の % が others より低くならないようにする（UI のメーターが矛盾しないように）。 */
function ensurePrimaryTop(primary: GenreScore, scores: GenreScore[]): void {
  const maxOther = scores
    .filter((score) => score.id !== primary.id)
    .reduce((max, score) => Math.max(max, score.confidence), 0);
  if (primary.confidence <= maxOther) {
    primary.confidence = round3(Math.min(MAX_CONFIDENCE, maxOther + 0.01));
  }
}

/**
 * 証拠をジャンル ID ごとに合算して信頼度を出す。
 * confidence = (そのジャンル + 子ジャンルの支持重み) / 対応表に載った証拠の総重み。
 * 2ソース以上が同じジャンルを支持したらブーストする。
 */
export function aggregateGenres(
  evidence: GenreEvidence[],
  options: AggregateOptions = {},
): AggregatedGenres {
  const buckets = new Map<string, Bucket>();
  let totalWeight = 0;

  for (const item of evidence) {
    if (!item.canonicalId || !(item.weight > 0)) continue;
    const genre = getGenre(item.canonicalId);
    if (!genre) continue;
    totalWeight += item.weight;
    const bucket = buckets.get(item.canonicalId) ?? {
      own: 0,
      evidence: [],
      sources: new Set<SourceName>(),
    };
    bucket.own += item.weight;
    bucket.evidence.push(item);
    bucket.sources.add(item.source);
    buckets.set(item.canonicalId, bucket);
  }

  if (totalWeight <= 0 || buckets.size === 0) {
    return { scores: [], primary: null, others: [] };
  }

  // 支持重み（own + 子ジャンルのロールアップ）と、その支持に関わるソース
  const support = new Map<string, number>();
  const supportSources = new Map<string, Set<SourceName>>();
  for (const [id, bucket] of buckets) {
    const genre = getGenre(id);
    if (!genre) continue;
    let value = bucket.own;
    const sources = new Set(bucket.sources);
    if (!genre.broad) {
      for (const child of childrenOf(id)) {
        const childBucket = buckets.get(child.id);
        if (!childBucket) continue;
        value += childBucket.own * CHILD_ROLLUP_RATIO;
        for (const source of childBucket.sources) sources.add(source);
      }
    }
    support.set(id, value);
    supportSources.set(id, sources);
  }

  const buildScore = (id: string): GenreScore | null => {
    const genre = getGenre(id);
    const bucket = buckets.get(id);
    if (!genre || !bucket) return null;
    const value = support.get(id) ?? bucket.own;
    const sources = supportSources.get(id) ?? bucket.sources;
    const base = value / totalWeight;
    const boosted = sources.size >= 2 ? Math.min(base * 1.15 + 0.06, MAX_CONFIDENCE) : base;
    return {
      id,
      labelJa: genre.labelJa,
      labelEn: genre.labelEn,
      arcade: genre.arcade ?? genre.labelEn.toUpperCase(),
      family: genre.family,
      confidence: round3(boosted),
      evidence: [...bucket.evidence].sort((a, b) => b.weight - a.weight),
    };
  };

  const rebuild = (): GenreScore[] =>
    [...buckets.keys()]
      .map(buildScore)
      .filter((score): score is GenreScore => score !== null)
      .sort(byConfidence);

  let scores = rebuild();
  if (scores.length === 0) return { scores: [], primary: null, others: [] };
  let primary: GenreScore | null = scores[0] ?? null;

  /* --------------------- broad 首位のときの細分類への昇格 --------------------- */
  if (primary) {
    const broadDef = getGenre(primary.id);
    if (broadDef?.broad) {
      const broadId = primary.id;
      const broadOwn = buckets.get(broadId)?.own ?? 0;
      const broadConfidence = primary.confidence;
      const candidates = scores.filter((score) => {
        if (score.id === broadId) return false;
        const def = getGenre(score.id);
        if (!def || def.broad) return false;
        const sameFamily = def.family === broadDef.family;
        const supportValue = support.get(score.id) ?? 0;
        return (
          (sameFamily && supportValue >= broadOwn * BROAD_PROMOTION_SUPPORT_RATIO) ||
          score.confidence >= broadConfidence * BROAD_PROMOTION_CONFIDENCE_RATIO
        );
      });

      candidates.sort((a, b) => {
        const aSame = getGenre(a.id)?.family === broadDef.family ? 1 : 0;
        const bSame = getGenre(b.id)?.family === broadDef.family ? 1 : 0;
        if (aSame !== bSame) return bSame - aSame;
        const aSupport = support.get(a.id) ?? 0;
        const bSupport = support.get(b.id) ?? 0;
        return bSupport - aSupport || b.confidence - a.confidence;
      });

      const chosen = candidates[0];
      if (chosen) {
        const chosenDef = getGenre(chosen.id);
        const transferable = Boolean(
          chosenDef && (chosenDef.family === broadDef.family || isDescendantOf(chosen.id, broadId)),
        );
        if (transferable) {
          // 傘の証拠は細分類にも整合するので、重みの半分を移して表示の矛盾を防ぐ
          const transfer = broadOwn * BROAD_TRANSFER_RATIO;
          support.set(chosen.id, (support.get(chosen.id) ?? 0) + transfer);
          support.set(broadId, Math.max(0, broadOwn - transfer));
          const chosenSources = supportSources.get(chosen.id) ?? new Set<SourceName>();
          for (const source of buckets.get(broadId)?.sources ?? []) chosenSources.add(source);
          supportSources.set(chosen.id, chosenSources);
          scores = rebuild();
        }
        const chosenScore = scores.find((score) => score.id === chosen.id) ?? chosen;
        ensurePrimaryTop(chosenScore, scores);
        primary = chosenScore;
        scores = [chosenScore, ...scores.filter((score) => score.id !== chosenScore.id)];
      }
    }
  }

  /* ---------- ゲーム音楽など、coarse ラベルより優先したい細分類への昇格 ---------- */
  const priorityIds = options.priorityIds ?? [];
  if (primary && priorityIds.length > 0) {
    const currentPrimary = primary;
    const primaryDef = getGenre(currentPrimary.id);
    const needsPromotion = Boolean(primaryDef?.broad) || currentPrimary.id === 'soundtrack';
    if (needsPromotion) {
      const candidates = scores
        .filter((score) => priorityIds.includes(score.id) && score.id !== currentPrimary.id)
        .sort((a, b) => b.confidence - a.confidence);
      const chosen = candidates[0];
      if (chosen) {
        // coarse ラベルの重みの半分を優先ジャンルへ移し、表示の矛盾を防ぐ
        const primaryOwn = buckets.get(currentPrimary.id)?.own ?? 0;
        const transfer = primaryOwn * BROAD_TRANSFER_RATIO;
        support.set(chosen.id, (support.get(chosen.id) ?? 0) + transfer);
        support.set(currentPrimary.id, Math.max(0, primaryOwn - transfer));
        const chosenSources = supportSources.get(chosen.id) ?? new Set<SourceName>();
        for (const source of buckets.get(currentPrimary.id)?.sources ?? []) chosenSources.add(source);
        supportSources.set(chosen.id, chosenSources);
        scores = rebuild();
        const chosenScore = scores.find((score) => score.id === chosen.id) ?? chosen;
        ensurePrimaryTop(chosenScore, scores);
        primary = chosenScore;
        scores = [chosenScore, ...scores.filter((score) => score.id !== chosenScore.id)];
      }
    }
  }

  /* --------------- 軽い補正: New Age 誤判定を classical 証拠で上書き --------------- */
  primary = applyClassicalCorrection(primary, scores, evidence);

  /* ----------------------- 過信を抑える（粗いラベルのみ等） ----------------------- */
  if (primary) {
    const primaryDef = getGenre(primary.id);
    if (primaryDef?.broad) {
      const hasFineEvidence = evidence.some(
        (item) =>
          item.canonicalId &&
          (item.source === 'musicbrainz' || item.source === 'lastfm'),
      );
      const cap = hasFineEvidence ? BROAD_CONFIDENCE_CAP : COARSE_CONFIDENCE_CAP;
      for (const score of scores) {
        score.confidence = round3(Math.min(score.confidence, cap));
      }
    }
  }

  if (primary) scores = [primary, ...scores.filter((score) => score.id !== primary?.id).sort(byConfidence)];

  const others = scores.filter((score) => score.id !== primary?.id);
  return { scores: primary ? [primary, ...others] : scores, primary, others };
}

/**
 * iTunes が New Age / Easy Listening に分類しがちな曲でも、
 * MusicBrainz に classical の証拠があればクラシックを優先する（SPEC 外の軽い補正）。
 */
function applyClassicalCorrection(
  primary: GenreScore | null,
  scores: GenreScore[],
  evidence: GenreEvidence[],
): GenreScore | null {
  if (!primary || (primary.id !== 'new-age' && primary.id !== 'easy-listening')) return primary;
  const classical = scores.find((score) => score.id === 'classical');
  if (!classical) return primary;
  const hasClassicalEvidence = evidence.some(
    (item) =>
      item.canonicalId === 'classical' && item.source === 'musicbrainz' && item.weight >= 0.4,
  );
  if (!hasClassicalEvidence) return primary;
  ensurePrimaryTop(classical, scores);
  return classical;
}

/** 信頼度の段階。証拠が無ければ unknown。 */
export function confidenceLevel(confidence: number, matchedEvidenceCount: number): ConfidenceLevel {
  if (matchedEvidenceCount <= 0) return 'unknown';
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.35) return 'medium';
  if (confidence > 0) return 'low';
  return 'unknown';
}

/** 信頼度の日本語ラベル（説明文や caveats で使う）。 */
export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    case 'unknown':
      return '不明';
  }
}
