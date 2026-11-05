import { useCallback, useEffect, useRef, useState } from 'react';

export interface PreviewState {
  playing: boolean;
  progress: number;
  available: boolean;
  /** 読み込み・再生に失敗した。 */
  failed: boolean;
  toggle: () => void;
  stop: () => void;
}

/**
 * 30秒試聴。URL は iTunes / Deezer のプレビュー音源。
 * 画面を離れたら必ず止める。別の曲に変わったらリセットする。
 */
export function usePreview(url?: string): PreviewState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setFailed(false);
  }, []);

  useEffect(() => {
    stop();
  }, [url, stop]);

  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => {
    if (!url || failed) return;
    if (audioRef.current) {
      stop();
      return;
    }

    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.addEventListener('timeupdate', () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      setProgress(0);
      audioRef.current = null;
    });
    audio.addEventListener('error', () => {
      setPlaying(false);
      setProgress(0);
      setFailed(true);
      audioRef.current = null;
    });

    audioRef.current = audio;
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        audioRef.current = null;
        setPlaying(false);
        setFailed(true);
      });
  }, [url, failed, stop]);

  return { playing, progress, available: Boolean(url), failed, toggle, stop };
}
