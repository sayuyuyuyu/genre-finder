import { describe, expect, it } from 'vitest';
import type { GenreEvidence } from '../shared/types';
import { normalize } from '../shared/genre/normalize';
import {
  aggregateGenres,
  BROAD_CONFIDENCE_CAP,
  COARSE_CONFIDENCE_CAP,
  confidenceLevel,
  DEEZER_WEIGHT,
  ITUNES_WEIGHT,
  lastfmWeight,
  musicbrainzArtistWeight,
  musicbrainzRecordingWeight,
} from '../shared/genre/score';

function evidence(source: GenreEvidence['source'], raw: string, weight: number): GenreEvidence {
  return {
    source,
    raw,
    canonicalId: normalize(raw)?.id ?? null,
    weight,
  };
}

describe('重みの式', () => {
  it('MusicBrainz アーティストジャンルは count=25 で上限 1.0', () => {
    expect(musicbrainzArtistWeight(0)).toBeCloseTo(0.45, 5);
    expect(musicbrainzArtistWeight(25)).toBeCloseTo(1.0, 5);
    expect(musicbrainzArtistWeight(100)).toBeCloseTo(1.0, 5);
  });

  it('MusicBrainz レコーディングタグはアーティスト重み × 0.9', () => {
    expect(musicbrainzRecordingWeight(25)).toBeCloseTo(0.9, 5);
    expect(musicbrainzRecordingWeight(0)).toBeCloseTo(0.405, 5);
  });

  it('Last.fm タグは count=100 で上限 1.0', () => {
    expect(lastfmWeight(0)).toBeCloseTo(0.4, 5);
    expect(lastfmWeight(100)).toBeCloseTo(1.0, 5);
  });
});

