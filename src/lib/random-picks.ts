/**
 * RANDOM ボタン用の曲リスト。ジャンルも時代もバラバラに混ぜる。
 * IIDX の RANDOM オプションのように、選曲を任せられる入口。
 */
export const RANDOM_PICKS = [
  'Daft Punk Get Lucky',
  'YOASOBI 夜に駆ける',
  'Queen Bohemian Rhapsody',
  'Dave Brubeck Take Five',
  'Toby Fox Megalovania',
  'nomico Bad Apple!!',
  'Garakuta Doll Play',
  'The Weeknd Blinding Lights',
  '米津玄師 Lemon',
  '宇多田ヒカル First Love',
  'Michael Jackson Billie Jean',
  'Nirvana Smells Like Teen Spirit',
  '坂本龍一 Merry Christmas Mr. Lawrence',
  '米津玄師 千本桜',
  '高橋洋子 残酷な天使のテーゼ',
  'NewJeans Ditto',
  'Kendrick Lamar HUMBLE.',
  'Bill Evans Waltz for Debby',
  'Ariana Grande Into You',
  'King Gnu 白日',
] as const;

let lastIndex = -1;

/** 直前と同じ曲にならないように1曲選ぶ。 */
export function pickRandomQuery(): string {
  let index = Math.floor(Math.random() * RANDOM_PICKS.length);
  if (RANDOM_PICKS.length > 1 && index === lastIndex) {
    index = (index + 1 + Math.floor(Math.random() * (RANDOM_PICKS.length - 1))) % RANDOM_PICKS.length;
  }
  lastIndex = index;
  return RANDOM_PICKS[index];
}
