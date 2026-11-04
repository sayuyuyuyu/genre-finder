import { describe, expect, it } from 'vitest';
import type { TrackCandidate } from '../shared/types';
import {
  MIN_CANDIDATE_SCORE,
  rankCandidates,
} from '../functions/_lib/candidates';

function track(partial: Partial<TrackCandidate> & Pick<TrackCandidate, 'id' | 'title' | 'artist'>): TrackCandidate {
  return {
    source: 'itunes',
    sourceId: partial.id,
    ...partial,
  };
}

describe('rankCandidates（検索ランキング）', () => {
  it('正規版がカバー・カラオケ・別アーティストより上位に来る', () => {
    const tracks = rankCandidates(
      [
        track({ id: 'cover', title: 'Get Lucky', artist: 'Daft Punk Experience', album: 'Get Lucky' }),
        track({ id: 'karaoke', title: 'Get Lucky', artist: 'Vitamin String Quartet', album: 'Karaoke Hits' }),
        track({ id: 'lullaby', title: 'Get Lucky', artist: 'Baby Rockstar', album: 'Lullaby Renditions' }),
        track({ id: 'other', title: 'Never Gonna Give You Up', artist: 'Rick Astley' }),
        track({ id: 'original', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories' }),
      ],
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    expect(tracks[0]?.id).toBe('original');
    expect(tracks[0]?.score).toBe(1);
    // カバー系は正規版より下、または低スコアで除外される
    const cover = tracks.find((candidate) => candidate.id === 'cover');
    if (cover) expect(cover.score ?? 0).toBeLessThan(1);
    for (const id of ['karaoke', 'lullaby']) {
      const item = tracks.find((candidate) => candidate.id === id);
      expect(item, `${id} は低スコアで除外される`).toBeUndefined();
    }
  });

  it('アーティスト未指定でも正規版が上位に来る（"Get Lucky Daft Punk"）', () => {
    const tracks = rankCandidates(
      [
        track({ id: 'cover', title: 'Get Lucky', artist: 'Daft Punk Experience' }),
        track({ id: 'original', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories' }),
      ],
      { title: 'Get Lucky Daft Punk' },
    );
    expect(tracks[0]?.id).toBe('original');
  });

  it('閾値未満の候補は捨てる', () => {
    const tracks = rankCandidates(
      [
        track({ id: 'hit', title: 'Get Lucky', artist: 'Daft Punk' }),
        track({ id: 'junk1', title: 'Leave The Door Open', artist: 'Silk Sonic' }),
        track({ id: 'junk2', title: "I'm a Mess", artist: 'Bebe Rexha' }),
      ],
      { title: 'Get Lucky', artist: 'Daft Punk' },
    );
    expect(tracks.map((candidate) => candidate.id)).toEqual(['hit']);
  });

  it('全候補が閾値未満なら上位5件を残す（UIが空にならない）', () => {
    const junk = Array.from({ length: 8 }, (_, index) =>
      track({ id: `junk${index}`, title: `Unrelated ${index}`, artist: `Nobody ${index}` }),
    );
    const tracks = rankCandidates(junk, { title: 'SICK MODE', artist: 'BABYMONSTER' });
    expect(tracks.length).toBe(5);
    for (const candidate of tracks) {
      expect(candidate.score ?? 0).toBeLessThan(MIN_CANDIDATE_SCORE);
    }
  });

  it('Spotify 解決の並び: 正規版が Cake Mix より上位', () => {
    const tracks = rankCandidates(
      [
        track({ id: 'cake', title: 'Never Gonna Give You Up (Cake Mix)', artist: 'Rick Astley' }),
        track({ id: 'original', title: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody' }),
      ],
      { title: 'Never Gonna Give You Up', artist: 'Rick Astley' },
    );
    expect(tracks[0]?.id).toBe('original');
  });
});
