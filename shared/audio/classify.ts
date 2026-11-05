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
 * BPM と 4つ打ち、ノリの量、音色（明るさ・ノイズっぽさ）だけを使う。
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
    zeroCrossingRate,
    rms,
    durationSec,
  } = features;

  // 短すぎる・ほぼ無音なら何も言わない
  if (durationSec < 2 || rms < 0.01) return { votes: [], confidence: 0 };

  const hasTempo = tempoConfidence >= 0.12 && bpm > 0;
  const danceable = fourOnFloor >= 0.4;
  const noisy = flatness >= 0.22 || zeroCrossingRate >= 0.08;

  /* ----------------------------- 静かな系 ----------------------------- */
  if (onsetDensity < 1.2 && !danceable) {
    if (brightness < 1800 && tempoConfidence < 0.2) {
      push(votes, 'ambient', 0.55, '打楽器が少なく、低くこもった音');
    } else if (tempoConfidence < 0.25) {
      push(votes, 'classical', 0.5, '拍が強くなく、音色が中心');
    }
  }

  /* ----------------------------- 4つ打ち系 ----------------------------- */
  if (danceable && hasTempo) {
    if (bpm >= 112 && bpm <= 132) {
      push(votes, 'house', 0.7, `4つ打ち・${Math.round(bpm)}BPM`);
      if (brightness > 2600) push(votes, 'trance', 0.45, '明るく広がる音');
      if (lowRatio > 0.35 && flatness < 0.16) push(votes, 'techno', 0.4, '低音が硬く反復的');
      push(votes, 'dance', 0.35, 'ダンスビート');
    } else if (bpm > 132 && bpm <= 155) {
      push(votes, 'trance', 0.55, `速めの4つ打ち・${Math.round(bpm)}BPM`);
      if (noisy && flatness > 0.3) push(votes, 'hardstyle', 0.45, '歪んだキック');
    } else if (bpm >= 95 && bpm < 112) {
      push(votes, 'dance', 0.5, `ゆったりした4つ打ち・${Math.round(bpm)}BPM`);
    }
  }

  /* --------------------------- 高速ビート系 --------------------------- */
  if (hasTempo && bpm >= 155) {
    if (onsetDensity >= 2.4) {
      if (bpm >= 190 && onsetDensity >= 4) {
        push(votes, 'speedcore', 0.6, `超高速・${Math.round(bpm)}BPM`);
      } else if (bpm >= 165 && bpm <= 185) {
        push(votes, 'drum-and-bass', 0.6, `170前後のブレイクビーツ`);
      } else {
        push(votes, 'breakcore', 0.45, '細かく刻むビート');
      }
    }
  }

  /* ------------------------------ ヒップホップ ------------------------------ */
  if (hasTempo && bpm >= 60 && bpm <= 105 && !danceable && onsetDensity >= 1.5) {
    if (lowRatio >= 0.3) push(votes, 'hip-hop', 0.55, `低音の効いた${Math.round(bpm)}BPM`);
    else push(votes, 'hip-hop', 0.4, `${Math.round(bpm)}BPMのビート`);
  }

  /* -------------------------------- ロック系 -------------------------------- */
  if (noisy && !danceable && zeroCrossingRate >= 0.05) {
    if (flatness >= 0.35 || brightness >= 3200) {
      push(votes, 'metal', 0.45, '歪みが強く高域が多い');
      push(votes, 'rock', 0.35, 'ギターらしいノイズ成分');
    } else {
      push(votes, 'rock', 0.55, '歪んだ音と生ドラム');
    }
  }

  /* ------------------------------ チップチューン ------------------------------ */
  if (
    hasTempo &&
    flatness <= 0.14 &&
    highRatio >= 0.16 &&
    zeroCrossingRate >= 0.03 &&
    brightness >= 1500
  ) {
    push(votes, 'chiptune', 0.45, '高い倍音が多く、音が硬い');
  }

  /* -------------------------------- ジャズ系 -------------------------------- */
  if (
    hasTempo &&
    !danceable &&
    onsetDensity >= 1 &&
    onsetDensity <= 3 &&
    flatness < 0.2 &&
    bpm >= 90 &&
    bpm <= 170
  ) {
    push(votes, 'jazz', 0.3, 'スウィングしやすいテンポと音色');
  }

  /* ------------------------------- ポップス ------------------------------- */
  if (hasTempo && votes.length === 0) {
    push(votes, 'pop', 0.3, `強くはないが${Math.round(bpm)}BPMのビート`);
  }

  votes.sort((a, b) => b.weight - a.weight);
  const top = votes[0];
  const confidence = top
    ? Math.max(0, Math.min(1, top.weight * (0.5 + 0.5 * Math.min(1, tempoConfidence * 2))))
    : 0;

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