describe('aggregateGenres', () => {
  it('1ソースだけでもそのジャンルを primary にする（粗いラベルなので上限あり）', () => {
    const result = aggregateGenres([evidence('itunes', 'Pop', ITUNES_WEIGHT)]);
    expect(result.primary?.id).toBe('pop');
    expect(result.primary?.confidence).toBeCloseTo(COARSE_CONFIDENCE_CAP, 3);
    expect(result.others).toHaveLength(0);
  });

  it('2ソースが一致したらブーストする（大分類は上限 0.65）', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('deezer', 'ポップス', DEEZER_WEIGHT),
      evidence('musicbrainz', 'pop', musicbrainzArtistWeight(20)),
    ]);
    expect(result.primary?.id).toBe('pop');
    expect(result.primary?.confidence).toBeLessThanOrEqual(BROAD_CONFIDENCE_CAP);
  });

  it('2ソースが食い違うと信頼度が分かれる', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('deezer', 'ダンス', DEEZER_WEIGHT),
    ]);
    expect(result.primary?.id).toBe('pop');
    expect(result.primary?.confidence).toBeCloseTo(0.9 / 1.65, 3);
    expect(result.others[0]?.id).toBe('dance');
  });

  it('曖昧な iTunes ラベルより細分類を primary に昇格させる', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('musicbrainz', 'french house', musicbrainzArtistWeight(20)),
    ]);
    expect(result.primary?.id).toBe('french-house');
    expect(result.primary?.family).toBe('エレクトロニック');
    expect(result.others.map((score) => score.id)).toContain('pop');
    // primary の % が others より低くならない（表示の矛盾防止）
    expect(result.primary?.confidence).toBeGreaterThanOrEqual(result.others[0]?.confidence ?? 0);
  });

  it('細分類が十分近くなければ大分類のまま', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('musicbrainz', 'house', musicbrainzArtistWeight(1)),
    ]);
    expect(result.primary?.id).toBe('pop');
  });

  it('対応表に載らない証拠は集計から除外する', () => {
    const result = aggregateGenres([
      evidence('musicbrainz', 'seen live', 1),
      evidence('itunes', 'Rock', ITUNES_WEIGHT),
    ]);
    expect(result.primary?.id).toBe('rock');
    expect(result.primary?.confidence).toBeCloseTo(COARSE_CONFIDENCE_CAP, 3);
  });

  it('粗いラベルだけの大分類は confidence を 0.59 に抑える', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('deezer', 'ポップス', DEEZER_WEIGHT),
    ]);
    expect(result.primary?.id).toBe('pop');
    expect(result.primary?.confidence).toBeLessThanOrEqual(COARSE_CONFIDENCE_CAP);
  });

  it('MusicBrainz の細分類証拠があれば大分類でも 0.65 まで許す', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Rock', ITUNES_WEIGHT),
      evidence('deezer', 'Rock', DEEZER_WEIGHT),
      evidence('musicbrainz', 'rock', musicbrainzArtistWeight(25)),
    ]);
    expect(result.primary?.id).toBe('rock');
    expect(result.primary?.confidence).toBeGreaterThan(COARSE_CONFIDENCE_CAP);
    expect(result.primary?.confidence).toBeLessThanOrEqual(BROAD_CONFIDENCE_CAP);
  });

  it('細分類が primary のときは信頼度の上限をかけない', () => {
    const result = aggregateGenres([
      evidence('itunes', 'J-Pop', ITUNES_WEIGHT),
      evidence('deezer', 'J-POP', DEEZER_WEIGHT),
      evidence('musicbrainz', 'j-pop', musicbrainzArtistWeight(25)),
    ]);
    expect(result.primary?.id).toBe('j-pop');
    expect(result.primary?.confidence).toBeGreaterThan(BROAD_CONFIDENCE_CAP);
  });

  it('GenreScore に arcade ラベルが入る（others も）', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('deezer', 'Rock', DEEZER_WEIGHT),
    ]);
    expect(result.primary?.arcade).toBe('DANCE POP');
    for (const score of result.others) {
      expect(score.arcade, score.id).toBeTruthy();
    }
  });

  it('ゲーム検出の優先ジャンルは coarse な大分類より昇格する', () => {
    const evidenceList = [
      evidence('itunes', 'Dance', ITUNES_WEIGHT),
      evidence('deezer', 'Dance', DEEZER_WEIGHT),
      evidence('itunes', 'touhou', 0.75),
      evidence('itunes', 'ゲーム音楽', 0.5),
    ];
    // 優先指定が無ければ Dance（大分類）のまま
    expect(aggregateGenres(evidenceList).primary?.id).toBe('dance');

    const promoted = aggregateGenres(evidenceList, { priorityIds: ['touhou-arrange'] });
    expect(promoted.primary?.id).toBe('touhou-arrange');
    expect(promoted.primary?.arcade).toBe('TOUHOU');
    expect(promoted.primary?.confidence).toBeGreaterThanOrEqual(
      promoted.others[0]?.confidence ?? 0,
    );
  });

  it('primary が細分類なら優先ジャンルでも昇格しない', () => {
    const result = aggregateGenres(
      [evidence('itunes', 'J-Pop', ITUNES_WEIGHT), evidence('itunes', 'touhou', 0.75)],
      { priorityIds: ['touhou-arrange'] },
    );
    expect(result.primary?.id).toBe('j-pop');
  });

  it('証拠が無ければ primary は null', () => {
    const result = aggregateGenres([]);
    expect(result.primary).toBeNull();
    expect(result.scores).toHaveLength(0);
  });

  it('傘ジャンル（electronic）より細分類（house）を primary に昇格させる', () => {
    // Daft Punk - Get Lucky の実測に近い証拠
    const result = aggregateGenres([
      evidence('itunes', 'Pop', ITUNES_WEIGHT),
      evidence('deezer', 'Electro', DEEZER_WEIGHT),
      evidence('musicbrainz', 'electronic', musicbrainzArtistWeight(42)),
      evidence('musicbrainz', 'house', musicbrainzArtistWeight(22)),
      evidence('musicbrainz', 'french house', musicbrainzArtistWeight(20)),
      evidence('musicbrainz', 'dance', musicbrainzArtistWeight(6)),
      evidence('musicbrainz', 'disco', musicbrainzArtistWeight(4)),
      evidence('musicbrainz', 'electro house', musicbrainzArtistWeight(2)),
    ]);
    expect(result.primary?.id).toBe('house');
    expect(result.primary?.family).toBe('エレクトロニック');
    // 昇格後も primary の % が others より低くならない
    expect(result.primary?.confidence).toBeGreaterThanOrEqual(result.others[0]?.confidence ?? 0);
    // 子ジャンル（french house）の支持もロールアップされている
    const frenchHouse = result.others.find((score) => score.id === 'french-house');
    expect(frenchHouse).toBeDefined();
  });

  it('子ジャンルが無関係な場合は昇格しない（rock のまま）', () => {
    const result = aggregateGenres([
      evidence('itunes', 'Rock', ITUNES_WEIGHT),
      evidence('deezer', 'Rock', DEEZER_WEIGHT),
      evidence('musicbrainz', 'rock', musicbrainzArtistWeight(30)),
      evidence('musicbrainz', 'hard rock', musicbrainzArtistWeight(2)),
    ]);
    expect(result.primary?.id).toBe('rock');
  });
});

