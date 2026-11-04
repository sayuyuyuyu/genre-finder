import { describe, expect, it } from 'vitest';
import {
  FAMILIES,
  GENRES,
  GENRE_BY_ID,
  childrenOf,
  isDescendantOf,
  parentOf,
  relatedGenres,
} from '../shared/genre/taxonomy';
import { normalize } from '../shared/genre/normalize';

describe('taxonomy', () => {
  it('ジャンル数は SPEC の 55〜70 の範囲', () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(55);
    expect(GENRES.length).toBeLessThanOrEqual(70);
  });

  it('id が重複しない', () => {
    const ids = GENRES.map((genre) => genre.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GENRE_BY_ID.size).toBe(ids.length);
  });

  it('family は定義済みの日本語大分類', () => {
    for (const genre of GENRES) {
      expect(FAMILIES).toContain(genre.family);
    }
  });

  it('related は実在するジャンル ID を指す', () => {
    for (const genre of GENRES) {
      for (const relatedId of genre.related) {
        expect(GENRE_BY_ID.has(relatedId), `${genre.id} → ${relatedId}`).toBe(true);
      }
    }
  });

  it('説明文は日本語で具体的（20文字以上）', () => {
    for (const genre of GENRES) {
      expect(genre.description.length, genre.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('すべてのジャンルにエイリアスがある', () => {
    for (const genre of GENRES) {
      expect(genre.aliases.length, genre.id).toBeGreaterThan(0);
    }
  });

  it('主要な iTunes ラベルをすべて正規化できる', () => {
    const itunesLabels = [
      'Pop',
      'Rock',
      'Hip-Hop/Rap',
      'R&B/Soul',
      'Electronic',
      'Dance',
      'Jazz',
      'Classical',
      'Folk',
      'Metal',
      'Punk',
      'Reggae',
      'Latin',
      'World',
      'Anime',
      'Soundtrack',
      'Vocal',
      'Blues',
      'Country',
      'Gospel',
      'New Age',
      'Easy Listening',
      "Children's Music",
      'Singer/Songwriter',
      'Alternative',
      'J-Pop',
      'K-Pop',
      'Enka',
      'Kayokyoku',
      'House',
      'Techno',
      'Trance',
      'Dubstep',
      'Dancehall',
    ];
    for (const label of itunesLabels) {
      expect(normalize(label), label).not.toBeNull();
    }
  });

  it('parent は実在し、循環しない', () => {
    for (const genre of GENRES) {
      if (!genre.parent) continue;
      expect(GENRE_BY_ID.has(genre.parent), `${genre.id} → ${genre.parent}`).toBe(true);
      expect(genre.parent).not.toBe(genre.id);
      // 循環していないこと（親をたどって自分に戻らない）
      let current: string | undefined = genre.parent;
      const seen = new Set<string>([genre.id]);
      while (current) {
        expect(seen.has(current), `${genre.id} の parent が循環`).toBe(false);
        seen.add(current);
        current = parentOf(current);
      }
    }
  });

  it('親子関係が引ける（house の子に french-house）', () => {
    const children = childrenOf('house').map((genre) => genre.id);
    expect(children).toContain('french-house');
    expect(children).toContain('deep-house');
    expect(isDescendantOf('french-house', 'electronic')).toBe(true);
    expect(isDescendantOf('house', 'electronic')).toBe(true);
    expect(isDescendantOf('jazz', 'electronic')).toBe(false);
  });

  it('relatedGenres はラベル付きで返す', () => {
    const related = relatedGenres('house');
    expect(related.length).toBeGreaterThan(0);
    for (const item of related) {
      expect(item.labelJa.length).toBeGreaterThan(0);
    }
    expect(relatedGenres('unknown-genre')).toEqual([]);
  });
});
