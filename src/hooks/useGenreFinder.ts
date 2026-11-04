import { useEffect, useRef, useState } from 'react';
import type { GenreJudgment, ResolvedPlatform, TrackCandidate } from '@shared/types';
import {
  ApiRequestError,
  fetchAnalyze,
  fetchResolve,
  fetchSearch,
  isAbortError,
  type AnalyzeParams,
} from '@/lib/api';
import { detectLink, PLATFORM_LABELS } from '@/lib/links';
import { AudioFileError, readAudioMetadata } from '@/lib/tags';

export type FinderPhase = 'idle' | 'searching' | 'results' | 'analyzing' | 'judgment' | 'error';

export interface SearchRequest {
  /** API に渡す検索語（曲名）。 */
  q: string;
  artist?: string;
  /** 画面に出す検索語（リンク解決後は曲名 / アーティスト）。 */
  display: string;
}

export type RetryTarget =
  | { kind: 'search'; request: SearchRequest }
  | { kind: 'resolve'; url: string }
  | { kind: 'analyze'; track: TrackCandidate };

export interface FinderError {
  title: string;
  message: string;
  /** サーバーが返した補足（英語のことがある）。 */
  detail?: string;
  retry: RetryTarget | null;
}

const ERROR_TITLES: Record<RetryTarget['kind'], string> = {
  search: '検索できませんでした',
  resolve: 'リンクを読み取れませんでした',
  analyze: 'ジャンルを判定できませんでした',
};

function toFinderError(error: unknown, retry: RetryTarget | null): FinderError {
  const title = retry ? ERROR_TITLES[retry.kind] : '処理できませんでした';
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : 'うまくいきませんでした。もう一度お試しください。';
  const detail = error instanceof ApiRequestError ? error.detail : undefined;
  return { title, message, detail, retry };
}

function linkNotice(platform: ResolvedPlatform, title: string | null, artist: string | null): string {
  const label = PLATFORM_LABELS[platform];
  const name = title ? (artist ? `${title} / ${artist}` : title) : null;
  return name
    ? `${label} のリンクから「${name}」を読み取りました。`
    : `${label} のリンクを読み取りました。`;
}

/**
 * 「これ何ジャンル？」の画面状態。
 * idle → searching → results → analyzing → judgment（+ error）を 1 つのフックで管理する。
 */
export function useGenreFinder() {
  const [phase, setPhase] = useState<FinderPhase>('idle');
  const [tracks, setTracks] = useState<TrackCandidate[]>([]);
  const [judgment, setJudgment] = useState<GenreJudgment | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackCandidate | null>(null);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<FinderError | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  function abortCurrent(): AbortController {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    return controller;
  }

  async function runSearch(request: SearchRequest, options?: { notice?: string }): Promise<void> {
    const controller = abortCurrent();
    setPhase('searching');
    setError(null);
    setNotice(null);
    setTracks([]);
    setJudgment(null);
    setSelectedTrack(null);
    setWarnings([]);
    setSearchRequest(request);

    try {
      const response = await fetchSearch(
        { q: request.q, artist: request.artist },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setTracks(response.tracks);
      setWarnings(response.warnings);
      setNotice(options?.notice ?? null);
      setPhase('results');
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return;
      setError(toFinderError(caught, { kind: 'search', request }));
      setPhase('error');
    }
  }

  async function resolveUrl(url: string): Promise<void> {
    const controller = abortCurrent();
    setPhase('searching');
    setError(null);
    setNotice(null);
    setTracks([]);
    setJudgment(null);
    setSelectedTrack(null);
    setWarnings([]);
    setSearchRequest(null);

    try {
      const response = await fetchResolve(url, controller.signal);
      if (controller.signal.aborted) return;

      const name =
        response.title && response.artist
          ? `${response.title} / ${response.artist}`
          : response.title ?? response.artist ?? '';
      const display = name || `${PLATFORM_LABELS[response.platform]} のリンク`;

      setTracks(response.tracks);
      setWarnings(response.warnings);
      setSearchRequest({
        q: response.title ?? '',
        artist: response.artist ?? undefined,
        display,
      });
      setNotice(linkNotice(response.platform, response.title, response.artist));
      setPhase('results');
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return;
      setError(toFinderError(caught, { kind: 'resolve', url }));
      setPhase('error');
    }
  }

  async function analyzeTrack(track: TrackCandidate): Promise<void> {
    const controller = abortCurrent();
    setPhase('analyzing');
    setError(null);
    setJudgment(null);
    setSelectedTrack(track);
    setWarnings([]);

    const params: AnalyzeParams = { title: track.title, artist: track.artist || undefined };
    if (track.source === 'itunes') params.itunesId = track.sourceId;
    if (track.source === 'deezer') params.deezerId = track.sourceId;

    try {
      const response = await fetchAnalyze(params, controller.signal);
      if (controller.signal.aborted) return;
      setJudgment(response.judgment);
      setWarnings(response.warnings);
      setPhase('judgment');
    } catch (caught) {
      if (controller.signal.aborted || isAbortError(caught)) return;
      setError(toFinderError(caught, { kind: 'analyze', track }));
      setPhase('error');
    }
  }

  function search(raw: string): void {
    const value = raw.trim();
    if (!value) {
      setError({
        title: '検索語が入力されていません',
        message:
          '曲名かアーティスト名を入力してください。Spotify / YouTube のリンクを貼り付けることもできます。',
        retry: null,
      });
      setPhase('error');
      return;
    }

    const link = detectLink(value);
    if (link) {
      void resolveUrl(link.url);
      return;
    }

    void runSearch({ q: value, display: value });
  }

  async function searchFile(file: File): Promise<void> {
    setReadingFile(true);
    setError(null);
    try {
      const metadata = await readAudioMetadata(file);
      const display = metadata.artist
        ? `${metadata.title} / ${metadata.artist}`
        : metadata.title;
      await runSearch(
        { q: metadata.title, artist: metadata.artist, display },
        { notice: metadata.note },
      );
    } catch (caught) {
      setError({
        title: 'ファイルを読み取れませんでした',
        message:
          caught instanceof AudioFileError
            ? caught.message
            : '音声ファイルを読み取れませんでした。別のファイルで試すか、曲名で検索してください。',
        retry: null,
      });
      setPhase('error');
    } finally {
      setReadingFile(false);
    }
  }

  function retry(): void {
    const target = error?.retry;
    if (!target) return;
    if (target.kind === 'search') void runSearch(target.request);
    else if (target.kind === 'resolve') void resolveUrl(target.url);
    else void analyzeTrack(target.track);
  }

  function backToResults(): void {
    if (tracks.length === 0) {
      reset();
      return;
    }
    abortCurrent();
    setPhase('results');
    setJudgment(null);
    setSelectedTrack(null);
    setError(null);
    setWarnings([]);
  }

  function reset(): void {
    abortCurrent();
    setPhase('idle');
    setTracks([]);
    setJudgment(null);
    setSelectedTrack(null);
    setSearchRequest(null);
    setWarnings([]);
    setNotice(null);
    setError(null);
    setReadingFile(false);
  }

  return {
    phase,
    tracks,
    judgment,
    selectedTrack,
    searchRequest,
    warnings,
    notice,
    error,
    readingFile,
    search,
    resolveUrl,
    analyzeTrack,
    searchFile,
    retry,
    reset,
    backToResults,
  };
}
