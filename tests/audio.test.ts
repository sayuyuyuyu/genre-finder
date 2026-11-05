import { describe, expect, it } from 'vitest';
import { classifyAudio } from '../shared/audio/classify';
import {
  extractFeatures,
  fftInPlace,
  fourOnFloorLoop,
  silence,
  sine,
} from '../shared/audio/dsp';

const SR = 22050;

function noise(seconds: number, amplitude = 0.25): Float32Array {
  const samples = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * amplitude;
  return samples;
}

/** キック1・スネア2/4・速いハイハットのブレイクビーツ風ループ。 */
function breakbeatLoop(bpm: number, seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * SR));
  const beat = 60 / bpm;
  const kickLen = Math.round(0.1 * SR);
  const snareLen = Math.round(0.08 * SR);
  const hatLen = Math.round(0.02 * SR);
  const beats = Math.ceil(seconds / beat);
  for (let index = 0; index < beats; index += 1) {
    const start = Math.round(index * beat * SR);
    const isSnare = index % 2 === 1;
    const length = isSnare ? snareLen : kickLen;
    for (let i = 0; i < length && start + i < samples.length; i += 1) {
      const t = i / SR;
      if (isSnare) {
        samples[start + i]! += 0.4 * (Math.random() * 2 - 1) * Math.exp(-t * 40);
      } else {
        samples[start + i]! += 0.8 * Math.sin(2 * Math.PI * (55 + 70 * Math.exp(-t * 40)) * t) * Math.exp(-t * 18);
      }
    }
    // 8分ごとのハイハット
    for (let half = 0; half < 2; half += 1) {
      const hatStart = Math.round((index * beat + (half * beat) / 2) * SR);
      for (let i = 0; i < hatLen && hatStart + i < samples.length; i += 1) {
        samples[hatStart + i]! += 0.12 * (Math.random() * 2 - 1) * Math.exp(-(i / SR) * 120);
      }
    }
  }
  return samples;
}

describe('FFT', () => {
  it('サイン波のピークが正しい周波数ビンに出る', () => {
    const size = 1024;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    const frequency = 1000;
    for (let i = 0; i < size; i += 1) re[i] = Math.sin((2 * Math.PI * frequency * i) / SR);
    fftInPlace(re, im);
    let peakBin = 1;
    let peak = 0;
    for (let bin = 1; bin < size / 2; bin += 1) {
      const magnitude = Math.hypot(re[bin]!, im[bin]!);
      if (magnitude > peak) {
        peak = magnitude;
        peakBin = bin;
      }
    }
    expect(Math.abs((peakBin * SR) / size - frequency)).toBeLessThan(60);
  });
});

describe('音響特徴（DSP）', () => {
  it('4つ打ち128BPMのループからテンポと4つ打ちを検出する', () => {
    const { features } = extractFeatures(fourOnFloorLoop(128, 12, SR), SR);
    expect(features.bpm).toBeGreaterThan(118);
    expect(features.bpm).toBeLessThan(140);
    expect(features.fourOnFloor).toBeGreaterThan(0.25);
    const verdict = classifyAudio(features);
    const ids = verdict.votes.map((vote) => vote.id);
    expect(ids.some((id) => ['house', 'dance', 'techno', 'trance'].includes(id))).toBe(true);
    expect(verdict.confidence).toBeGreaterThan(0.2);
  });

  it('174BPMのブレイクビーツからDnB系の票が出る', () => {
    const { features } = extractFeatures(breakbeatLoop(174, 12), SR);
    expect(features.bpm).toBeGreaterThan(160);
    expect(features.bpm).toBeLessThan(190);
    const ids = classifyAudio(features).votes.map((vote) => vote.id);
    expect(ids.some((id) => ['drum-and-bass', 'breakcore', 'speedcore'].includes(id))).toBe(true);
  });

  it('ホワイトノイズでは断定しない（票を出さない）', () => {
    const { features } = extractFeatures(noise(8), SR);
    expect(features.flatness).toBeGreaterThan(0.2);
    expect(classifyAudio(features).votes).toEqual([]);
  });

  it('サイン波は静かな系（アンビエント/クラシック）に寄る', () => {
    const { features } = extractFeatures(sine(440, 8, SR), SR);
    expect(features.onsetDensity).toBeLessThan(1);
    const ids = classifyAudio(features).votes.map((vote) => vote.id);
    expect(ids.some((id) => ['ambient', 'classical'].includes(id))).toBe(true);
  });

  it('無音では票を出さず BPM も 0', () => {
    const { features } = extractFeatures(silence(5, SR), SR);
    expect(features.bpm).toBe(0);
    const verdict = classifyAudio(features);
    expect(verdict.votes).toEqual([]);
    expect(verdict.confidence).toBe(0);
  });

  it('無音区間があっても特徴量は 0-1 に収まる', () => {
    const samples = new Float32Array(Math.round(6 * SR));
    const tone = sine(440, 2, SR);
    samples.set(tone, 0); // 2秒音 → 4秒無音
    const { features } = extractFeatures(samples, SR);
    expect(features.flatness).toBeGreaterThanOrEqual(0);
    expect(features.flatness).toBeLessThanOrEqual(1);
    expect(features.lowRatio).toBeLessThanOrEqual(1);
    expect(features.highRatio).toBeLessThanOrEqual(1);
  });

  it('短すぎる音声は解析対象外', () => {
    const { features } = extractFeatures(sine(440, 1, SR), SR);
    expect(classifyAudio(features).votes).toEqual([]);
  });
});

