/**
 * 曲名・アルバム名・タグから「ゲーム音楽らしさ」を検出する。
 * 外部通信しない純粋関数。検出結果は analyze で証拠に変換される。
 */

import type { SourceName } from '../../shared/types';

export interface GameDetectionField {
  /** 表示用のフィールド名（「曲名」「アルバム名」など） */
  label: string;
  text: string | null | undefined;
  /** このテキストを提供したソース */
  source: SourceName;
  /** フィールドごとの重み補正（曲名・アルバム名を重視） */
  scale: number;
}

export interface GameDetection {
  canonicalId: string;
  /** 検出に使った語 */
  raw: string;
  weight: number;
  note: string;
  source: SourceName;
}

interface GameRule {
  id: string;
  weight: number;
  pattern: RegExp;
}

/** 上から順に評価し、同じジャンルは最大重みの1件だけ残す。 */
const GAME_RULES: GameRule[] = [
  // 東方アレンジ（作品名・代表曲も拾う）
  {
    id: 'touhou-arrange',
    weight: 0.75,
    pattern:
      /東方プロジェクト|東方アレンジ|東方|とうほう|touhou|bad apple|少女綺想曲|魔理沙|u\.n\. owen|ネクロファンタジア|亡き王女|例大祭|博麗神社|紅楼夢|sound holic|iosys|eastnewsound|silver forest|幽閉サテライト|c-clays|舞風|digital wing|豚乙女|alstroemeria records|上海アカデミー|上海アリス|アリスシャッハ|凋叶棕/i,
  },
  // 同人イベント（M3 / コミケ / C9x / サンクリ）。"M3" 単体は誤検出するので年・季節付きのみ
  {
    id: 'game-music',
    weight: 0.6,
    pattern:
      /m3[-‐\s]?(?:19|20)\d{2}|m3\s*(?:春|秋)|コミックマーケット|コミケ|\bc9[0-9]\b|サンクリ|(?:東方|同人|音ゲー|ゲーム).{0,12}\bbooth\b|\bbooth\b.{0,12}(?:東方|同人|音ゲー|ゲーム)/i,
  },
  // 音ゲー（BMS / IIDX / DDR など）
  {
    id: 'rhythm-game',
    weight: 0.75,
    pattern:
      /beatmania|\biidx\b|\bbms\b|\bddr\b|dance dance revolution|音ゲー|リズムゲーム|rhythm game|\bosu!\b|太鼓の達人|jubeat|maimai|chunithm|guitar freaks|drummania|sound voltex|\bsdvx\b|プロセカ|プロジェクトセカイ|アイマス|アイドルマスター|ラブライブ|love live|ban ?g dream|bang dream|バンドリ|d4dj|groove coaster|ノスタルジア|オンゲキ|\bwacca\b|ポップン|popn music|museca|dance evolution|arcaea|deemo|cytus/i,
  },
  // チップチューン（8bit / ファミコン）
  {
    id: 'chiptune',
    weight: 0.7,
    pattern:
      /chiptune|チップチューン|8-?bit|ファミコン|famicom|\bnes\b|ピコピコ|ゲームボーイ|game boy|スーファミ|super famicom|\bsnes\b/i,
  },
  // FM音源（PC-88/98）
  { id: 'fm-synth', weight: 0.7, pattern: /fm音源|fm synth|pc-?88|pc-?98|98音源|pc engine|pcエンジン|\bmsx\b/i },
  // ノベルゲーム
  {
    id: 'visual-novel',
    weight: 0.7,
    pattern: /visual novel|ビジュアルノベル|ノベルゲーム|ギャルゲー|galgame|エロゲ|eroge|アドベンチャーゲーム/i,
  },
  // オーケストラゲーム
  {
    id: 'game-orchestral',
    weight: 0.65,
    pattern: /ゲームオーケストラ|オーケストラゲーム|orchestral game|symphonic game|ゲーム交響曲/i,
  },
  // 有名ゲーム作品・ゲーム作曲家（メタデータに作品名が出る場合）
  {
    id: 'game-music',
    weight: 0.65,
    pattern:
      /undertale|deltarune|chrono trigger|final fantasy|dragon quest|zelda|ゼルダ|super mario|マリオ|pokemon|ポケモン|kirby|カービィ|sonic the hedgehog|ソニック|mega man|ロックマン|castlevania|悪魔城|kingdom hearts|キングダムハーツ|nier|persona|ペルソナ|monster hunter|モンハン|splatoon|スプラトゥーン|toby fox|\bzun\b|植松伸夫|光田康典|目黒将司|古代祐三|並木学|下村陽子|岡部啓一/i,
  },
  // ゲーム音楽そのもの（明示的な語）
  {
    id: 'game-music',
    weight: 0.7,
    pattern:
      /ゲーム音楽|ゲームミュージック|video game music|\bvgm\b|game music|game soundtrack|ゲームサウンドトラック|ゲームbgm|ゲームost/i,
  },
  // ゲーム全般・BGM・サントラ（やや弱め）
  {
    id: 'game-music',
    weight: 0.5,
    pattern: /ゲーム|\bgame\b|\bbgm\b|original soundtrack|\bsoundtrack\b|サウンドトラック|サントラ|\bost\b/i,
  },
  // ボカロ（ゲーム音楽の文脈でもよく出る）
  { id: 'vocaloid', weight: 0.55, pattern: /vocaloid|ボカロ|ボーカロイド|初音ミク|hatsune miku/i },
];

