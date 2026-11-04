/**
 * ラベル・曲名・アーティスト名の正規化。
 * ここは外部 API に依存しない純粋関数だけを置く（テスト対象）。
 */

import { GENRE_BY_ID, GENRES } from './taxonomy';

export type MatchKind = 'exact' | 'alias' | 'fuzzy';

export interface NormalizeResult {
  id: string;
  matchedBy: MatchKind;
}

/** 比較用の文字列にする。全角半角・大文字小文字・記号・中黒の揺れを吸収する。 */
export function normalizeText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** 日本語（ひらがな・カタカナ・漢字）を含むか。Deezer の言語切り替えに使う。 */
export function containsJapanese(text: string | null | undefined): boolean {
  return Boolean(text && /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/.test(text));
}

/** id（kebab-case）を比較用の表記に変換する。例: "r-and-b" → "r and b" */
function idAsText(id: string): string {
  return id.replace(/-/g, ' ');
}

interface AliasEntry {
  text: string;
  id: string;
}

/** 正規化済みエイリアスの索引。長い表記を優先して前方一致させるため長さ降順に並べる。 */
const ALIAS_INDEX: AliasEntry[] = (() => {
  const seen = new Set<string>();
  const entries: AliasEntry[] = [];
  for (const genre of GENRES) {
    for (const alias of genre.aliases) {
      const text = normalizeText(alias);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      entries.push({ text, id: genre.id });
    }
  }
  return entries.sort((a, b) => b.text.length - a.text.length);
})();

const ID_TEXT_INDEX: AliasEntry[] = GENRES.map((genre) => ({
  text: idAsText(genre.id),
  id: genre.id,
})).sort((a, b) => b.text.length - a.text.length);

/**
 * ソースが返した生ラベルをタクソノミーの id に正規化する。
 * 完全一致（id） → エイリアス完全一致 → 前方一致（長い表記を優先）の順。
 */
export function normalize(raw: string | null | undefined): NormalizeResult | null {
  const text = normalizeText(raw);
  if (!text) return null;

  for (const entry of ID_TEXT_INDEX) {
    if (entry.text === text) return { id: entry.id, matchedBy: 'exact' };
  }
  for (const entry of ALIAS_INDEX) {
    if (entry.text === text) return { id: entry.id, matchedBy: 'alias' };
  }
  for (const entry of ALIAS_INDEX) {
    if (entry.text.length < 3) continue;
    if (text.startsWith(`${entry.text} `) || text.endsWith(` ${entry.text}`)) {
      return { id: entry.id, matchedBy: 'fuzzy' };
    }
  }
  return null;
}

/** タクソノミーに載っている id かどうか。 */
export function isKnownGenreId(id: string): boolean {
  return GENRE_BY_ID.has(id);
}

/** 曲名の比較用キー。feat. や (Remastered) などの付加情報を落とす。 */
export function normalizeTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw.normalize('NFKC').toLowerCase();
  // かっこ書き（(Remastered 2011) や (Radio Edit - feat. ...) など）を落とす
  text = text.replace(/[([（【{｛][^)\]）】}｝]*[)\]）】}｝]/g, ' ');
  // 曲名末尾の "feat. X" / "ft. X" / "with X" を落とす
  text = text.replace(/\s(?:feat|ft|featuring|with)\.?\s.*$/i, ' ');
  // ダッシュ以降のバージョン表記を落とす
  text = text.replace(
    /\s[-–—]\s(?:remaster(?:ed)?|radio edit|single version|album version|live|explicit|clean|mono|stereo|deluxe|bonus track|from .*).*$/i,
    ' ',
  );
  text = text.replace(
    /\b(?:remaster(?:ed)?|radio edit|single version|album version|deluxe edition|explicit|clean)\b/gi,
    ' ',
  );
  return normalizeText(text);
}

const ARTIST_NOISE =
  /\b(?:vevo|official|official channel|topic|music|records|tv|channel|オフィシャル|公式)\b/gi;

/** アーティスト名の比較用キー。VEVO や "- Topic"、複数アーティスト表記を整理する。 */
export function normalizeArtist(raw: string | null | undefined): string {
  if (!raw) return '';
  let text = raw.normalize('NFKC');
  // YouTube のチャンネル名ノイズ
  text = text.replace(/\s*-\s*topic\s*$/i, ' ');
  // "Daft Punk feat. Pharrell" のような客演表記は先頭アーティストだけを比較する
  text = text.replace(/\s(?:feat|ft|featuring)\.?\s.*$/i, ' ');
  text = text.replace(ARTIST_NOISE, ' ');
  // "A, B & C" のような複数表記は先頭のアーティストだけを比較に使う
  text = text.split(/\s*,\s*/)[0] ?? text;
  return normalizeText(text);
}

/** 重複排除に使うキー。 */
export function trackKey(title: string, artist: string | null | undefined): string {
  return `${normalizeTitle(title)}|${normalizeArtist(artist)}`;
}

/**
 * 2つの文字列の近さ（0-1）。
 * 完全一致・包含・トークンの一致率を組み合わせる。日本語はスペースで区切られないため
 * 部分一致（contains）の比重を大きめにしている。
 */
export function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return 0.7 + 0.25 * ratio;
  }
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  const jaccard = shared / (leftTokens.size + rightTokens.size - shared);
  // トークンが1つも重ならない場合は、文字レベルの部分一致を軽く見る
  if (shared === 0) {
    return left.includes(right.slice(0, 3)) || right.includes(left.slice(0, 3)) ? 0.15 : 0;
  }
  return 0.2 + 0.7 * jaccard;
}
