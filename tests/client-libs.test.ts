import { beforeEach, describe, expect, it } from 'vitest';
import { arcadeOf, commentOf, levelOf } from '../src/lib/arcade';
import { displayQuery, externalSearchLinks, formatDuration, formatWeight, toPercent, trackMeta } from '../src/lib/format';
import { addRecent, clearRecent, loadRecent } from '../src/lib/recent';
import type { RecentEntry } from '../src/lib/recent';
import { readSharedQuery, sharedQueryString } from '../src/lib/shared-query';
import type { TrackCandidate } from '../shared/types';

/* ---------------------------- テスト用 localStorage ---------------------------- */

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  },
});

beforeEach(() => {
  storage.clear();
});

/* --------------------------------- arcade --------------------------------- */

describe('arcade（IIDX風表示のロジック）', () => {
  it('arcade が無ければ labelEn を大文字にする', () => {
    expect(arcadeOf({ labelEn: 'Drum and Bass', arcade: undefined })).toBe('DRUM AND BASS');
    expect(arcadeOf({ labelEn: 'House', arcade: 'HOUSE' })).toBe('HOUSE');
    expect(arcadeOf({ labelEn: 'house', arcade: '  house ' })).toBe('HOUSE');
  });

  it('信頼度を LEVEL 1〜12 に変換する（低くても目盛りが寂しくならない）', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(0.01)).toBe(1);
    expect(levelOf(0.25)).toBe(6);
    expect(levelOf(0.7)).toBe(10);
    expect(levelOf(1)).toBe(12);
    expect(levelOf(Number.NaN)).toBe(1);
  });

  it('tagline があればコメントとして優先する', () => {
    expect(commentOf({ id: 'x' }, { family: 'ポップス' }, 'high', 'サビで勝つタイプ。')).toBe(
      'サビで勝つタイプ。',
    );
  });

  it('判定不能のときは情報不足のコメントを返す', () => {
    expect(commentOf({ id: 'x' }, null, 'unknown')).toContain('情報が足りません');
  });

  it('同じ曲なら毎回同じコメントになる（決定的）', () => {
    const first = commentOf({ id: 'itunes:1' }, { family: 'エレクトロニック' }, 'high');
    const second = commentOf({ id: 'itunes:1' }, { family: 'エレクトロニック' }, 'high');
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});

/* --------------------------------- format --------------------------------- */

describe('format', () => {
  it('信頼度を % に丸める（0-1 にクランプ）', () => {
    expect(toPercent(0.703)).toBe(70);
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(2)).toBe(100);
    expect(toPercent(Number.NaN)).toBe(0);
  });

  it('重みを 2 桁固定小数にする', () => {
    expect(formatWeight(0.9)).toBe('0.90');
    expect(formatWeight(1.234)).toBe('1.00');
    expect(formatWeight(0)).toBe('0.00');
  });

  it('再生時間を m:ss にする', () => {
    expect(formatDuration(261_000)).toBe('4:21');
    expect(formatDuration(59_400)).toBe('0:59');
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
  });

  it('メタ情報をアルバム · 年 · 時間でつなぐ', () => {
    expect(
      trackMeta({
        id: 'a',
        title: 'T',
        artist: 'A',
        album: 'Album',
        year: 2020,
        durationMs: 185_000,
        source: 'itunes',
        sourceId: '1',
      }),
    ).toBe('Album · 2020 · 3:05');
  });

  it('Apple Music は曲の実ページを優先し、無ければ検索URLにする', () => {
    const withLink = externalSearchLinks({
      title: 'Get Lucky',
      artist: 'Daft Punk',
      links: { itunes: 'https://music.apple.com/jp/album/x?i=1' },
    });
    expect(withLink[0]?.url).toBe('https://music.apple.com/jp/album/x?i=1');
    expect(withLink[0]?.exact).toBe(true);

    const withoutLink = externalSearchLinks({ title: 'Get Lucky', artist: 'Daft Punk' });
    expect(withoutLink[0]?.url).toContain('music.apple.com/jp/search?term=');
    expect(withoutLink[0]?.exact).toBe(false);
    expect(withoutLink[2]?.url).toContain('youtube.com/results');
  });

  it('空の検索語は「この曲」と表示する', () => {
    expect(displayQuery('  ')).toBe('この曲');
    expect(displayQuery(' 夜に駆ける ')).toBe('夜に駆ける');
  });
});

/* ------------------------------ shared query ------------------------------ */

describe('shared-query（共有URL）', () => {
  it('?t=&a= を読み取る', () => {
    expect(readSharedQuery('?t=Megalovania&a=Toby%20Fox')).toEqual({
      title: 'Megalovania',
      artist: 'Toby Fox',
    });
  });

  it('t が無ければ null、a だけなら artist 無し', () => {
    expect(readSharedQuery('')).toBeNull();
    expect(readSharedQuery('?a=Someone')).toBeNull();
    expect(readSharedQuery('?t=Megalovania')).toEqual({ title: 'Megalovania' });
  });

  it('生成したURLを読み直せる（往復）', () => {
    const query = sharedQueryString({ title: '夜に駆ける', artist: 'YOASOBI' });
    expect(readSharedQuery(query)).toEqual({ title: '夜に駆ける', artist: 'YOASOBI' });
  });
});

/* --------------------------------- recent --------------------------------- */

function entry(id: string, arcade = 'J-POP'): RecentEntry {
  return {
    track: {
      id,
      title: `曲${id}`,
      artist: 'Artist',
      source: 'itunes',
      sourceId: id,
    } satisfies TrackCandidate,
    arcade,
    labelJa: arcade,
    at: Date.now(),
  };
}

describe('recent（最近調べた曲）', () => {
  it('新しい順に積み、同じ曲は1件にまとめる', () => {
    let items = addRecent([], entry('1'));
    items = addRecent(items, entry('2'));
    items = addRecent(items, entry('1'));
    expect(items.map((item) => item.track.id)).toEqual(['1', '2']);
  });

  it('最大6件まで保持する', () => {
    let items: RecentEntry[] = [];
    for (let index = 0; index < 9; index += 1) items = addRecent(items, entry(String(index)));
    expect(items).toHaveLength(6);
    expect(items[0]?.track.id).toBe('8');
  });

  it('保存した内容を読み直せる / clear で消える', () => {
    addRecent([], entry('a'));
    expect(loadRecent().map((item) => item.track.id)).toEqual(['a']);
    clearRecent();
    expect(loadRecent()).toEqual([]);
  });

  it('壊れた保存内容は無視する', () => {
    storage.set('genre-finder:recent:v1', '{broken json');
    expect(loadRecent()).toEqual([]);
    storage.set('genre-finder:recent:v1', JSON.stringify([{ nope: true }]));
    expect(loadRecent()).toEqual([]);
  });
});
