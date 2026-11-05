import { describe, expect, it } from 'vitest';
import { detectGameMusic, type GameDetectionField } from '../functions/_lib/game-detect';

function field(
  label: string,
  text: string,
  source: GameDetectionField['source'] = 'itunes',
  scale = 1,
): GameDetectionField {
  return { label, text, source, scale };
}

function ids(fields: GameDetectionField[]): string[] {
  return detectGameMusic(fields).map((detection) => detection.canonicalId);
}

describe('detectGameMusic（ゲーム音楽らしさの検出）', () => {
  it('東方Project は touhou-arrange', () => {
    const detections = detectGameMusic([field('アルバム名', '東方Project ～ 東方アレンジ集')]);
    expect(detections.map((d) => d.canonicalId)).toContain('touhou-arrange');
    expect(detections[0]?.weight).toBeGreaterThanOrEqual(0.5);
    expect(detections[0]?.note).toContain('東方');
  });

  it('BMS / beatmania は rhythm-game', () => {
    expect(ids([field('曲名', 'BMS 音ゲーアンセム')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'beatmania IIDX 20th Anniversary')])).toContain('rhythm-game');
  });

  it('ファミコン / 8bit は chiptune', () => {
    expect(ids([field('アルバム名', 'ファミコンサウンドトラック')])).toContain('chiptune');
    expect(ids([field('曲名', '8bit Adventure')])).toContain('chiptune');
  });

  it('FM音源 / PC-98 は fm-synth', () => {
    expect(ids([field('アルバム名', 'PC-98 FM音源全集')])).toContain('fm-synth');
  });

  it('ゲーム音楽 / Original Soundtrack は game-music', () => {
    expect(ids([field('アルバム名', 'ゲーム音楽ベスト')])).toContain('game-music');
    expect(ids([field('アルバム名', 'Original Soundtrack')])).toContain('game-music');
  });

  it('ノベルゲーム系は visual-novel', () => {
    expect(ids([field('アルバム名', 'ノベルゲーム主題歌集')])).toContain('visual-novel');
  });

  it('ボカロは vocaloid', () => {
    expect(ids([field('曲名', 'ボカロ名曲集')])).toContain('vocaloid');
  });

  it('ゲーム固有語が無ければ何も返さない', () => {
    expect(detectGameMusic([field('アルバム名', 'Random Access Memories')])).toEqual([]);
    expect(detectGameMusic([field('曲名', 'Get Lucky'), field('アーティスト名', 'Daft Punk')])).toEqual([]);
  });

  it('同じジャンルは最大重みの1件にまとめる', () => {
    const detections = detectGameMusic([
      field('アルバム名', 'ゲーム音楽'),
      field('曲名', 'ゲーム', 'itunes', 0.8),
    ]);
    const game = detections.filter((d) => d.canonicalId === 'game-music');
    expect(game).toHaveLength(1);
    expect(game[0]?.weight).toBeGreaterThanOrEqual(0.6);
  });
});
