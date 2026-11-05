/**
 * 音響特徴の抽出（純粋関数）。
 * ブラウザでデコードした音声（モノラル / 22.05kHz 程度）を受け取り、
 * テンポ・ビートの規則性・4つ打ち・音色などを数値にする。
 *
 * 外部モデルは使わず、FFT と自己相関だけで特徴を出す。
 */

export interface AudioFeatures {
  /** 推定 BPM（40〜220）。判定できなければ 0。 */
  bpm: number;
  /** テンポの確からしさ 0-1（自己相関のピークの強さ）。 */
  tempoConfidence: number;
  /** 4つ打ち（キックが4分音符で揃っている）スコア 0-1。 */
  fourOnFloor: number;
  /** 1秒あたりの音の立ち上がり数（打楽器っぽさ）。 */
  onsetDensity: number;
  /** スペクトル重心の平均（Hz）。明るさ。 */
  brightness: number;
  /** スペクトル平坦度の平均 0-1。ノイズ・歪みっぽさ。 */
  flatness: number;
  /** 低域（150Hz以下）エネルギー比 0-1。 */
  lowRatio: number;
  /** 高域（4kHz以上）エネルギー比 0-1。 */
  highRatio: number;
  /** 音量の振れ幅（dB）。小さいほど一定。 */
  dynamicRange: number;
  /** ゼロ交差率 0-1。ノイズ・歪みの目安。 */
  zeroCrossingRate: number;
  /** 平均音量（RMS, 0-1）。無音判定に使う。 */
  rms: number;
  /** 解析に使った秒数。 */
  durationSec: number;
}

export interface AudioAnalysis {
  features: AudioFeatures;
  /** フレームごとの低域エネルギー（テストや可視化用）。 */
  lowBandEnvelope: number[];
}

const FFT_SIZE = 1024;
const HOP_SIZE = 512;

/* --------------------------------- FFT --------------------------------- */

/** 実数信号の簡易 FFT（in-place, radix-2）。 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // ビット反転
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const rev = re[i]!;
      re[i] = re[j]!;
      re[j] = rev;
      const imv = im[i]!;
      im[i] = im[j]!;
      im[j] = imv;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const aRe = re[i + k]!;
        const aIm = im[i + k]!;
        const bRe = re[i + k + len / 2]!;
        const bIm = im[i + k + len / 2]!;
        const tRe = bRe * curRe - bIm * curIm;
        const tIm = bRe * curIm + bIm * curRe;
        re[i + k] = aRe + tRe;
        im[i + k] = aIm + tIm;
        re[i + k + len / 2] = aRe - tRe;
        im[i + k + len / 2] = aIm - tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

/* ------------------------------ 特徴抽出 ------------------------------ */

function frameEnergy(samples: Float32Array, start: number, size: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + size);
  for (let i = start; i < end; i += 1) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** 簡易ローパス（一次 IIR）で低域成分を取り出す。 */
function lowPass(samples: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const out = new Float32Array(samples.length);
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  let previous = 0;
  for (let i = 0; i < samples.length; i += 1) {
    previous += alpha * (samples[i]! - previous);
    out[i] = previous;
  }
  return out;
}

/** 自己相関からテンポ（BPM）を推定する。 */
function estimateTempo(
  onset: Float64Array,
  framesPerSecond: number,
): { bpm: number; confidence: number } {
  const minBpm = 40;
  const maxBpm = 220;
  const minLag = Math.max(1, Math.round((60 / maxBpm) * framesPerSecond));
  const maxLag = Math.min(onset.length - 1, Math.round((60 / minBpm) * framesPerSecond));
  if (maxLag <= minLag) return { bpm: 0, confidence: 0 };

  let mean = 0;
  for (const value of onset) mean += value;
  mean /= onset.length;
  const centered = Float64Array.from(onset, (value) => value - mean);

  let totalEnergy = 0;
  for (const value of centered) totalEnergy += value * value;
  if (totalEnergy <= 0) return { bpm: 0, confidence: 0 };

  const scores: Array<{ bpm: number; score: number }> = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < centered.length; i += 1) sum += centered[i]! * centered[i + lag]!;
    scores.push({ bpm: (60 * framesPerSecond) / lag, score: sum / totalEnergy });
  }
  if (scores.length === 0) return { bpm: 0, confidence: 0 };

  let best = scores[0]!;
  for (const candidate of scores) if (candidate.score > best.score) best = candidate;

  // 倍音の取り違えを補正して 70〜180 BPM に寄せる
  let bpm = best.bpm;
  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  return { bpm, confidence: Math.max(0, Math.min(1, best.score)) };
}

