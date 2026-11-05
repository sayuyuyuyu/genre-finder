import { describe, expect, it } from 'vitest';
import {
  normalize,
  normalizeArtist,
  normalizeText,
  normalizeTitle,
  similarity,
  trackKey,
} from '../shared/genre/normalize';

describe('normalizeText', () => {
  it('全角英数・記号・中黒・大文字小文字を吸収する', () => {
    expect(normalizeText('ＰＯＰ／ＲＯＣＫ')).toBe('pop rock');
    expect(normalizeText('ヒップ・ホップ')).toBe('ヒップ ホップ');
    expect(normalizeText('R&B')).toBe('r and b');
  });
});

describe('normalize（ジャンルラベル → タクソノミーID）', () => {
  it('id と完全一致する', () => {
    expect(normalize('J-Pop')).toEqual({ id: 'j-pop', matchedBy: 'exact' });
    expect(normalize('Ｊ－ＰＯＰ')).toEqual({ id: 'j-pop', matchedBy: 'exact' });
  });

  it('iTunes の複合ラベルをエイリアスで解決する', () => {
    expect(normalize('Hip-Hop/Rap')).toEqual({ id: 'hip-hop', matchedBy: 'alias' });
    expect(normalize('R&B/Soul')).toEqual({ id: 'r-and-b', matchedBy: 'alias' });
    expect(normalize("Children's Music")).toEqual({ id: 'childrens', matchedBy: 'alias' });
  });

  it('Deezer の日本語ジャンルを解決する', () => {
    expect(normalize('エレクトロ')?.id).toBe('electronic');
    expect(normalize('ダンス')?.id).toBe('dance');
    expect(normalize('ポップス')?.id).toBe('pop');
    expect(normalize('ラップ')?.id).toBe('hip-hop');
  });

  it('細分類を大分類より優先して解決する', () => {
    expect(normalize('french house')?.id).toBe('french-house');
    expect(normalize('deep house')?.id).toBe('deep-house');
    expect(normalize('pop rock')?.id).toBe('rock');
  });

  it('MusicBrainz のタグ表記を解決する', () => {
    expect(normalize('synth-pop')?.id).toBe('synth-pop');
    expect(normalize('drum and bass')?.id).toBe('drum-and-bass');
    expect(normalize('shoegaze')?.id).toBe('shoegaze');
  });

  it('前方一致で「house music」のような表記も拾う', () => {
    expect(normalize('house music')?.id).toBe('house');
  });

  it('ゲーム音楽系のラベルを解決する', () => {
    expect(normalize('Chiptune')?.id).toBe('chiptune');
    expect(normalize('ファミコン')?.id).toBe('chiptune');
    expect(normalize('8bit')?.id).toBe('chiptune');
    expect(normalize('FM音源')?.id).toBe('fm-synth');
    expect(normalize('PC-98')?.id).toBe('fm-synth');
    expect(normalize('東方Project')?.id).toBe('touhou-arrange');
    expect(normalize('BMS')?.id).toBe('rhythm-game');
    expect(normalize('beatmania IIDX')?.id).toBe('rhythm-game');
    expect(normalize('ノベルゲーム')?.id).toBe('visual-novel');
    expect(normalize('ゲーム音楽')?.id).toBe('game-music');
    expect(normalize('Video Game Music')?.id).toBe('game-music');
    expect(normalize('BGM')?.id).toBe('game-music');
  });

  it('対応表に無いタグは null', () => {
    expect(normalize('seen live')).toBeNull();
    expect(normalize('favorite')).toBeNull();
    expect(normalize('')).toBeNull();
  });
});

describe('normalizeTitle', () => {
  it('feat. やかっこ書きのバージョン表記を落とす', () => {
    expect(normalizeTitle('Get Lucky (Radio Edit - feat. Pharrell Williams)')).toBe('get lucky');
    expect(normalizeTitle('Never Gonna Give You Up (Official Video)')).toBe(
      'never gonna give you up',
    );
  });

  it('Remastered 表記と全角を吸収する', () => {
    expect(normalizeTitle('Ｇｅｔ Ｌｕｃｋｙ - Remastered 2013')).toBe('get lucky');
  });
});

describe('normalizeArtist / trackKey', () => {
  it('複数アーティストは先頭だけを比較に使う', () => {
    expect(normalizeArtist('ダフト・パンク, Pharrell Williams')).toBe('ダフト パンク');
  });

  it('YouTube のチャンネル名ノイズを落とす', () => {
    expect(normalizeArtist('Daft Punk - Topic')).toBe('daft punk');
    expect(normalizeArtist('LuisFonsiVEVO')).toBe('luisfonsivevo');
  });

  it('曲名とアーティストを正規化した重複キーになる', () => {
    expect(trackKey('Get Lucky (Radio Edit)', 'Daft Punk')).toBe(
      trackKey('Get Lucky', 'daft punk'),
    );
  });
});

describe('similarity', () => {
  it('完全一致は 1', () => {
    expect(similarity('Get Lucky', 'get lucky')).toBe(1);
  });

  it('包含関係は 0.7 以上', () => {
    expect(similarity('Get Lucky (Radio Edit)', 'Get Lucky')).toBeGreaterThanOrEqual(0.7);
  });

  it('無関係な文字列は低い', () => {
    expect(similarity('Get Lucky', '夜に駆ける')).toBeLessThan(0.2);
  });
});
