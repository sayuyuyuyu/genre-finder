/**
 * 自作のジャンル推定（ルールベース）。
 * 音響特徴から、どのジャンルっぽいかの票を作る。
 *
 * 方針:
 * - 外部モデル・外部APIは使わない（音そのものだけを見る）
 * - 断定しない。複数の候補に重みを付け、当てはまらなければ票を出さない
 * - メタデータ判定の代わりではなく「もう一つの意見」として使う
 */

import type { AudioFeatures } from './dsp';

export interface AudioVote {
  /** taxonomy のジャンル ID（shared/genre/taxonomy.ts）。 */
  id: string;
  /** 0-1。ルールの強さ。 */
  weight: number;
  /** 画面に出す短い理由。 */
  reason: string;
}

export interface AudioVerdict {
  votes: AudioVote[];
  /** 全体の確からしさ 0-1。 */
  confidence: number;
}

function push(votes: AudioVote[], id: string, weight: number, reason: string): void {
  if (weight <= 0) return;
  const existing = votes.find((vote) => vote.id === id);
  if (existing) {
    existing.weight = Math.min(1, existing.weight + weight * 0.5);
    if (!existing.reason.includes(reason)) existing.reason = `${existing.reason}・${reason}`;
    return;
  }
  votes.push({ id, weight: Math.min(1, weight), reason });
}

/**
 * 音響特徴からジャンルの票を作る。
 * 実音源で測った値をもとに、当てはまりの強いルールだけを発火させる。
 */
export function classifyAudio(features: AudioFeatures): AudioVerdict {
  const votes: AudioVote[] = [];
  const {
    bpm,
    tempoConfidence,
    fourOnFloor,
    onsetDensity,
    brightness,
    flatness,
    lowRatio,
    highRatio,
    rms,
    durationSec,
  } = features;

  // 短すぎる・ほぼ無音・ノイズすぎる音は何も言わない
  if (durationSec < 2 || rms < 0.01) return { votes: [], confidence: 0 };
  if (highRatio >= 0.25) return { votes: [], confidence: 0 };

  const hasTempo = bpm > 0 && tempoConfidence >= 0.25;
  const danceable = fourOnFloor >= 0.5;

  /* ----------------------------- 静かな系 ----------------------------- */
  if (onsetDensity < 1 && tempoConfidence < 0.2) {
    push(votes, brightness < 1800 ? 'ambient' : 'classical', 0.5, '打楽器が少なく音色が中心');
  }

  /* ----------------------------- 4つ打ち系 ----------------------------- */
  if (danceable && hasTempo) {
    if (bpm >= 112 && bpm <= 135) {
      push(votes, 'house', 0.6, `4つ打ち・${Math.round(bpm)}BPM`);
      if (brightness > 2400) push(votes, 'trance', 0.35, '明るく広がる音');
      if (flatness < 0.3 && lowRatio > 0.4) push(votes, 'techno', 0.3, '低音が硬く反復的');
      push(votes, 'dance', 0.3, 'ダンスビート');
    } else if (bpm > 135 && bpm <= 158) {
      push(votes, 'trance', 0.5, `速めの4つ打ち・${Math.round(bpm)}BPM`);
      push(votes, 'dance', 0.25, 'ダンスビート');
    } else if (bpm >= 90 && bpm < 112) {
      push(votes, 'dance', 0.5, `ゆったりした4つ打ち・${Math.round(bpm)}BPM`);
    }
  }

  /* --------------------------- 高速ビート系 --------------------------- */
  if (hasTempo && bpm >= 155 && onsetDensity >= 2.4) {
    if (bpm >= 190 && onsetDensity >= 3.5) {
      push(votes, 'speedcore', 0.5, `超高速・${Math.round(bpm)}BPM`);
    } else if (bpm >= 160 && bpm <= 190) {
      push(votes, 'drum-and-bass', 0.55, `${Math.round(bpm)}BPMのブレイクビーツ`);
    }
  }

  /* ------------------------------ ヒップホップ ------------------------------ */
  if (hasTempo && !danceable) {
    if (bpm >= 60 && bpm <= 110 && lowRatio >= 0.45 && onsetDensity >= 1) {
      push(votes, 'hip-hop', 0.5, `低音の効いた${Math.round(bpm)}BPM`);
    } else if (bpm >= 138 && bpm <= 160 && lowRatio >= 0.7) {
      push(votes, 'hip-hop', 0.45, 'ハーフタイムの低音ビート');
    }
  }

  /* --------------------------------- R&B --------------------------------- */
  if (hasTempo && onsetDensity < 1 && bpm >= 70 && bpm <= 112 && flatness >= 0.3) {
    push(votes, 'r-and-b', 0.4, '落ち着いたテンポと音色');
  }

  /* -------------------------------- ロック系 -------------------------------- */
  if (!danceable && onsetDensity >= 1.5) {
    if (flatness < 0.25 && brightness < 1900) {
      push(votes, 'rock', 0.5, '歪んだ音と生ドラム');
    } else if (flatness < 0.22 && brightness >= 1900) {
      push(votes, 'rock', 0.35, 'ギターらしい倍音');
    }
  }

  /* ------------------------------ チップチューン ------------------------------ */
  if (hasTempo && highRatio >= 0.045 && brightness >= 2500 && flatness >= 0.4 && bpm >= 110) {
    push(votes, 'chiptune', 0.45, '高い倍音が多く音が硬い');
  }

  /* -------------------------------- ジャズ系 -------------------------------- */
  if (
    hasTempo &&
    onsetDensity >= 1 &&
    onsetDensity <= 2.6 &&
    bpm >= 70 &&
    bpm <= 118 &&
    flatness >= 0.35 &&
    lowRatio < 0.25
  ) {
    push(votes, 'jazz', 0.45, 'スウィングしやすいテンポと音色');
  }

  /* ------------------------------- ポップス ------------------------------- */
  if (hasTempo && votes.length === 0) {
    push(votes, 'pop', 0.3, `強くはないが${Math.round(bpm)}BPMのビート`);
  }

  votes.sort((a, b) => b.weight - a.weight);
  const top = votes[0];
  const tempoFactor = hasTempo ? 0.5 + 0.5 * Math.min(1, tempoConfidence * 2) : 0.6;
  const confidence = top ? Math.max(0, Math.min(1, top.weight * tempoFactor)) : 0;

  return { votes: votes.slice(0, 4), confidence };
}

/** 音響特徴を画面表示用の短い一行にする（数値の羅列）。 */
export function describeAudio(features: AudioFeatures): string {
  const parts: string[] = [];
  if (features.bpm > 0) parts.push(`${Math.round(features.bpm)} BPM`);
  parts.push(`4OTF ${Math.round(features.fourOnFloor * 100)}%`);
  parts.push(`明るさ ${Math.round(features.brightness)}`);
  parts.push(`ノイズ ${Math.round(features.flatness * 100)}%`);
  return parts.join(' · ');
}
