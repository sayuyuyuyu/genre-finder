import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * iTunes クライアントのレート制限対策（429/403 のサーキットブレーカー）のテスト。
 * 実際のネットワークは使わず fetch を差し替える。
 */

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const sampleTrack = {
  trackId: 1,
  trackName: 'Get Lucky',
  artistName: 'Daft Punk',
  kind: 'song',
};

describe('iTunes クライアント', () => {
  it('429 が2回続いたら失敗し、その後の呼び出しは fetch せず即失敗する', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return new Response('Rate limit has been exceeded', { status: 429 });
      }),
    );
    const { itunesSearch } = await import('../functions/_lib/itunes');

    await expect(itunesSearch('Get Lucky')).rejects.toThrow();
    const afterFirst = calls;
    expect(afterFirst).toBe(2); // 1回 + リトライ1回

    await expect(itunesSearch('Another Song')).rejects.toThrow();
    expect(calls).toBe(afterFirst); // ブレーカー中はネットワークに出ない
  });

  it('成功時はトラックを返す（正常系）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ resultCount: 1, results: [sampleTrack] })),
    );
    const { itunesSearch } = await import('../functions/_lib/itunes');
    const tracks = await itunesSearch('Get Lucky');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.trackName).toBe('Get Lucky');
  });

  it('podcast など曲以外は除外する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          resultCount: 2,
          results: [sampleTrack, { trackId: 2, trackName: 'Episode', kind: 'podcast' }],
        }),
      ),
    );
    const { itunesSearch } = await import('../functions/_lib/itunes');
    const tracks = await itunesSearch('whatever');
    expect(tracks.map((track) => track.trackId)).toEqual([1]);
  });
});
