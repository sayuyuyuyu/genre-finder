/**
 * YouTube oEmbed クライアント（認証不要）。
 */

import { fetchJson } from './http';

export interface YouTubeOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

export async function youtubeOEmbed(videoUrl: string): Promise<YouTubeOEmbed | null> {
  const params = new URLSearchParams({ url: videoUrl, format: 'json' });
  try {
    return await fetchJson<YouTubeOEmbed>(
      `https://www.youtube.com/oembed?${params.toString()}`,
    );
  } catch {
    return null;
  }
}
