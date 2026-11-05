import { classifyAudio, describeAudio, type AudioVerdict } from '@shared/audio/classify';
import { extractFeatures, type AudioFeatures } from '@shared/audio/dsp';

/**
 * プレビュー音源を取得・デコードして、自作の音響解析をかける。
 * iTunes のプレビューは CORS を許可しているので、ブラウザから直接読める。
 */

export interface AcousticResult {
  features: AudioFeatures;
  featuresText: string;
  verdict: AudioVerdict;
}

const TARGET_SAMPLE_RATE = 22_050;
/** 解析に使う最大秒数（長い音源でも待たせすぎない）。 */
const MAX_SECONDS = 20;
const FETCH_TIMEOUT_MS = 8_000;

const cache = new Map<string, AcousticResult>();

/** 音源を取得してモノラル 22.05kHz に変換し、Float32Array にする。 */
async function decodeToMono(url: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`audio fetch failed: ${response.status}`);

  const data = await response.arrayBuffer();
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(data);
    const seconds = Math.min(buffer.duration, MAX_SECONDS);
    const frames = Math.max(1, Math.floor(seconds * TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return { samples: rendered.getChannelData(0).slice(), sampleRate: TARGET_SAMPLE_RATE };
  } finally {
    void context.close();
  }
}

/** プレビューURLを解析する。同じURLは使い回す。 */
export async function analyzePreview(url: string): Promise<AcousticResult> {
  const cached = cache.get(url);
  if (cached) return cached;

  const { samples, sampleRate } = await decodeToMono(url);
  // UI を固めないよう、解析は次のタスクで実行する
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  const { features } = extractFeatures(samples, sampleRate);
  const result: AcousticResult = {
    features,
    featuresText: describeAudio(features),
    verdict: classifyAudio(features),
  };
  cache.set(url, result);
  return result;
}

/** 解析結果を破棄する（テスト用）。 */
export function clearAcousticCache(): void {
  cache.clear();
}
