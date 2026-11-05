import type { ConfidenceLevel, GenreScore, TrackCandidate } from '@shared/types';

/** arcade ラベルが無い場合のフォールバック（全大文字）。 */
export function arcadeOf(score: Pick<GenreScore, 'labelEn'> & { arcade?: string }): string {
  if (score.arcade && score.arcade.trim()) return score.arcade.trim().toUpperCase();
  return score.labelEn.toUpperCase();
}

/**
 * 信頼度を IIDX 風の LEVEL（1〜12）に変換する。
 * 低い値でも目盛りが寂しくならないよう、平方根で持ち上げる。％表示が正確な値。
 */
export function levelOf(confidence: number): number {
  if (!Number.isFinite(confidence) || confidence <= 0) return 1;
  return Math.min(12, Math.max(1, Math.round(Math.sqrt(confidence) * 12)));
}

const LEVEL_WORDS: Record<ConfidenceLevel, string> = {
  high: '確定でいい',
  medium: 'たぶん合ってる',
  low: '雰囲気で選んだ',
  unknown: '情報不足',
};

const FAMILY_COMMENTS: Record<string, string[]> = {
 エレクトロニック: ['4つ打ち。夜が長くなるやつ。', 'フロアの温度が上がるやつ。', '機械が歌ってる。'],
  ダンス: ['とりあえず体が動くやつ。', 'フロア想定。'],
  ポップス: ['サビで勝つタイプ。', '耳に残る。それでいい。'],
  ロック: ['歪んでる。正義。', 'ギターが喋ってる。'],
  ヒップホップ: ['低音が主役。', 'ビートに乗るやつ。'],
  'R&B・ソウル': ['夜に似合うやつ。', '声で持っていくタイプ。'],
  ジャズ: ['夜と煙草のにおい。', 'アドリブが気持ちいい。'],
  クラシック: ['壮大。映画の最終局面。', '楽譜が正義。'],
  'フォーク・アコースティック': ['木の音がする。', '静かに効くやつ。'],
  メタル: ['速い。重い。正しい。', '音量を上げるやつ。'],
  'パンク・オルタナティブ': ['3分で終わる。それでいい。', '角が立ってる。'],
  'レゲエ・カリビアン': ['ゆるく行こう。', '裏拍で揺れるやつ。'],
  ラテン: ['腰で聴くやつ。', '陽の気配。'],
  ワールド: ['知らない国に行ける。', '現地の空気ごと。'],
  サウンドトラック: ['映像が浮かぶやつ。', '何かの名場面。'],
  'ゲームミュージック': ['ピコピコ。耳が喜ぶやつ。', '何かのボス戦。', 'ファミコンの残響。'],
  'アニソン・ボカロ': ['イントロで分かるやつ。', '中毒性あり。'],
  ゴスペル・ソウル: ['魂で歌うやつ。', '教会の空気。'],
  ブルース: ['12小節。それだけ。', '渋い。'],
  カントリー: ['アメリカの道。', '素朴で強い。'],
  その他: ['分類不能。それが個性。', 'たぶんそう。'],
};

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

/**
 * 判定の一行コメント。ジャンルと信頼度から選ぶ。同じ曲なら毎回同じ文言になる。
 * 文章で説明する代わりに、この一行だけを出す。
 */
export function commentOf(
  track: Pick<TrackCandidate, 'id'>,
  score: Pick<GenreScore, 'family'> | null,
  level: ConfidenceLevel,
  tagline?: string,
): string {
  if (tagline && tagline.trim()) return tagline.trim();

  const pool = (score && FAMILY_COMMENTS[score.family]) ?? FAMILY_COMMENTS['その他'];
  const pick = pool[hash(track.id ?? '') % pool.length];

  if (level === 'unknown') return '情報が足りません。別の言い方でどうぞ。';
  if (level === 'low') return `${LEVEL_WORDS.low}。${pick}`;
  return pick;
}
