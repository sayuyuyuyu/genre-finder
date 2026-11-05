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

  it('ホワイトノイズはロック/メタル寄りになる', () => {
    const { features } = extractFeatures(noise(8), SR);
    expect(features.flatness).toBeGreaterThan(0.2);
    const ids = classifyAudio(features).votes.map((vote) => vote.id);
    expect(ids.some((id) => ['rock', 'metal'].includes(id))).toBe(true);
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

  it('短すぎる音声は解析対象外', () => {
    const { features } = extractFeatures(sine(440, 1, SR), SR);
    expect(classifyAudio(features).votes).toEqual([]);
  });
});