/** 低域の立ち上がりが4分音符の格子に乗っているかを 0-1 で返す。 */
function fourOnFloorScore(lowEnergy: Float64Array, bpm: number, framesPerSecond: number): number {
  if (bpm <= 0) return 0;
  const beatsPerSecond = bpm / 60;
  const framesPerBeat = framesPerSecond / beatsPerSecond;
  if (!Number.isFinite(framesPerBeat) || framesPerBeat < 1) return 0;

  let mean = 0;
  for (const value of lowEnergy) mean += value;
  mean /= Math.max(1, lowEnergy.length);

  // 拍の格子に乗っているフレームの低域エネルギーが、全体平均よりどれだけ強いか
  let onBeat = 0;
  let offBeat = 0;
  let onCount = 0;
  let offCount = 0;
  for (let frame = 0; frame < lowEnergy.length; frame += 1) {
    const position = frame % framesPerBeat;
    const distance = Math.min(position, framesPerBeat - position);
    if (distance <= 1.5) {
      onBeat += lowEnergy[frame]!;
      onCount += 1;
    } else if (distance >= framesPerBeat / 2 - 1.5 && distance <= framesPerBeat / 2 + 1.5) {
      offBeat += lowEnergy[frame]!;
      offCount += 1;
    }
  }
  if (onCount === 0) return 0;
  const onAverage = onBeat / onCount;
  const offAverage = offCount > 0 ? offBeat / offCount : mean;
  if (onAverage <= 0) return 0;
  const contrast = (onAverage - offAverage) / onAverage;
  return Math.max(0, Math.min(1, contrast * 1.6));
}

