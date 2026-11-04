import { describe, expect, it } from 'vitest';
import {
  artistSimilarity,
  buildSearchTerm,
  chooseStorefront,
  cleanArtistName,
  cleanTrackTitle,
  parseSearchQuery,
  scoreMatch,
  splitArtistTitle,
  splitFeaturing,
  titleSimilarity,
} from '../shared/genre/title';

describe('splitArtistTitle（YouTube タイトル解析）', () => {
  it('"アーティスト - 曲名" を分解する', () => {
    expect(splitArtistTitle('Luis Fonsi - Despacito ft. Daddy Yankee')).toEqual({
      artist: 'Luis Fonsi',
      title: 'Despacito',
    });
  });

  it('全角ダッシュ区切りにも対応する', () => {
    expect(splitArtistTitle('米津玄師 – IRIS OUT')).toEqual({
      artist: '米津玄師',
      title: 'IRIS OUT',
    });
  });

  it('区切りが無ければ曲名だけ返す', () => {
    expect(splitArtistTitle('Despacito (Official Video)')).toEqual({ title: 'Despacito' });
  });
});

describe('cleanTrackTitle', () => {
  it('(Official Video) などのノイズを除去する', () => {
    expect(cleanTrackTitle('Never Gonna Give You Up (Official Video)')).toBe(
      'Never Gonna Give You Up',
    );
    expect(cleanTrackTitle('【MV】IRIS OUT / 米津玄師')).toBe('IRIS OUT / 米津玄師');
  });

  it('feat. 表記を落とす', () => {
    expect(cleanTrackTitle('Get Lucky feat. Pharrell Williams')).toBe('Get Lucky');
  });
});

describe('splitFeaturing', () => {
  it('feat. をタイトルと客演に分ける', () => {
    expect(splitFeaturing('Get Lucky feat. Pharrell Williams')).toEqual({
      title: 'Get Lucky',
      feat: 'Pharrell Williams',
    });
  });
});

describe('cleanArtistName', () => {
  it('VEVO / - Topic / Official を除去する', () => {
    expect(cleanArtistName('LuisFonsiVEVO')).toBe('Luis Fonsi');
    expect(cleanArtistName('Daft Punk - Topic')).toBe('Daft Punk');
    expect(cleanArtistName('Official HIGE DANdism')).toBe('HIGE DANdism');
  });
});

describe('parseSearchQuery', () => {
  it('artist が明示されていればそのまま使う', () => {
    expect(parseSearchQuery('Get Lucky', 'Daft Punk')).toEqual({
      title: 'Get Lucky',
      artist: 'Daft Punk',
    });
  });

  it('"アーティスト - 曲名" を分解する', () => {
    expect(parseSearchQuery('Daft Punk - Get Lucky')).toEqual({
      title: 'Get Lucky',
      artist: 'Daft Punk',
    });
  });

  it('区切りが無いクエリはタイトル扱いにする', () => {
    expect(parseSearchQuery('米津玄師')).toEqual({ title: '米津玄師' });
  });
});

describe('scoreMatch / buildSearchTerm', () => {
  it('完全一致は 1 に近い', () => {
    expect(scoreMatch({ title: 'Get Lucky', artist: 'Daft Punk' }, { title: 'Get Lucky', artist: 'Daft Punk' })).toBe(1);
  });

  it('アーティスト違いは下がる', () => {
    const same = scoreMatch(
      { title: 'Get Lucky', artist: 'Daft Punk' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    const other = scoreMatch(
      { title: 'Get Lucky', artist: 'Someone Else' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    expect(other).toBeLessThan(same);
  });

  it('検索語は曲名とアーティストを連結する', () => {
    expect(buildSearchTerm('Get Lucky', 'Daft Punk')).toBe('Get Lucky Daft Punk');
    expect(buildSearchTerm('IRIS OUT')).toBe('IRIS OUT');
  });
});

describe('chooseStorefront（ストアフロント選択）', () => {
  it('日本語クエリは日本ストアを優先する', () => {
    expect(chooseStorefront('米津玄師')).toEqual({ primary: 'jp', fallback: 'us' });
    expect(chooseStorefront('夜に駆ける YOASOBI')).toEqual({ primary: 'jp', fallback: 'us' });
  });

  it('ラテン文字クエリは US ストアを優先する', () => {
    expect(chooseStorefront('Daft Punk Get Lucky')).toEqual({ primary: 'us', fallback: 'jp' });
    expect(chooseStorefront('BABYMONSTER SICK MODE')).toEqual({ primary: 'us', fallback: 'jp' });
  });
});

describe('titleSimilarity（タイトル減点）', () => {
  it('Remastered / Live / feat. は減点しない', () => {
    expect(titleSimilarity('Get Lucky (Remastered 2011)', 'Get Lucky')).toBe(1);
    expect(titleSimilarity('Get Lucky (Live)', 'Get Lucky')).toBe(1);
    expect(titleSimilarity('Get Lucky (feat. Pharrell Williams)', 'Get Lucky')).toBe(1);
  });

  it('Remix / Cake Mix などは減点する', () => {
    expect(titleSimilarity('Get Lucky (Cake Mix)', 'Get Lucky')).toBeLessThan(1);
    expect(titleSimilarity('Get Lucky (Karaoke Version)', 'Get Lucky')).toBeLessThan(1);
  });

  it('余分な語があると減点する', () => {
    expect(titleSimilarity('Get Lucky Remix', 'Get Lucky')).toBeLessThan(
      titleSimilarity('Get Lucky', 'Get Lucky'),
    );
  });
});

describe('artistSimilarity（アーティスト一致の厳格化）', () => {
  it('完全一致は 1', () => {
    expect(artistSimilarity('Daft Punk', 'Daft Punk')).toBe(1);
    expect(artistSimilarity('ダフト・パンク', 'ダフト・パンク')).toBe(1);
  });

  it('余分な語があるアーティストは大きく下げる', () => {
    expect(artistSimilarity('Daft Punk Experience', 'Daft Punk')).toBe(0.2);
  });

  it('無関係なアーティストは 0', () => {
    expect(artistSimilarity('Vitamin String Quartet', 'Daft Punk')).toBe(0);
    expect(artistSimilarity('Rick Astley', 'Daft Punk')).toBe(0);
  });
});

describe('scoreMatch（カバー・非公式版の減点）', () => {
  it('カラオケ・トリビュート等のアルバムは減点される', () => {
    const plain = scoreMatch(
      { title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    const karaoke = scoreMatch(
      { title: 'Get Lucky', artist: 'Daft Punk', album: 'Karaoke Hits' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    expect(karaoke).toBeLessThan(plain);
    expect(plain - karaoke).toBeGreaterThanOrEqual(0.3);
  });

  it('アーティスト完全一致は大きなボーナスになる', () => {
    const exact = scoreMatch(
      { title: 'Get Lucky', artist: 'Daft Punk' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    const near = scoreMatch(
      { title: 'Get Lucky', artist: 'Daft Punk Experience' },
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    expect(exact).toBe(1);
    expect(exact - near).toBeGreaterThanOrEqual(0.5);
  });
});
