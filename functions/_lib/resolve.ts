/**
 * 共有リンクの解決。Spotify / YouTube / Apple Music / Deezer の URL から
 * 曲名とアーティストを取り出し、そのまま検索まで実行する。
 */

import type { ResolveResponse, TrackCandidate } from '../../shared/types';
import { cleanArtistName, cleanTrackTitle, splitArtistTitle } from '../../shared/genre/title';
import { deezerTrack } from './deezer';
import { envValue, type Env } from './env';
import { toErrorMessage } from './http';
import { itunesLookup } from './itunes';
import { searchTracks } from './search';
import { spotifyPublicMeta, spotifyTrackFromApi } from './spotify';
import type { ParsedMediaUrl } from './url';
import { youtubeOEmbed } from './youtube';

export interface ResolvedLink {
  title: string | null;
  artist: string | null;
  warnings: string[];
}

async function resolveSpotify(parsed: ParsedMediaUrl, env?: Env): Promise<ResolvedLink> {
  const warnings: string[] = [];
  const hasCredentials = Boolean(
    envValue(env, 'SPOTIFY_CLIENT_ID') && envValue(env, 'SPOTIFY_CLIENT_SECRET'),
  );

  let info = null;
  if (hasCredentials) {
    info = await spotifyTrackFromApi(parsed.id, env).catch(() => null);
    if (!info) warnings.push('Spotify API から情報を取得できなかったため、公開ページから読み取りました。');
  }
  if (!info) {
    info = await spotifyPublicMeta(parsed.url, parsed.id).catch(() => null);
  }
  if (!info) {
    warnings.push('Spotify のリンクから曲名を取得できませんでした。曲名を直接入力してください。');
    return { title: null, artist: null, warnings };
  }
  return {
    title: info.title ? cleanTrackTitle(info.title) : null,
    artist: info.artist ? cleanArtistName(info.artist) || info.artist : null,
    warnings,
  };
}

async function resolveYouTube(parsed: ParsedMediaUrl): Promise<ResolvedLink> {
  const warnings: string[] = [];
  const oembed = await youtubeOEmbed(parsed.url);
  if (!oembed?.title) {
    warnings.push('YouTube のリンクから曲名を取得できませんでした。曲名を直接入力してください。');
    return { title: null, artist: null, warnings };
  }

  const split = splitArtistTitle(oembed.title);
  let artist = split.artist ?? '';
  if (!artist && oembed.author_name) {
    artist = cleanArtistName(oembed.author_name);
  }
  return {
    title: split.title || cleanTrackTitle(oembed.title),
    artist: artist || null,
    warnings,
  };
}

async function resolveApple(parsed: ParsedMediaUrl): Promise<ResolvedLink> {
  const warnings: string[] = [];
  const track = await itunesLookup(parsed.id).catch(() => null);
  if (track) {
    return {
      title: cleanTrackTitle(track.trackName),
      artist: cleanArtistName(track.artistName) || track.artistName,
      warnings,
    };
  }

  // lookup で確定できなければ URL のスラッグから曲名を推測する
  const slug = parsed.raw.split('?')[0]?.split('/').filter(Boolean).at(-2);
  if (slug) {
    warnings.push('Apple Music の曲 ID を特定できなかったため、URL から曲名を推測しました。');
    return { title: cleanTrackTitle(slug.replace(/-/g, ' ')), artist: null, warnings };
  }
  warnings.push('Apple Music のリンクから曲名を取得できませんでした。');
  return { title: null, artist: null, warnings };
}

async function resolveDeezer(parsed: ParsedMediaUrl): Promise<ResolvedLink> {
  const warnings: string[] = [];
  const track = await deezerTrack(parsed.id).catch(() => null);
  if (!track) {
    warnings.push('Deezer のリンクから曲名を取得できませんでした。');
    return { title: null, artist: null, warnings };
  }
  return {
    title: cleanTrackTitle(track.title),
    artist: track.artist?.name ?? null,
    warnings,
  };
}

/** 解析済みリンクから曲名・アーティストを解決し、そのまま検索する。 */
export async function resolveMediaUrl(
  parsed: ParsedMediaUrl,
  env?: Env,
): Promise<ResolveResponse> {
  let resolved: ResolvedLink;
  switch (parsed.platform) {
    case 'spotify':
      resolved = await resolveSpotify(parsed, env);
      break;
    case 'youtube':
      resolved = await resolveYouTube(parsed);
      break;
    case 'apple':
      resolved = await resolveApple(parsed);
      break;
    case 'deezer':
      resolved = await resolveDeezer(parsed);
      break;
  }

  const warnings = [...resolved.warnings];
  let tracks: TrackCandidate[] = [];
  if (resolved.title) {
    const outcome = await searchTracks(resolved.title, resolved.artist ?? undefined).catch(
      (error: unknown) => {
        warnings.push(`検索に失敗しました（${toErrorMessage(error)}）。`);
        return null;
      },
    );
    if (outcome) {
      tracks = outcome.tracks;
      warnings.push(...outcome.warnings);
    }
  }

  return {
    platform: parsed.platform,
    title: resolved.title,
    artist: resolved.artist,
    tracks,
    warnings,
  };
}