/** 音声（モノラル）から特徴を抽出する。 */
export function extractFeatures(samples: Float32Array, sampleRate: number): AudioAnalysis {
  const durationSec = samples.length / sampleRate;
  const window = hannWindow(FFT_SIZE);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const nyquistBin = FFT_SIZE / 2;

  const lowBand = lowPass(samples, sampleRate, 150);
  const lowEnergies: number[] = [];
  const energies: number[] = [];
  const centroidValues: number[] = [];
  const flatnessValues: number[] = [];
  const fluxValues: number[] = [];
  let lowEnergyTotal = 0;
  let highEnergyTotal = 0;
  let totalEnergy = 0;
  let zeroCrossings = 0;
  let previousSpectrum: Float64Array | null = null;

  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    let energy = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const sample = samples[start + i]!;
      re[i] = sample * window[i]!;
      im[i] = 0;
      energy += sample * sample;
    }
    fftInPlace(re, im);

    let centroidNumerator = 0;
    let magnitudeSum = 0;
    let logSum = 0;
    let magnitudeSquaredSum = 0;
    let frameLow = 0;
    let frameHigh = 0;
    const spectrum = new Float64Array(nyquistBin);
    for (let bin = 1; bin < nyquistBin; bin += 1) {
      const magnitude = Math.hypot(re[bin]!, im[bin]!);
      spectrum[bin] = magnitude;
      const frequency = (bin * sampleRate) / FFT_SIZE;
      centroidNumerator += frequency * magnitude;
      magnitudeSum += magnitude;
      logSum += Math.log(magnitude + 1e-9);
      magnitudeSquaredSum += magnitude * magnitude;
      if (frequency <= 150) frameLow += magnitude * magnitude;
      if (frequency >= 4000) frameHigh += magnitude * magnitude;
    }
    let frameTotal = 0;
    for (let bin = 1; bin < nyquistBin; bin += 1) {
      const magnitude = spectrum[bin]!;
      frameTotal += magnitude * magnitude;
    }
    const centroid = magnitudeSum > 0 ? centroidNumerator / magnitudeSum : 0;
    const flatness =
      magnitudeSum > 0
        ? Math.exp(logSum / (nyquistBin - 1)) / (magnitudeSum / (nyquistBin - 1) + 1e-12)
        : 0;

    let flux = 0;
    if (previousSpectrum) {
      for (let bin = 1; bin < nyquistBin; bin += 1) {
        const diff = spectrum[bin]! - previousSpectrum[bin]!;
        if (diff > 0) flux += diff;
      }
    }
    previousSpectrum = spectrum;
    // フレームの大きさで正規化する（定常音のわずかな揺らぎを拾わない）
    const relativeFlux = magnitudeSum > 0 ? flux / magnitudeSum : 0;

    energies.push(Math.sqrt(energy / FFT_SIZE));
    centroidValues.push(centroid);
    flatnessValues.push(flatness);
    fluxValues.push(relativeFlux);
    lowEnergies.push(frameEnergy(lowBand, start, FFT_SIZE));
    lowEnergyTotal += frameLow;
    highEnergyTotal += frameHigh;
    totalEnergy += frameTotal;

    for (let i = 1; i < FFT_SIZE; i += 1) {
      if ((samples[start + i]! >= 0) !== (samples[start + i - 1]! >= 0)) zeroCrossings += 1;
    }
  }

  // 立ち上がり（スペクトルフラックス）からオンセット包絡を作る
  const onset = Float64Array.from(fluxValues);
  const onsetMean = onset.reduce((sum, value) => sum + value, 0) / Math.max(1, onset.length);
  const onsetTotal = onset.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < onset.length; i += 1) onset[i] = Math.max(0, onset[i]! - onsetMean * 0.8);

  const framesPerSecond = sampleRate / HOP_SIZE;
  // 立ち上がりの強さでしきい値を決める（定常音のわずかな揺らぎを拾わない）
  const onsetVariance =
    onset.reduce((sum, value) => sum + (value - onsetMean) ** 2, 0) / Math.max(1, onset.length);
  // 定常音のわずかな揺らぎを拾わないよう、絶対的な下限も設ける
  const ONSET_FLOOR = 0.008;
  const onsetThreshold = Math.max(ONSET_FLOOR, onsetMean + Math.sqrt(onsetVariance) * 0.6);
  let onsetPeaks = 0;
  for (let i = 0; i < onset.length; i += 1) {
    if (onset[i]! > onsetThreshold && onset[i]! > (onset[i - 1] ?? 0)) onsetPeaks += 1;
  }

  let bpm = 0;
  let confidence = 0;
  if (onsetTotal > 0.05) {
    const tempo = estimateTempo(onset, framesPerSecond);
    bpm = tempo.bpm;
    confidence = tempo.confidence;
  }
  const onsetDensity = onsetPeaks / Math.max(1, durationSec);

  // ハーフタイム（半分のBPM）に寄りすぎた場合は、細かいノリなら倍にする
  if (bpm > 0 && bpm < 100 && onsetDensity >= 3) bpm = Math.min(220, bpm * 2);
  while (bpm > 0 && bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  const fourOnFloor = fourOnFloorScore(Float64Array.from(lowEnergies), bpm, framesPerSecond);

  const meanOf = (values: number[]): number =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const meanEnergy = meanOf(energies);

  const sortedEnergies = [...energies].sort((a, b) => a - b);
  const percentile = (p: number): number =>
    sortedEnergies[Math.min(sortedEnergies.length - 1, Math.floor(p * sortedEnergies.length))] ?? 0;
  const dynamicRange =
    20 * Math.log10((percentile(0.95) + 1e-6) / (percentile(0.05) + 1e-6));

  const sampleCount = Math.max(1, samples.length);

  return {
    features: {
      bpm,
      tempoConfidence: confidence,
      fourOnFloor,
      onsetDensity,
      brightness: meanOf(centroidValues),
      flatness: meanOf(flatnessValues),
      lowRatio: totalEnergy > 0 ? lowEnergyTotal / totalEnergy : 0,
      highRatio: totalEnergy > 0 ? highEnergyTotal / totalEnergy : 0,
      dynamicRange: Math.max(0, dynamicRange),
      zeroCrossingRate: zeroCrossings / sampleCount,
      rms: meanEnergy,
      durationSec,
    },
    lowBandEnvelope: [...lowEnergies],
  };
}

/** テスト用: 指定した長さ・サンプルレートの無音を作る。 */
export function silence(seconds: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.round(seconds * sampleRate));
}

/** テスト用: 指定周波数のサイン波を作る。 */
export function sine(frequency: number, seconds: number, sampleRate: number, amplitude = 0.5): Float32Array {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return samples;
}

/** テスト用: キック + ハイハットで4つ打ちのループを作る。 */
export function fourOnFloorLoop(bpm: number, seconds: number, sampleRate: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  const beatSeconds = 60 / bpm;
  const kickLength = Math.round(0.12 * sampleRate);
  const hatLength = Math.round(0.03 * sampleRate);
  for (let beat = 0; beat < Math.ceil(seconds / beatSeconds); beat += 1) {
    const start = Math.round(beat * beatSeconds * sampleRate);
    for (let i = 0; i < kickLength && start + i < samples.length; i += 1) {
      const t = i / sampleRate;
      // 減衰する低いキック
      samples[start + i]! += 0.9 * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 22);
    }
    const hatStart = start + Math.round((beatSeconds * sampleRate) / 2);
    for (let i = 0; i < hatLength && hatStart + i < samples.length; i += 1) {
      samples[hatStart + i]! += 0.15 * (Math.random() * 2 - 1) * Math.exp(-(i / sampleRate) * 90);
    }
  }
  return samples;
}
