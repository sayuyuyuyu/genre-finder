import { describe, expect, it } from 'vitest';
import { detectGameMusic, detectGameWork, type GameDetectionField } from '../functions/_lib/game-detect';

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

describe('detectGameWork（ゲーム作品名の検出）', () => {
  it('Undertale → UNDERTALE', () => {
    expect(detectGameWork([field('アルバム名', 'Undertale Soundtrack')])).toBe('UNDERTALE');
  });

  it('東方Project → 東方Project', () => {
    expect(detectGameWork([field('アルバム名', '東方Project ～ 東方アレンジ集')])).toBe('東方Project');
  });

  it('Touhou 表記でも 東方Project', () => {
    expect(detectGameWork([field('アルバム名', 'Touhou Philharmonic Orchestra 1')])).toBe('東方Project');
  });

  it('beatmania IIDX / BMS → beatmania IIDX', () => {
    expect(detectGameWork([field('アルバム名', 'beatmania IIDX 20th Anniversary')])).toBe(
      'beatmania IIDX',
    );
    expect(detectGameWork([field('曲名', 'BMS 音ゲーアンセム')])).toBe('beatmania IIDX');
  });

  it('Deltarune → DELTARUNE', () => {
    expect(detectGameWork([field('アルバム名', 'DELTARUNE Chapter 2 OST')])).toBe('DELTARUNE');
  });

  it('Final Fantasy → FINAL FANTASY', () => {
    expect(detectGameWork([field('アルバム名', 'Final Fantasy VII Remake')])).toBe('FINAL FANTASY');
  });

  it('ポケモン → ポケモン', () => {
    expect(detectGameWork([field('アルバム名', 'ポケモン サウンドトラック')])).toBe('ポケモン');
  });

  it('東方の代表曲名からも 東方Project を推定する', () => {
    expect(detectGameWork([field('曲名', 'Bad Apple!!')])).toBe('東方Project');
    expect(detectGameWork([field('曲名', 'U.N. Owen was Her?')])).toBe('東方Project');
  });

  it('全角・小文字表記も吸収する', () => {
    expect(detectGameWork([field('アルバム名', 'ＵＮＤＥＲＴＡＬＥ')])).toBe('UNDERTALE');
    expect(detectGameWork([field('アルバム名', 'undertale soundtrack')])).toBe('UNDERTALE');
  });

  it('ゲーム作品が無い曲は null', () => {
    expect(detectGameWork([field('アルバム名', 'Random Access Memories')])).toBeNull();
    expect(
      detectGameWork([field('曲名', 'Get Lucky'), field('アーティスト名', 'Daft Punk')]),
    ).toBeNull();
    expect(detectGameWork([field('曲名', '夜に駆ける'), field('アーティスト名', 'YOASOBI')])).toBeNull();
  });
});