describe('実音源の特徴量からの分類（キャリブレーション）', () => {
  const base = {
    bpm: 0,
    tempoConfidence: 0.4,
    fourOnFloor: 0,
    onsetDensity: 2,
    brightness: 2200,
    flatness: 0.35,
    lowRatio: 0.5,
    highRatio: 0.015,
    dynamicRange: 15,
    zeroCrossingRate: 0.16,
    rms: 0.2,
    durationSec: 20,
  };

  const ids = (features: Partial<typeof base>): string[] =>
    classifyAudio({ ...base, ...features }).votes.map((vote) => vote.id);

  it('4つ打ち・117BPM・低域強めはハウス系', () => {
    const result = ids({ bpm: 117, fourOnFloor: 0.85, brightness: 2206, flatness: 0.354, lowRatio: 0.575 });
    expect(result[0]).toBe('house');
    expect(result).toContain('dance');
  });

  it('4つ打ち・129BPM・明るい音はダンス/ハウス系', () => {
    const result = ids({ bpm: 129, fourOnFloor: 0.95, brightness: 2584, flatness: 0.343, lowRatio: 0.553 });
    expect(result).toContain('house');
    expect(result).toContain('dance');
  });

  it('歪みが少なく低域の効いたロックはロック', () => {
    const result = ids({ bpm: 144, fourOnFloor: 0.04, brightness: 1337, flatness: 0.178, lowRatio: 0.622 });
    expect(result[0]).toBe('rock');
  });

  it('高域成分が多く硬い音はチップチューン', () => {
    const result = ids({ bpm: 136, fourOnFloor: 0, brightness: 2956, flatness: 0.49, lowRatio: 0.207, highRatio: 0.063, onsetDensity: 3.1 });
    expect(result[0]).toBe('chiptune');
  });

  it('低速・少ない打楽器・低域少なめはジャズ（4つ打ち気味でも）', () => {
    const result = ids({ bpm: 83, fourOnFloor: 0, brightness: 2598, flatness: 0.428, lowRatio: 0.146, onsetDensity: 1.3 });
    expect(result[0]).toBe('jazz');
    const steady = ids({ bpm: 83, fourOnFloor: 0.53, brightness: 2598, flatness: 0.428, lowRatio: 0.146, onsetDensity: 1.3 });
    expect(steady[0]).toBe('jazz');
  });

  it('ハーフタイムで低域の強いビートはヒップホップ', () => {
    const result = ids({ bpm: 152, fourOnFloor: 0, lowRatio: 0.859, flatness: 0.305, onsetDensity: 2 });
    expect(result[0]).toBe('hip-hop');
  });

  it('遅め・打楽器少なめはR&B', () => {
    const result = ids({ bpm: 86, fourOnFloor: 0.22, lowRatio: 0.637, flatness: 0.396, onsetDensity: 0.55 });
    expect(result[0]).toBe('r-and-b');
  });
});
