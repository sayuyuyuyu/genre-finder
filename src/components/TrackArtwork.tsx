import { useEffect, useState } from 'react';

type ArtworkSize = 'sm' | 'md' | 'lg';

interface TrackArtworkProps {
  artworkUrl?: string;
  size: ArtworkSize;
  priority?: boolean;
}

/**
 * アルバムアート。URL が無い・読み込みに失敗した場合は CSS 生成の
 * レコード風プレースホルダを出す（外部画像は読み込まない）。
 */
export default function TrackArtwork({ artworkUrl, size, priority = false }: TrackArtworkProps) {
  const [failed, setFailed] = useState(false);
  const className = `artwork artwork--${size}`;

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  if (artworkUrl && !failed) {
    return (
      <img
        className={className}
        src={artworkUrl}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className={`${className} artwork--placeholder`} aria-hidden="true" />;
}