describe('confidenceLevel', () => {
  it('SPEC のしきい値どおりに段階を返す', () => {
    expect(confidenceLevel(0.6, 1)).toBe('high');
    expect(confidenceLevel(0.35, 1)).toBe('medium');
    expect(confidenceLevel(0.2, 1)).toBe('low');
    expect(confidenceLevel(0, 0)).toBe('unknown');
  });
});

describe('電子系の傘（ダンス⇄エレクトロニック）の昇格', () => {
  it('Dance の coarse ラベルより hardstyle のタグを primary にする', () => {
    const result = aggregateGenres([
      { source: 'itunes', raw: 'Dance', canonicalId: 'dance', weight: 0.9 },
      { source: 'deezer', raw: 'Dance', canonicalId: 'dance', weight: 0.75 },
      { source: 'musicbrainz', raw: 'hardstyle', canonicalId: 'hardstyle', weight: 0.516 },
      { source: 'musicbrainz', raw: 'electronic', canonicalId: 'electronic', weight: 0.472 },
    ]);
    expect(result.primary?.id).toBe('hardstyle');
    expect(result.scores[0]?.id).toBe('hardstyle');
  });
});

describe('Soundtrack とゲーム優先の扱い', () => {
  it('Soundtrack でも具体的な音楽ジャンルがあればそちらを primary にする', () => {
    const result = aggregateGenres([
      { source: 'itunes', raw: 'Soundtrack', canonicalId: 'soundtrack', weight: 0.9 },
      { source: 'deezer', raw: 'Rap/Hip Hop', canonicalId: 'hip-hop', weight: 0.75 },
    ]);
    expect(result.primary?.id).toBe('hip-hop');
  });

  it('ゲーム優先ジャンルでも支持が弱ければ昇格しない（映画音楽をゲーム扱いしない）', () => {
    const result = aggregateGenres(
      [
        { source: 'itunes', raw: 'Soundtrack', canonicalId: 'soundtrack', weight: 0.9 },
        { source: 'musicbrainz', raw: 'modern classical', canonicalId: 'classical', weight: 0.69 },
        { source: 'musicbrainz', raw: 'cinematic classical', canonicalId: 'classical', weight: 0.58 },
        { source: 'musicbrainz', raw: 'classical', canonicalId: 'classical', weight: 0.54 },
        { source: 'musicbrainz', raw: 'video game music', canonicalId: 'game-music', weight: 0.63 },
      ],
      { priorityIds: ['game-music'] },
    );
    expect(result.primary?.id).not.toBe('game-music');
  });
});
