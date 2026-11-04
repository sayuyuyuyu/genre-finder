import { describe, expect, it } from 'vitest';
import { parseMediaUrl } from '../functions/_lib/url';

describe('parseMediaUrl', () => {
  it('Spotify のトラック URL', () => {
    const parsed = parseMediaUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    expect(parsed).toMatchObject({
      platform: 'spotify',
      id: '4cOdK2wGLETKBW3PvgPWqT',
    });
  });

  it('Spotify の intl 付き URL', () => {
    expect(
      parseMediaUrl('https://open.spotify.com/intl-ja/track/4cOdK2wGLETKBW3PvgPWqT?si=abc')?.id,
    ).toBe('4cOdK2wGLETKBW3PvgPWqT');
  });

  it('スキーム省略の Spotify URL も受け付ける', () => {
    expect(parseMediaUrl('open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')?.platform).toBe('spotify');
  });

  it('YouTube の watch URL', () => {
    expect(parseMediaUrl('https://www.youtube.com/watch?v=kJQP7kiw5Fk')?.id).toBe('kJQP7kiw5Fk');
  });

  it('youtu.be の短縮 URL', () => {
    expect(parseMediaUrl('https://youtu.be/kJQP7kiw5Fk')?.id).toBe('kJQP7kiw5Fk');
  });

  it('YouTube Shorts', () => {
    expect(parseMediaUrl('https://youtube.com/shorts/kJQP7kiw5Fk')?.id).toBe('kJQP7kiw5Fk');
  });

  it('Apple Music のアルバム + ?i= 形式', () => {
    const parsed = parseMediaUrl('https://music.apple.com/jp/album/get-lucky/617154241?i=617154366');
    expect(parsed).toMatchObject({
      platform: 'apple',
      id: '617154366',
      albumId: '617154241',
    });
  });

  it('Apple Music の song パス形式', () => {
    expect(parseMediaUrl('https://music.apple.com/jp/song/get-lucky/617154366')?.id).toBe(
      '617154366',
    );
  });

  it('Deezer のトラック URL', () => {
    expect(parseMediaUrl('https://www.deezer.com/track/66609426')?.id).toBe('66609426');
  });

  it('未対応の URL は null', () => {
    expect(parseMediaUrl('https://example.com/track/123')).toBeNull();
    expect(parseMediaUrl('not a url')).toBeNull();
    expect(parseMediaUrl('')).toBeNull();
    expect(parseMediaUrl(null)).toBeNull();
  });
});
