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

  it('ゲーム音楽の明示語は game-music', () => {
    expect(ids([field('アルバム名', 'ゲーム音楽ベスト')])).toContain('game-music');
    expect(ids([field('アルバム名', 'Original Game Soundtrack')])).toContain('game-music');
  });

  it('単なる "Original Soundtrack" は映画にも付くのでゲーム判定に使わない', () => {
    expect(ids([field('アルバム名', 'Original Soundtrack')])).not.toContain('game-music');
    expect(ids([field('アルバム名', 'Interstellar Original Soundtrack')])).not.toContain(
      'game-music',
    );
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

describe('音ゲー・同人イベント/サークルの検出', () => {
  it('例大祭 / 紅楼夢 は touhou-arrange', () => {
    expect(ids([field('アルバム名', '博麗神社例大祭 新譜')])).toContain('touhou-arrange');
    expect(ids([field('アルバム名', '東方紅楼夢 10')])).toContain('touhou-arrange');
  });

  it('東方アレンジサークル名は touhou-arrange', () => {
    expect(ids([field('アーティスト名', 'SOUND HOLIC')])).toContain('touhou-arrange');
    expect(ids([field('アーティスト名', 'Alstroemeria Records')])).toContain('touhou-arrange');
    expect(ids([field('アーティスト名', '幽閉サテライト')])).toContain('touhou-arrange');
    expect(ids([field('アーティスト名', 'IOSYS')])).toContain('touhou-arrange');
  });

  it('同人イベント（M3 / コミケ / C9x / サンクリ）は game-music', () => {
    expect(ids([field('アルバム名', 'M3-2024春 新譜')])).toContain('game-music');
    expect(ids([field('アルバム名', 'コミックマーケット 104')])).toContain('game-music');
    expect(ids([field('アルバム名', 'C92 会場限定')])).toContain('game-music');
    expect(ids([field('アルバム名', 'サンクリ 新作')])).toContain('game-music');
  });

  it('"M3" 単体や "C9" 単体では誤検出しない', () => {
    expect(ids([field('アルバム名', 'M3')])).toEqual([]);
    expect(ids([field('アルバム名', 'C9')])).toEqual([]);
  });

  it('音ゲー作品・フレーズは rhythm-game', () => {
    expect(ids([field('アルバム名', 'SOUND VOLTEX IV')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'SDVX 楽曲集')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'プロジェクトセカイ セカイver.')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'プロセカ 楽曲集')])).toContain('rhythm-game');
    expect(ids([field('アーティスト名', 'アイドルマスター')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'ラブライブ！ ベスト')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'BanG Dream! カバー集')])).toContain('rhythm-game');
    expect(ids([field('アルバム名', 'D4DJ Groovy Mix')])).toContain('rhythm-game');
  });

  it('BEMANI（Bemani Symphony 等）は rhythm-game', () => {
    expect(ids([field('アルバム名', 'Bemani Symphony Original Soundtrack')])).toContain('rhythm-game');
  });

  it('一般曲は音ゲー/同人として誤検出しない', () => {
    expect(ids([field('アルバム名', 'Random Access Memories')])).toEqual([]);
    expect(ids([field('曲名', '夜に駆ける'), field('アーティスト名', 'YOASOBI')])).toEqual([]);
  });
});

describe('音ゲー・同人作品名の検出', () => {
  it('例大祭 / 紅楼夢 / 東方サークル → 東方Project', () => {
    expect(detectGameWork([field('アルバム名', '博麗神社例大祭 新譜')])).toBe('東方Project');
    expect(detectGameWork([field('アルバム名', '東方紅楼夢 10')])).toBe('東方Project');
    expect(detectGameWork([field('アーティスト名', 'SOUND HOLIC')])).toBe('東方Project');
  });

  it('音ゲー・アイドル作品名を返す', () => {
    expect(detectGameWork([field('アルバム名', 'プロジェクトセカイ セカイver.')])).toBe(
      'プロジェクトセカイ',
    );
    expect(detectGameWork([field('アルバム名', 'プロセカ 楽曲集')])).toBe('プロジェクトセカイ');
    expect(detectGameWork([field('アーティスト名', 'アイドルマスター')])).toBe('アイドルマスター');
    expect(detectGameWork([field('アルバム名', 'ラブライブ！ ベスト')])).toBe('ラブライブ！');
    expect(detectGameWork([field('アルバム名', 'BanG Dream! カバー集')])).toBe('BanG Dream!');
    expect(detectGameWork([field('アルバム名', 'D4DJ Groovy Mix')])).toBe('D4DJ');
    expect(detectGameWork([field('アルバム名', 'SOUND VOLTEX IV')])).toBe('SOUND VOLTEX');
    expect(detectGameWork([field('アルバム名', 'SDVX 楽曲集')])).toBe('SOUND VOLTEX');
  });

  it('Bemani 系の作品名を返す', () => {
    expect(detectGameWork([field('アルバム名', 'Bemani Symphony Original Soundtrack')])).toBe('BEMANI');
  });

  it('同人イベント名だけでは作品名を出さない', () => {
    expect(detectGameWork([field('アルバム名', 'M3-2024春 新譜')])).toBeNull();
    expect(detectGameWork([field('アルバム名', 'コミックマーケット 104')])).toBeNull();
  });
});

describe('追加したゲーム作品', () => {
  it('作品名を検出する（ELDEN RING / FIRE EMBLEM / HOLLOW KNIGHT）', () => {
    expect(detectGameWork([field('アルバム名', 'ELDEN RING Original Soundtrack')])).toBe(
      'ELDEN RING',
    );
    expect(detectGameWork([field('アルバム名', 'Fire Emblem Fates')])).toBe('FIRE EMBLEM');
    expect(detectGameWork([field('アルバム名', 'Hollow Knight (Original Soundtrack)')])).toBe(
      'HOLLOW KNIGHT',
    );
  });

  it('作品名がゲーム音楽の証拠になる', () => {
    expect(ids([field('アルバム名', 'ELDEN RING Original Soundtrack')])).toContain('game-music');
    expect(ids([field('アーティスト名', '桜庭統')])).toContain('game-music');
  });
});
