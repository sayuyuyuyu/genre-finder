import { describe, expect, it } from 'vitest';
import { deezerToCandidate, itunesToCandidate, rankCandidates } from '../functions/_lib/candidates';
import type { DeezerTrack } from '../functions/_lib/deezer';
import type { ItunesTrack } from '../functions/_lib/itunes';

const itunesTrack: ItunesTrack = {
  trackId: 617154366,
  trackName: 'Get Lucky',
  artistName: 'Daft Punk',
  collectionName: 'Random Access Memories',
  primaryGenreName: 'Pop',
  previewUrl: 'https://audio-ssl.itunes.apple.com/preview/get-lucky.m4a',
};

const deezerTrack: DeezerTrack = {
  id: 66609426,
  title: 'Get Lucky',
  duration: 248,
  preview: 'https://cdnt-preview.dzcdn.net/api/1/1/preview.mp3',
  artist: { name: 'Daft Punk' },
  album: { id: 302127, title: 'Random Access Memories' },
};

describe('previewUrl の写像', () => {
  it('iTunes の previewUrl を TrackCandidate に入れる', () => {
    expect(itunesToCandidate(itunesTrack).previewUrl).toBe(
      'https://audio-ssl.itunes.apple.com/preview/get-lucky.m4a',
    );
  });

  it('iTunes に previewUrl が無ければ undefined（空文字にしない）', () => {
    expect(itunesToCandidate({ ...itunesTrack, previewUrl: undefined }).previewUrl).toBeUndefined();
    expect(itunesToCandidate({ ...itunesTrack, previewUrl: '' }).previewUrl).toBeUndefined();
  });

  it('Deezer の preview を TrackCandidate に入れる', () => {
    expect(deezerToCandidate(deezerTrack).previewUrl).toBe(
      'https://cdnt-preview.dzcdn.net/api/1/1/preview.mp3',
    );
  });

  it('Deezer に preview が無ければ undefined（空文字にしない）', () => {
    expect(deezerToCandidate({ ...deezerTrack, preview: undefined }).previewUrl).toBeUndefined();
    expect(deezerToCandidate({ ...deezerTrack, preview: '' }).previewUrl).toBeUndefined();
  });
});

describe('rankCandidates（並び順）', () => {
  const query = { title: 'Blinding Lights' };

  it('スコアが近いときは iTunes を Deezer より前にする', () => {
    const itunes = itunesToCandidate({ ...itunesTrack, trackName: 'Blinding Lights', artistName: 'The Weeknd' });
    const deezer = deezerToCandidate({ ...deezerTrack, title: 'Blinding Lights', artist: { name: 'Loi' }, rank: 900000 });
    const ranked = rankCandidates(
      [deezer, itunes].map((track) => ({ ...track, score: 0.8 })),
      query,
    );
    expect(ranked[0]?.source).toBe('itunes');
  });

  it('同じソース同士の同点では人気度（rank）が高い方を前にする', () => {
    const popular = deezerToCandidate({
      ...deezerTrack,
      id: 1,
      title: 'Blinding Lights',
      artist: { name: 'The Weeknd' },
      rank: 1_000_000,
    });
    const cover = deezerToCandidate({
      ...deezerTrack,
      id: 2,
      title: 'Blinding Lights',
      artist: { name: 'Loi' },
      rank: 1000,
    });
    const ranked = rankCandidates(
      [cover, popular].map((track) => ({ ...track, score: 0.8 })),
      query,
    );
    expect(ranked[0]?.artist).toBe('The Weeknd');
  });
});
