import type { JsMediaTags } from 'jsmediatags';
import { guessFromFilename } from '@/lib/filename';

/** 音声ファイル周りの、日本語のまま画面に出せるエラー。 */
export class AudioFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioFileError';
  }
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.oga', '.aac', '.opus', '.wma'];

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  const name = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension));
}

type ImportedModule = { default?: JsMediaTags } & Partial<JsMediaTags>;

async function loadJsMediaTags(): Promise<JsMediaTags> {
  let imported: ImportedModule;
  try {
    imported = (await import('jsmediatags/dist/jsmediatags.min.js')) as ImportedModule;
  } catch {
    throw new AudioFileError(
      'タグ読み取りの準備に失敗しました。ページを再読み込みするか、曲名で検索してください。',
    );
  }
  const lib = imported.default ?? (imported as JsMediaTags);
  if (!lib || typeof lib.read !== 'function') {
    throw new AudioFileError(
      'タグ読み取りの準備に失敗しました。ページを再読み込みするか、曲名で検索してください。',
    );
  }
  return lib;
}

function cleanTagValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function describeTagError(error: unknown): string {
  if (error instanceof AudioFileError && error.message === 'timeout') {
    return '読み取りがタイムアウトしました';
  }
  if (error instanceof AudioFileError) {
    if (error.message === 'tagFormat') return '対応していないタグ形式です';
    if (error.message === 'fileReader') return 'ファイルの読み込みに失敗しました';
    return 'タグの解析に失敗しました';
  }
  return 'タグの解析に失敗しました';
}

function readTags(file: File): Promise<{ title?: string; artist?: string }> {
  return loadJsMediaTags().then(
    (lib) =>
      new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new AudioFileError('timeout')), 12000);

        try {
          lib.read(file, {
            onSuccess(result) {
              window.clearTimeout(timer);
              resolve({
                title: cleanTagValue(result?.tags?.title),
                artist: cleanTagValue(result?.tags?.artist),
              });
            },
            onError(error) {
              window.clearTimeout(timer);
              reject(new AudioFileError(error?.type || 'read-error'));
            },
          });
        } catch {
          window.clearTimeout(timer);
          reject(new AudioFileError('read-error'));
        }
      }),
  );
}

function describeGuess(title: string, artist?: string): string {
  return artist ? `${title} / ${artist}` : title;
}

export interface AudioMetadata {
  title: string;
  artist?: string;
  /** 画面に出す日本語の説明（タグから読めた／ファイル名から推測した）。 */
  note: string;
}

/**
 * 音声ファイルからタグを読む。タグが無い／読めない場合はファイル名から推測する。
 * どうしても曲名が決まらないときだけ AudioFileError を投げる。
 */
export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  if (!isAudioFile(file)) {
    throw new AudioFileError(
      '音声ファイルではないようです。mp3 / m4a / flac / wav / ogg のファイルを選んでください。',
    );
  }

  const guess = guessFromFilename(file.name);
  let tagged: { title?: string; artist?: string } = {};
  let tagError: string | null = null;

  try {
    tagged = await readTags(file);
  } catch (error) {
    tagError = describeTagError(error);
  }

  const tagTitle = tagged.title;
  const tagArtist = tagged.artist;
  const title = tagTitle ?? guess?.title;
  const artist = tagArtist ?? guess?.artist;

  if (!title) {
    throw new AudioFileError(
      tagError
        ? '音声ファイルのタグを読み取れず、ファイル名からも曲名を推測できませんでした。「アーティスト - 曲名」の形式でファイル名を付けるか、曲名で検索してください。'
        : '曲名を特定できませんでした。「アーティスト - 曲名」の形式でファイル名を付けるか、曲名で検索してください。',
    );
  }

  let note: string;
  if (tagTitle) {
    if (tagArtist) {
      note = `タグから「${tagTitle} / ${tagArtist}」を読み取りました。`;
    } else if (guess?.artist) {
      note = `タグから「${tagTitle}」を読み取りました。アーティスト名はファイル名から補いました。`;
    } else {
      note = `タグから「${tagTitle}」を読み取りました。`;
    }
  } else if (tagError) {
    note = `タグを読み取れませんでした（${tagError}）。ファイル名から「${describeGuess(title, artist)}」と推測して検索します。`;
  } else {
    note = `タグが見つかりませんでした。ファイル名から「${describeGuess(title, artist)}」と推測して検索します。`;
  }

  return { title, artist, note };
}
