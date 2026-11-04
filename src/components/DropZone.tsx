import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

interface DropZoneProps {
  onFile: (file: File) => void;
  reading: boolean;
}

/** 音声ファイルのドラッグ&ドロップ / ファイル選択。タグ読み取りは呼び出し側で行う。 */
export default function DropZone({ onFile, reading }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File | null | undefined) {
    if (!file || reading) return;
    onFile(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    pickFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!reading) setDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  return (
    <section className="dropzone-block" aria-labelledby="dropzone-label">
      <div className="or-divider" aria-hidden="true">
        <span>または</span>
      </div>
      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id="audio-file"
          className="sr-only"
          type="file"
          tabIndex={-1}
          accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg"
          onChange={handleChange}
          aria-labelledby="dropzone-label"
        />
        <button
          type="button"
          className="dropzone__button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
        >
          <span className="dropzone__icon" aria-hidden="true">
            {reading ? (
              <span className="spinner spinner--amber" />
            ) : (
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="dropzone__text">
            <span id="dropzone-label" className="dropzone__title">
              {reading ? 'タグを読み取っています…' : '音声ファイルをドロップ'}
            </span>
            <span className="dropzone__hint">
              {reading
                ? '曲名とアーティストを確認しています。'
                : 'またはクリックして選択 — mp3 / m4a / flac / wav / ogg'}
            </span>
          </span>
          <span className="micro dropzone__meta" aria-hidden="true">
            TAG READ
          </span>
        </button>
      </div>
    </section>
  );
}
