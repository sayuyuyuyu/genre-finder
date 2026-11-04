export interface FilenameGuess {
  title: string;
  artist?: string;
}

/** 「01 - 」「1. 」「[02] 」のようなトラック番号。 */
const TRACK_NUMBER = /^\s*(?:\[\d{1,3}\]|\d{1,3}[.)]|\d{2,3})[\s._-]+/;

/** 「(Official Video)」「[MV]」など末尾のノイズ。 */
const TRAILING_NOISE =
  /\s*[\(\[（【](?:official\s*(?:music\s*)?(?:video|audio)|mv|music\s*video|lyric\s*video|lyrics?|audio|full\s*(?:ver\.?|version)|高音質)[\)\]）】]\s*$/i;

const EXTENSION = /\.[a-z0-9]{1,6}$/i;

function splitPair(value: string, separator: RegExp): FilenameGuess | null {
  const parts = value.split(separator).map((part) => part.trim());
  if (parts.length !== 2) return null;
  const [artist, title] = parts;
  if (!artist || !title || artist.length < 2 || title.length < 2) return null;
  return { artist, title };
}

/**
 * 音声ファイル名から「アーティスト - 曲名」を推測する。
 * 区切りが無い場合はファイル名全体を曲名として扱う。
 */
export function guessFromFilename(filename: string): FilenameGuess | null {
  const withoutExtension = filename.replace(EXTENSION, '').trim();
  if (!withoutExtension) return null;

  const stripped = withoutExtension.replace(TRACK_NUMBER, '').trim();
  const cleaned = (stripped || withoutExtension).replace(TRAILING_NOISE, '').trim();
  const base = cleaned || stripped || withoutExtension;

  // 「Artist - Title」「Artist – Title」「Artist — Title」
  const spaced = splitPair(base, /\s+[-–—]\s+/);
  if (spaced) return spaced;

  // 「Artist_Title」（区切りがアンダースコアのみの場合）
  if (base.includes('_') && !base.includes(' ')) {
    const underscored = splitPair(base, /_+/);
    if (underscored) return underscored;
  }

  const normalized = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return { title: normalized };
}