export interface GameWork {
  pattern: RegExp;
  title: string;
}

/**
 * ゲーム作品名の対応表。作品固有の語だけを対象にする（誤検出防止）。
 * 上から順に評価し、最初に一致した作品名を返す。
 */
export const GAME_WORKS: GameWork[] = [
  { pattern: /undertale/i, title: 'UNDERTALE' },
  { pattern: /deltarune/i, title: 'DELTARUNE' },
  { pattern: /chrono trigger|クロノ・?トリガー/i, title: 'CHRONO TRIGGER' },
  { pattern: /final fantasy|ファイナルファンタジー/i, title: 'FINAL FANTASY' },
  { pattern: /dragon quest|ドラゴンクエスト|ドラクエ/i, title: 'DRAGON QUEST' },
  { pattern: /the legend of zelda|ゼルダの伝説|ゼルダ/i, title: 'ZELDA' },
  { pattern: /super mario|スーパーマリオ|マリオ/i, title: 'SUPER MARIO' },
  { pattern: /pok[eé]mon|ポケットモンスター|ポケモン/i, title: 'ポケモン' },
  { pattern: /kirby|カービィ/i, title: 'KIRBY' },
  { pattern: /sonic the hedgehog|ソニック・?ザ・?ヘッジホッグ|ソニック/i, title: 'SONIC THE HEDGEHOG' },
  { pattern: /mega ?man|ロックマン/i, title: 'MEGA MAN' },
  { pattern: /castlevania|悪魔城ドラキュラ|悪魔城/i, title: 'CASTLEVANIA' },
  { pattern: /kingdom hearts|キングダムハーツ/i, title: 'KINGDOM HEARTS' },
  { pattern: /\bnier\b|ニーア/i, title: 'NIER' },
  { pattern: /persona|ペルソナ/i, title: 'PERSONA' },
  { pattern: /monster hunter|モンスターハンター|モンハン/i, title: 'MONSTER HUNTER' },
  { pattern: /splatoon|スプラトゥーン/i, title: 'SPLATOON' },
  { pattern: /xenoblade|ゼノブレイド/i, title: 'XENOBLADE' },
  { pattern: /beatmania|iidx/i, title: 'beatmania IIDX' },
  // BMS は IIDX 系の譜面フォーマット
  { pattern: /\bbms\b/i, title: 'beatmania IIDX' },
  { pattern: /project sekai|プロジェクトセカイ|プロセカ/i, title: 'プロジェクトセカイ' },
  {
    pattern:
      /idol ?master|アイドルマスター|アイマス|デレステ|デレマス|ミリオンライブ|シャニマス|学園アイドルマスター/i,
    title: 'アイドルマスター',
  },
  { pattern: /love live|ラブライブ/i, title: 'ラブライブ！' },
  { pattern: /ban ?g dream|バンドリ/i, title: 'BanG Dream!' },
  { pattern: /d4dj/i, title: 'D4DJ' },
  { pattern: /sound voltex|\bsdvx\b/i, title: 'SOUND VOLTEX' },
  {
    pattern:
      /touhou|東方|とうほう|bad apple|u\.n\. owen|少女綺想曲|魔理沙|ネクロファンタジア|亡き王女|例大祭|博麗神社|紅楼夢|sound holic|iosys|eastnewsound|silver forest|幽閉サテライト|c-clays|舞風|digital wing|豚乙女|alstroemeria records|上海アカデミー|上海アリス|アリスシャッハ|凋叶棕/i,
    title: '東方Project',
  },
  { pattern: /pop'?n music|ポップンミュージック/i, title: "pop'n music" },
  { pattern: /dance dance revolution|\bddr\b/i, title: 'DDR' },
  { pattern: /太鼓の達人|taiko no tatsujin/i, title: '太鼓の達人' },
  { pattern: /\bosu!\b/i, title: 'osu!' },
  { pattern: /maimai/i, title: 'maimai' },
  { pattern: /chunithm/i, title: 'CHUNITHM' },
  { pattern: /jubeat/i, title: 'jubeat' },
  { pattern: /arcaea/i, title: 'Arcaea' },
  { pattern: /deemo/i, title: 'DEEMO' },
  { pattern: /cytus/i, title: 'Cytus' },
  { pattern: /minecraft/i, title: 'MINECRAFT' },
  { pattern: /\bdoom\b/i, title: 'DOOM' },
  { pattern: /\bhalo\b/i, title: 'HALO' },
  { pattern: /genshin impact|原神/i, title: '原神' },
  { pattern: /ace attorney|逆転裁判/i, title: '逆転裁判' },
  { pattern: /professor layton|レイトン教授/i, title: 'レイトン教授' },
  { pattern: /ひぐらしのなく頃に|higurashi/i, title: 'ひぐらしのなく頃に' },
  { pattern: /umineko|うみねこのなく頃に/i, title: 'うみねこのなく頃に' },
  { pattern: /steins;?gate|シュタインズ・?ゲート/i, title: 'STEINS;GATE' },
  { pattern: /fate\/?grand order|\bfgo\b/i, title: 'Fate/Grand Order' },
];

/** 曲名・アルバム名・タグからゲーム作品名を検出する。見つからなければ null。 */
export function detectGameWork(fields: GameDetectionField[]): string | null {
  for (const field of fields) {
    const text = field.text?.normalize('NFKC');
    if (!text) continue;
    for (const work of GAME_WORKS) {
      if (work.pattern.test(text)) return work.title;
    }
  }
  return null;
}

/** 検出結果を返す。ゲーム固有語が無ければ空配列。 */
export function detectGameMusic(fields: GameDetectionField[]): GameDetection[] {
  const best = new Map<string, GameDetection>();

  for (const field of fields) {
    const text = field.text?.normalize('NFKC').trim();
    if (!text) continue;
    for (const rule of GAME_RULES) {
      const match = text.match(rule.pattern);
      if (!match) continue;
      const raw = match[0];
      const weight = Math.round(rule.weight * field.scale * 1000) / 1000;
      const key = `${rule.id}|${field.source}`;
      const existing = best.get(key);
      if (existing && existing.weight >= weight) continue;
      best.set(key, {
        canonicalId: rule.id,
        raw,
        weight,
        note: `${field.label}に「${raw}」`,
        source: field.source,
      });
    }
  }

  return [...best.values()];
}
