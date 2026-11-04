/**
 * ジャンル分類表。
 * 各ソースが返す雑多なラベル（iTunes の primaryGenreName、Deezer の日本語ジャンル、
 * MusicBrainz / Last.fm のタグ）を、この表の id に正規化して突き合わせる。
 *
 * - id は kebab-case
 * - family は日本語の大分類
 * - aliases は表記ゆれ（英語・日本語・全角・記号違い）を網羅する。正規化して比較される。
 * - broad は「Pop」「Rock」のような広すぎる大分類。細分類が別ソースから出たら primary を譲る。
 */

export const FAMILIES = [
  'ポップス',
  'ロック',
  'ヒップホップ',
  'R&B・ソウル',
  'エレクトロニック',
  'ダンス',
  'ジャズ',
  'クラシック',
  'フォーク・アコースティック',
  'メタル',
  'パンク・オルタナティブ',
  'レゲエ・カリビアン',
  'ラテン',
  'ワールド',
  'アニソン・ボカロ',
  'サウンドトラック',
  'ゴスペル・ソウル',
  'ブルース',
  'カントリー',
  'その他',
] as const;

export type GenreFamily = (typeof FAMILIES)[number];

export interface GenreDef {
  id: string;
  labelJa: string;
  labelEn: string;
  family: GenreFamily;
  aliases: string[];
  related: string[];
  description: string;
  /** 広すぎる大分類（Pop / Rock / Electronic など）。細分類のロールアップは受けない。 */
  broad?: boolean;
  /** 親ジャンル ID。非 broad ジャンルは親へ重みをロールアップする。 */
  parent?: string;
}

export const GENRES: GenreDef[] = [
  /* ------------------------------- ポップス ------------------------------- */
  {
    id: 'pop',
    labelJa: 'ポップス',
    labelEn: 'Pop',
    family: 'ポップス',
    broad: true,
    aliases: [
      'Pop',
      'Pops',
      'Pop Music',
      'ポップ',
      'ポップス',
      'ポップミュージック',
      'Dance Pop',
      'ダンスポップ',
      'Teen Pop',
      'ティーンポップ',
      'ポップソング',
    ],
    related: ['j-pop', 'synth-pop', 'rock', 'r-and-b'],
    description:
      '覚えやすい旋律とサビを中心にした最も広い分類。シンセや打ち込み主体の現代ポップスから、ギター主体のものまで含む。',
  },
  {
    id: 'j-pop',
    labelJa: 'J-POP',
    labelEn: 'J-Pop',
    family: 'ポップス',
    parent: 'pop',
    aliases: ['J-Pop', 'J Pop', 'JPop', 'Japanese Pop', 'ジェイポップ', 'J-Pop/Rock', 'JPop/Rock'],
    related: ['city-pop', 'idol-pop', 'kayokyoku', 'pop'],
    description:
      '日本で制作されたポップス。日本語の歌詞とJ-POPらしいコード進行・サビ構成が特徴で、1990年代以降の国内ヒット曲の主流。',
  },
  {
    id: 'k-pop',
    labelJa: 'K-POP',
    labelEn: 'K-Pop',
    family: 'ポップス',
    parent: 'pop',
    aliases: ['K-Pop', 'K Pop', 'KPop', 'Korean Pop', 'ケーポップ', 'ケイポップ'],
    related: ['pop', 'dance', 'idol-pop'],
    description:
      '韓国発のアイドルポップス。打ち込みのダンスビート、英語を混ぜたフック、洗練された映像制作が特徴。',
  },
  {
    id: 'city-pop',
    labelJa: 'シティポップ',
    labelEn: 'City Pop',
    family: 'ポップス',
    parent: 'pop',
    aliases: [
      'City Pop',
      'CityPop',
      'シティポップ',
      'シティ・ポップ',
      'Japanese City Pop',
      'City Pop (Japan)',
    ],
    related: ['j-pop', 'funk', 'disco', 'kayokyoku'],
    description:
      '1970〜80年代の日本の都市生活を描いたポップス。ファンクやAORの影響を受けた分厚いベースとシンセ、都会的なサウンドが特徴。',
  },
  {
    id: 'shibuya-kei',
    labelJa: '渋谷系',
    labelEn: 'Shibuya-kei',
    family: 'ポップス',
    parent: 'pop',
    aliases: ['Shibuya-kei', 'Shibuya Kei', '渋谷系', 'シブヤ系'],
    related: ['city-pop', 'pop', 'bossa-nova', 'indie-rock'],
    description:
      '1990年代の渋谷を拠点にしたポップス。ボサノヴァやフレンチポップ、ラウンジの引用と、お洒落で実験的な音作りが特徴。',
  },
  {
    id: 'kayokyoku',
    labelJa: '歌謡曲',
    labelEn: 'Kayokyoku',
    family: 'ポップス',
    parent: 'pop',
    aliases: ['Kayokyoku', 'Kayoukyoku', '歌謡曲', 'カヨウキョク', '昭和歌謡'],
    related: ['enka', 'j-pop', 'pop'],
    description:
      '戦後から1980年代までの日本の大衆歌謡。演歌とポップスの中間にあり、情感のあるメロディと歌手の歌唱力が主役。',
  },
  {
    id: 'enka',
    labelJa: '演歌',
    labelEn: 'Enka',
    family: 'ポップス',
    parent: 'kayokyoku',
    aliases: ['Enka', '演歌', 'エンカ'],
    related: ['kayokyoku', 'pop'],
    description:
      '日本の伝統的な大衆歌謡。こぶしの効いた歌唱とヨナ抜き音階、三味線や尺八を思わせる旋律が特徴。',
  },
  {
    id: 'idol-pop',
    labelJa: 'アイドルポップ',
    labelEn: 'Idol Pop',
    family: 'ポップス',
    parent: 'pop',
    aliases: [
      'Idol Pop',
      'Idol',
      'アイドル',
      'アイドルポップ',
      'Aidoru',
      'Japanese Idol',
      'Female Idol',
    ],
    related: ['j-pop', 'k-pop', 'dance'],
    description:
      'アイドルが歌うキャッチーなポップス。明るい打ち込み、コール&レスポンス、グループでの掛け合いが特徴。',
  },
  {
    id: 'vocal',
    labelJa: 'ボーカル',
    labelEn: 'Vocal',
    family: 'ポップス',
    parent: 'pop',
    aliases: ['Vocal', 'Vocals', 'ボーカル', 'ヴォーカル', '歌もの', 'Vocal Music'],
    related: ['pop', 'soundtrack', 'classical'],
    description:
      '声を主役にした楽曲の総称。ジャンル横断的なラベルで、歌唱・コーラス・アカペラなどを含む。',
  },
  {
    id: 'easy-listening',
    labelJa: 'イージーリスニング',
    labelEn: 'Easy Listening',
    family: 'ポップス',
    parent: 'pop',
    aliases: [
      'Easy Listening',
      'イージーリスニング',
      'Lounge',
      'ラウンジ',
      'ラウンジミュージック',
      'Chillout',
      'チルアウト',
      'チル',
    ],
    related: ['new-age', 'jazz', 'ambient'],
    description:
      '環境音楽として聴ける穏やかな音楽。オーケストラやラウンジ風のアレンジで、BGMとして流れることが多い。',
  },

  /* -------------------------------- ロック -------------------------------- */
  {
    id: 'rock',
    labelJa: 'ロック',
    labelEn: 'Rock',
    family: 'ロック',
    broad: true,
    aliases: [
      'Rock',
      'Rock Music',
      'ロック',
      'Pop Rock',
      'ポップロック',
      'Album Rock',
      'Arena Rock',
      'Classic Rock',
      'Rock and Roll',
      'Rock & Roll',
      'Rock n Roll',
      "Rock 'n' Roll",
      'ロックンロール',
      'J-Rock',
      'J Rock',
      'JRock',
      'ジェイロック',
      'Garage Rock',
      'ガレージロック',
      'Southern Rock',
      'Blues Rock',
      'ブルースロック',
    ],
    related: ['hard-rock', 'alternative', 'indie-rock', 'punk'],
    description:
      'ギター・ベース・ドラムを中心にした大衆音楽の大きな柱。歪んだギターと強いビートを持ち、1950年代のロックンロールから派生した。',
  },
  {
    id: 'alternative',
    labelJa: 'オルタナティブ',
    labelEn: 'Alternative',
    family: 'パンク・オルタナティブ',
    parent: 'rock',
    aliases: ['Alternative', 'Alt', 'Alternative Rock', 'Alt Rock', 'オルタナティブ', 'オルタナティヴ'],
    related: ['indie-rock', 'grunge', 'shoegaze', 'rock'],
    description:
      'メインストリームのロックに対して、より実験的・内省的なロック。80年代の大学ラジオから広がり、90年代に一大ムーブメントになった。',
  },
  {
    id: 'indie-rock',
    labelJa: 'インディーロック',
    labelEn: 'Indie Rock',
    family: 'ロック',
    parent: 'rock',
    aliases: [
      'Indie Rock',
      'インディーロック',
      'インディー',
      'Indie',
      'Lo-Fi',
      'ローファイ',
      'Bedroom Pop',
      'ベッドルームポップ',
    ],
    related: ['alternative', 'shoegaze', 'post-rock', 'rock'],
    description:
      'インディーレーベルや自主制作から生まれるロック。素朴な録音や個性的なアレンジを許容し、DIY精神が特徴。',
  },
  {
    id: 'hard-rock',
    labelJa: 'ハードロック',
    labelEn: 'Hard Rock',
    family: 'ロック',
    parent: 'rock',
    aliases: ['Hard Rock', 'ハードロック', 'Heavy Rock', 'ヘヴィロック'],
    related: ['metal', 'rock', 'grunge', 'psychedelic-rock'],
    description:
      '歪みの強いギターと重いリズムを前面に出したロック。1970年代に発展し、メタルの直接の母体になった。',
  },
  {
    id: 'progressive-rock',
    labelJa: 'プログレッシブロック',
    labelEn: 'Progressive Rock',
    family: 'ロック',
    parent: 'rock',
    aliases: [
      'Progressive Rock',
      'Prog Rock',
      'Prog',
      'プログレッシブロック',
      'プログレ',
      'プログレッシブ',
    ],
    related: ['psychedelic-rock', 'classical', 'jazz'],
    description:
      '変拍子や組曲形式、クラシックやジャズの要素を取り込んだロック。1曲が長く、演奏技術と構成の複雑さが特徴。',
  },
  {
    id: 'psychedelic-rock',
    labelJa: 'サイケデリック',
    labelEn: 'Psychedelic',
    family: 'ロック',
    parent: 'rock',
    aliases: [
      'Psychedelic',
      'Psychedelic Rock',
      'Psych Rock',
      'サイケデリック',
      'サイケ',
      'Neo-Psychedelia',
    ],
    related: ['progressive-rock', 'alternative', 'shoegaze', 'rock'],
    description:
      '幻覚的な音像を追求したロック。リバーブやディレイ、ドローン、変則的な構成で浮遊感を出す。',
  },
  {
    id: 'shoegaze',
    labelJa: 'シューゲイザー',
    labelEn: 'Shoegaze',
    family: 'ロック',
    parent: 'alternative',
    aliases: ['Shoegaze', 'Shoe Gaze', 'シューゲイザー', 'Dream Pop', 'ドリームポップ', 'Noise Pop'],
    related: ['alternative', 'indie-rock', 'psychedelic-rock', 'post-rock'],
    description:
      '多重録音のギターと柔らかいボーカルが溶け合うロック。壁のような音の洪水と夢見心地のメロディが特徴。',
  },
  {
    id: 'britpop',
    labelJa: 'ブリットポップ',
    labelEn: 'Britpop',
    family: 'ロック',
    parent: 'rock',
    aliases: ['Britpop', 'Brit Pop', 'ブリットポップ', 'ブリットポップス'],
    related: ['rock', 'indie-rock', 'alternative'],
    description:
      '1990年代イギリスのギターポップブーム。ビートルズやKinksなど英国ロックの伝統を意識した、親しみやすいメロディが特徴。',
  },
  {
    id: 'post-rock',
    labelJa: 'ポストロック',
    labelEn: 'Post-Rock',
    family: 'ロック',
    parent: 'rock',
    aliases: ['Post Rock', 'Post-Rock', 'PostRock', 'ポストロック', 'ポスト・ロック'],
    related: ['shoegaze', 'ambient', 'indie-rock', 'progressive-rock'],
    description:
      '歌詞よりも音の重なりで展開するロック。静かな導入から徐々に盛り上がる長尺の構成と、反復するフレーズが特徴。',
  },

  /* --------------------------- パンク・オルタナティブ --------------------------- */
  {
    id: 'punk',
    labelJa: 'パンク',
    labelEn: 'Punk',
    family: 'パンク・オルタナティブ',
    parent: 'rock',
    aliases: [
      'Punk',
      'Punk Rock',
      'パンク',
      'パンクロック',
      'Pop Punk',
      'ポップパンク',
      'Hardcore Punk',
      'Hardcore',
      'ハードコア',
      'Skate Punk',
      'Ska Punk',
      'スカパンク',
    ],
    related: ['grunge', 'alternative', 'emo', 'rock'],
    description:
      '速くて短い曲と3コードの勢いを重視するロック。1970年代後半にDIY精神と反骨の姿勢から生まれた。',
  },
  {
    id: 'grunge',
    labelJa: 'グランジ',
    labelEn: 'Grunge',
    family: 'パンク・オルタナティブ',
    parent: 'alternative',
    aliases: ['Grunge', 'グランジ'],
    related: ['alternative', 'punk', 'hard-rock', 'indie-rock'],
    description:
      '1980年代末のシアトルで生まれたロック。ヘヴィなギターと諦念のこもったボーカル、ローファイな録音が特徴。',
  },
  {
    id: 'emo',
    labelJa: 'エモ',
    labelEn: 'Emo',
    family: 'パンク・オルタナティブ',
    parent: 'punk',
    aliases: ['Emo', 'Emocore', 'エモ', 'エモーショナル', 'Midwest Emo', 'Emo Pop'],
    related: ['punk', 'alternative', 'indie-rock'],
    description:
      '感情を赤裸々に吐き出すロック。切ないメロディと叫ぶような歌唱、複雑なギターリフが特徴。',
  },
  {
    id: 'new-wave',
    labelJa: 'ニューウェイヴ',
    labelEn: 'New Wave',
    family: 'パンク・オルタナティブ',
    parent: 'alternative',
    aliases: [
      'New Wave',
      'NewWave',
      'ニューウェイヴ',
      'ニューウェーブ',
      'Post-Punk',
      'Post Punk',
      'ポストパンク',
      'ポスト・パンク',
    ],
    related: ['synth-pop', 'punk', 'alternative'],
    description:
      'パンク以降の洗練されたロック／ポップス。シンセや機械的なビートを取り入れ、冷たくスタイリッシュな音作りが特徴。',
  },

  /* ------------------------------ ヒップホップ ------------------------------ */
  {
    id: 'hip-hop',
    labelJa: 'ヒップホップ',
    labelEn: 'Hip-Hop/Rap',
    family: 'ヒップホップ',
    broad: true,
    aliases: [
      'Hip-Hop/Rap',
      'Hip Hop/Rap',
      'Hip-Hop',
      'Hip Hop',
      'HipHop',
      'Rap',
      'ヒップホップ',
      'ラップ',
      'East Coast Rap',
      'West Coast Rap',
      'Gangsta Rap',
      'Gangsta',
      'Underground Hip Hop',
      'Old School Hip Hop',
    ],
    related: ['trap', 'boom-bap', 'r-and-b', 'j-hip-hop'],
    description:
      'ラップとビートを中心にした音楽。サンプリングやドラムマシンで組んだトラックに、語りとしての韻を乗せる。',
  },
  {
    id: 'trap',
    labelJa: 'トラップ',
    labelEn: 'Trap',
    family: 'ヒップホップ',
    parent: 'hip-hop',
    aliases: ['Trap', 'Trap Music', 'Trap Rap', 'トラップ', 'EDM Trap'],
    related: ['hip-hop', 'drill', 'electronic'],
    description:
      '高速のハイハットと808の重低音を特徴とするヒップホップの一派。アトランタ発で、2010年代以降の主流になった。',
  },
  {
    id: 'boom-bap',
    labelJa: 'ブーンバップ',
    labelEn: 'Boom Bap',
    family: 'ヒップホップ',
    parent: 'hip-hop',
    aliases: ['Boom Bap', 'Boombap', 'Boom-Bap', 'ブーンバップ', 'East Coast Hip Hop'],
    related: ['hip-hop', 'j-hip-hop', 'jazz'],
    description:
      '1990年代のニューヨークを代表するヒップホップ。サンプリング主体の温かいループと、跳ねるキックとスネアが特徴。',
  },
  {
    id: 'j-hip-hop',
    labelJa: 'J-ヒップホップ',
    labelEn: 'Japanese Hip-Hop',
    family: 'ヒップホップ',
    parent: 'hip-hop',
    aliases: [
      'Japanese Hip Hop',
      'J Hip Hop',
      'J-Hip Hop',
      'J-Rap',
      'Japanese Rap',
      'ジャパニーズヒップホップ',
      '日本語ラップ',
    ],
    related: ['hip-hop', 'boom-bap', 'j-pop'],
    description:
      '日本語のラップによるヒップホップ。日本語の音韻に合わせたフロウと、和風のサンプリングやトラックが特徴。',
  },
  {
    id: 'drill',
    labelJa: 'ドリル',
    labelEn: 'Drill',
    family: 'ヒップホップ',
    parent: 'trap',
    aliases: ['Drill', 'Drill Music', 'UK Drill', 'Chicago Drill', 'ドリル'],
    related: ['trap', 'hip-hop'],
    description:
      'シカゴ発のヒップホップ。暗いメロディと滑らかにスライドするベース、鋭いハイハットが特徴で、UKでも独自に発展した。',
  },

  /* ----------------------------- R&B・ソウル ----------------------------- */
  {
    id: 'r-and-b',
    labelJa: 'R&B',
    labelEn: 'R&B/Soul',
    family: 'R&B・ソウル',
    broad: true,
    aliases: [
      'R&B/Soul',
      'R&B',
      'R & B',
      'RnB',
      'Rhythm and Blues',
      'リズムアンドブルース',
      'Contemporary R&B',
      'コンテンポラリーR&B',
      'Quiet Storm',
    ],
    related: ['soul', 'neo-soul', 'hip-hop', 'pop'],
    description:
      'リズム&ブルース。グルーヴィーなビートと情感豊かなボーカルが中心で、時代ごとにヒップホップやエレクトロニックを取り込んできた。',
  },
  {
    id: 'soul',
    labelJa: 'ソウル',
    labelEn: 'Soul',
    family: 'R&B・ソウル',
    parent: 'r-and-b',
    aliases: [
      'Soul',
      'Soul Music',
      'ソウル',
      'ソウルミュージック',
      'Northern Soul',
      'Motown',
      'モータウン',
      'Blue-Eyed Soul',
    ],
    related: ['r-and-b', 'funk', 'gospel', 'blues'],
    description:
      '1950〜60年代のアメリカ黒人音楽から生まれた、感情を込めた歌唱が主役のジャンル。ホーンセクションとグルーヴが特徴。',
  },
  {
    id: 'funk',
    labelJa: 'ファンク',
    labelEn: 'Funk',
    family: 'R&B・ソウル',
    parent: 'r-and-b',
    aliases: ['Funk', 'Funk Music', 'ファンク', 'ファンクミュージック', 'P-Funk', 'Electro Funk'],
    related: ['soul', 'disco', 'r-and-b', 'jazz'],
    description:
      'リズムとベースラインを主役にしたダンス音楽。シンコペーションの効いたグルーヴとホーン、叫ぶようなコーラスが特徴。',
  },
  {
    id: 'neo-soul',
    labelJa: 'ネオソウル',
    labelEn: 'Neo Soul',
    family: 'R&B・ソウル',
    parent: 'soul',
    aliases: ['Neo Soul', 'Neo-Soul', 'Neosoul', 'ネオソウル', 'ネオ・ソウル'],
    related: ['soul', 'r-and-b', 'jazz', 'hip-hop'],
    description:
      '1990年代後半に登場したソウルの現代的解釈。生楽器の温かさとヒップホップのビート、ジャズ的なコード感が同居する。',
  },
  {
    id: 'gospel',
    labelJa: 'ゴスペル',
    labelEn: 'Gospel',
    family: 'ゴスペル・ソウル',
    parent: 'soul',
    aliases: [
      'Gospel',
      'Gospel Music',
      'ゴスペル',
      'ゴスペルミュージック',
      'Contemporary Gospel',
      'Black Gospel',
      'Praise and Worship',
    ],
    related: ['soul', 'r-and-b', 'blues'],
    description:
      'キリスト教の信仰を歌う音楽。力強いコーラスとオルガン、観客との掛け合いが特徴で、ソウルやR&Bの源流の一つ。',
  },

  /* ----------------------------- エレクトロニック ----------------------------- */
  {
    id: 'electronic',
    labelJa: 'エレクトロニック',
    labelEn: 'Electronic',
    family: 'エレクトロニック',
    broad: true,
    aliases: [
      'Electronic',
      'Electronica',
      'Electronic Music',
      'エレクトロニック',
      'エレクトロニカ',
      'エレクトロニックミュージック',
      'Electro',
      'エレクトロ',
      'Breakbeat',
      'ブレイクビーツ',
      'Big Beat',
      'Trip Hop',
      'トリップホップ',
      'Downtempo',
      'ダウンテンポ',
      'Glitch',
      'グリッチ',
      'Experimental Electronic',
    ],
    related: ['house', 'techno', 'ambient', 'synth-pop'],
    description:
      'シンセサイザーやコンピュータで作る音楽の総称。クラブ向けのダンスミュージックから、リスニング用の実験的なものまで幅広い。',
  },
  {
    id: 'house',
    labelJa: 'ハウス',
    labelEn: 'House',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: [
      'House',
      'House Music',
      'ハウス',
      'ハウスミュージック',
      'Club House',
      'Garage House',
      'Acid House',
      'アシッドハウス',
      'Chicago House',
      'シカゴハウス',
      'Tech House',
      'テックハウス',
      'Progressive House',
      'プログレッシブハウス',
      'Electro House',
      'エレクトロハウス',
      'Jackin House',
      'Organic House',
    ],
    related: ['deep-house', 'french-house', 'techno', 'disco'],
    description:
      '1980年代シカゴで生まれた4つ打ちのダンスミュージック。規則的なキックと温かいベース、ディスコのサンプリングが特徴。',
  },
  {
    id: 'french-house',
    labelJa: 'フレンチハウス',
    labelEn: 'French House',
    family: 'エレクトロニック',
    parent: 'house',
    aliases: [
      'French House',
      'FrenchHouse',
      'フレンチハウス',
      'フレンチ・ハウス',
      'Filter House',
      'フィルターハウス',
      'French Touch',
      'French Electro',
    ],
    related: ['house', 'disco', 'electronic', 'funk'],
    description:
      '1990年代後半のフランス発のハウス。ディスコやファンクのサンプルをフィルターで加工し、ループを繰り返す独特のグルーヴを持つ。',
  },
  {
    id: 'deep-house',
    labelJa: 'ディープハウス',
    labelEn: 'Deep House',
    family: 'エレクトロニック',
    parent: 'house',
    aliases: [
      'Deep House',
      'ディープハウス',
      'ディープ・ハウス',
      'Soulful House',
      'ソウルフルハウス',
    ],
    related: ['house', 'french-house', 'soul', 'ambient'],
    description:
      'ハウスのなかでも低く柔らかいベースと、ジャズやソウルの和声を取り入れた落ち着いた一派。夜のリスニングにも合う。',
  },
  {
    id: 'techno',
    labelJa: 'テクノ',
    labelEn: 'Techno',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: [
      'Techno',
      'Techno Music',
      'テクノ',
      'Detroit Techno',
      'デトロイトテクノ',
      'Minimal Techno',
      'ミニマルテクノ',
      'Industrial Techno',
    ],
    related: ['house', 'electronic', 'trance', 'ambient'],
    description:
      '1980年代デトロイトで生まれた機械的な4つ打ちの音楽。反復するシンセと冷たい音色、未来志向のサウンドが特徴。',
  },
  {
    id: 'trance',
    labelJa: 'トランス',
    labelEn: 'Trance',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: [
      'Trance',
      'トランス',
      'Uplifting Trance',
      'アップリフティングトランス',
      'Psytrance',
      'サイケデリックトランス',
      'Progressive Trance',
    ],
    related: ['techno', 'house', 'electronic', 'edm'],
    description:
      '高揚感のあるメロディと長いブレイクを特徴とするダンスミュージック。BPMは130前後で、感情の起伏を重視する。',
  },
  {
    id: 'dubstep',
    labelJa: 'ダブステップ',
    labelEn: 'Dubstep',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: ['Dubstep', 'ダブステップ', 'Brostep', 'Riddim'],
    related: ['drum-and-bass', 'electronic', 'dancehall'],
    description:
      'ロンドン南部で生まれた低音重視のダンスミュージック。うねるベースと細かく刻むハーフタイムのビートが特徴。',
  },
  {
    id: 'drum-and-bass',
    labelJa: 'ドラムンベース',
    labelEn: 'Drum and Bass',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: [
      'Drum and Bass',
      'Drum & Bass',
      'Drum n Bass',
      'DnB',
      'D&B',
      'ドラムンベース',
      'ドラムアンドベース',
      'Jungle',
      'ジャングル',
      'Liquid Funk',
      'Jump Up',
    ],
    related: ['dubstep', 'electronic', 'hip-hop'],
    description:
      '高速で複雑なドラムパターンと重いサブベースが特徴のイギリス発のダンスミュージック。BPM170前後のブレイクビーツが軸。',
  },
  {
    id: 'ambient',
    labelJa: 'アンビエント',
    labelEn: 'Ambient',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: ['Ambient', 'Ambient Music', 'アンビエント', 'Drone', 'ドローン', 'Dark Ambient'],
    related: ['electronic', 'new-age', 'post-rock', 'classical'],
    description:
      'メロディやビートよりも音の空間や持続を重視する音楽。静かな環境音やシンセのパッドで、聴く者の意識をゆるめる。',
  },
  {
    id: 'idm',
    labelJa: 'IDM',
    labelEn: 'Intelligent Dance Music',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: ['IDM', 'Intelligent Dance Music', 'Braindance', 'ブレインダンス'],
    related: ['electronic', 'ambient', 'techno'],
    description:
      'ダンスフロアよりリスニング向けの実験的エレクトロニック。複雑なリズムと音響処理で、知的な面白さを追求する。',
  },
  {
    id: 'synth-pop',
    labelJa: 'シンセポップ',
    labelEn: 'Synth-pop',
    family: 'エレクトロニック',
    parent: 'electronic',
    aliases: [
      'Synth-pop',
      'Synth Pop',
      'Synthpop',
      'シンセポップ',
      'シンセ・ポップ',
      'Electropop',
      'エレクトロポップ',
      'New Romantic',
      'ニューロマンティック',
      'Chiptune',
      'チップチューン',
      '8bit',
    ],
    related: ['pop', 'new-wave', 'electronic'],
    description:
      'シンセサイザーを主役にしたポップス。1980年代に全盛を迎え、機械的なビートと甘いメロディの対比が魅力。',
  },

  /* --------------------------------- ダンス --------------------------------- */
  {
    id: 'dance',
    labelJa: 'ダンス',
    labelEn: 'Dance',
    family: 'ダンス',
    broad: true,
    aliases: [
      'Dance',
      'Dance Music',
      'ダンス',
      'ダンスミュージック',
      'Club',
      'Club Music',
      'クラブ',
      'Eurodance',
      'ユーロダンス',
      'Hi-NRG',
    ],
    related: ['house', 'edm', 'disco', 'electronic'],
    description:
      '体を動かすことを目的に作られた音楽の総称。クラブやフェスで流れる4つ打ちのビートが中心。',
  },
  {
    id: 'disco',
    labelJa: 'ディスコ',
    labelEn: 'Disco',
    family: 'ダンス',
    parent: 'dance',
    aliases: ['Disco', 'Disco Music', 'ディスコ', 'ディスコミュージック', 'Nu Disco', 'Boogie', 'ブギー'],
    related: ['funk', 'dance', 'house', 'soul'],
    description:
      '1970年代のダンスフロア音楽。4つ打ちのキックと弦楽器・ホーンの華やかなアレンジ、高揚するコーラスが特徴。',
  },
  {
    id: 'edm',
    labelJa: 'EDM',
    labelEn: 'EDM',
    family: 'ダンス',
    parent: 'dance',
    aliases: [
      'EDM',
      'Electronic Dance Music',
      'イーディーエム',
      'Big Room',
      'Big Room House',
      'Future Bass',
      'フューチャーベース',
      'Tropical House',
      'トロピカルハウス',
    ],
    related: ['dance', 'house', 'trance', 'electronic'],
    description:
      '2010年代に世界的に流行したフェス向けのダンスミュージック。大きなドロップと分かりやすい高揚感が特徴。',
  },

  /* --------------------------------- ジャズ --------------------------------- */
  {
    id: 'jazz',
    labelJa: 'ジャズ',
    labelEn: 'Jazz',
    family: 'ジャズ',
    broad: true,
    aliases: [
      'Jazz',
      'Jazz Music',
      'ジャズ',
      'ジャズミュージック',
      'Bebop',
      'ビバップ',
      'Hard Bop',
      'ハードバップ',
      'Cool Jazz',
      'クールジャズ',
      'Swing',
      'スウィング',
      'Big Band',
      'ビッグバンド',
      'Free Jazz',
      'フリージャズ',
      'Modal Jazz',
    ],
    related: ['fusion', 'smooth-jazz', 'blues', 'soul'],
    description:
      '即興演奏とスウィング感を核にした音楽。アフリカ系アメリカ人の音楽伝統から発展し、複雑な和声と相互作用が特徴。',
  },
  {
    id: 'smooth-jazz',
    labelJa: 'スムースジャズ',
    labelEn: 'Smooth Jazz',
    family: 'ジャズ',
    parent: 'jazz',
    aliases: ['Smooth Jazz', 'SmoothJazz', 'スムースジャズ', 'Contemporary Jazz', 'コンテンポラリージャズ'],
    related: ['jazz', 'fusion', 'easy-listening', 'r-and-b'],
    description:
      'ジャズをポップス寄りに仕立てた、聴きやすい音楽。洗練されたサックスやシンセ、落ち着いたグルーヴが特徴。',
  },
  {
    id: 'fusion',
    labelJa: 'フュージョン',
    labelEn: 'Jazz Fusion',
    family: 'ジャズ',
    parent: 'jazz',
    aliases: [
      'Fusion',
      'Jazz Fusion',
      'フュージョン',
      'ジャズフュージョン',
      'Jazz-Funk',
      'ジャズファンク',
      'Jazz Rock',
    ],
    related: ['jazz', 'funk', 'progressive-rock', 'rock'],
    description:
      'ジャズとロック、ファンクを融合させた演奏音楽。高度なテクニックとエレクトリックなサウンド、変則的な展開が特徴。',
  },

  /* -------------------------------- クラシック -------------------------------- */
  {
    id: 'classical',
    labelJa: 'クラシック',
    labelEn: 'Classical',
    family: 'クラシック',
    broad: true,
    aliases: [
      'Classical',
      'Classical Music',
      'クラシック',
      'クラシック音楽',
      'Symphony',
      '交響曲',
      'Chamber Music',
      '室内楽',
      'Opera',
      'オペラ',
      'Baroque',
      'バロック',
      'Romantic Era',
      'ロマン派',
      'Contemporary Classical',
      '現代音楽',
      'Piano',
      'ピアノ',
    ],
    related: ['soundtrack', 'ambient', 'progressive-rock'],
    description:
      '西洋の芸術音楽。オーケストラやピアノによる作曲された作品で、数百年にわたる様式の変遷を含む。',
  },

  /* --------------------------- フォーク・アコースティック --------------------------- */
  {
    id: 'folk',
    labelJa: 'フォーク',
    labelEn: 'Folk',
    family: 'フォーク・アコースティック',
    aliases: [
      'Folk',
      'Folk Music',
      'フォーク',
      'フォークミュージック',
      'フォークソング',
      'Folk Rock',
      'フォークロック',
      'Traditional Folk',
      '民謡',
    ],
    related: ['acoustic', 'country', 'singer-songwriter', 'world'],
    description:
      '土地の伝承歌や、アコースティック楽器で歌われる物語的な音楽。シンプルな編成と歌詞の比重の大きさが特徴。',
  },
  {
    id: 'acoustic',
    labelJa: 'アコースティック',
    labelEn: 'Acoustic',
    family: 'フォーク・アコースティック',
    parent: 'folk',
    aliases: [
      'Acoustic',
      'Acoustic Guitar',
      'アコースティック',
      'アコギ',
      'Unplugged',
      'アンプラグド',
    ],
    related: ['folk', 'singer-songwriter', 'rock'],
    description:
      '電気的な増幅を控え、生楽器の音を活かした演奏。ギター1本の弾き語りから、弦楽器を加えた編成まで幅広い。',
  },
  {
    id: 'singer-songwriter',
    labelJa: 'シンガーソングライター',
    labelEn: 'Singer/Songwriter',
    family: 'フォーク・アコースティック',
    parent: 'folk',
    aliases: [
      'Singer/Songwriter',
      'Singer Songwriter',
      'Singer-Songwriter',
      'Singersongwriter',
      'シンガーソングライター',
      '弾き語り',
      'Acoustic Pop',
    ],
    related: ['folk', 'acoustic', 'pop', 'rock'],
    description:
      '自作の歌を自分で歌うスタイル。歌詞の内面性と、声と楽器だけのシンプルな構成が中心。',
  },

  /* --------------------------------- ブルース --------------------------------- */
  {
    id: 'blues',
    labelJa: 'ブルース',
    labelEn: 'Blues',
    family: 'ブルース',
    aliases: [
      'Blues',
      'Blues Music',
      'ブルース',
      'ブルーズ',
      'Delta Blues',
      'デルタブルース',
      'Chicago Blues',
      'シカゴブルース',
      'Electric Blues',
      'Jump Blues',
    ],
    related: ['jazz', 'soul', 'rock', 'gospel'],
    description:
      '19世紀末のアメリカ南部で生まれた音楽。ブルーノートと12小節の形式、苦悩を語る歌詞が特徴で、多くのジャンルの源流になった。',
  },

  /* --------------------------------- カントリー --------------------------------- */
  {
    id: 'country',
    labelJa: 'カントリー',
    labelEn: 'Country',
    family: 'カントリー',
    parent: 'folk',
    aliases: [
      'Country',
      'Country Music',
      'カントリー',
      'カントリーミュージック',
      'Country Rock',
      'カントリーロック',
      'Bluegrass',
      'ブルーグラス',
      'Americana',
      'アメリカーナ',
      'Alt Country',
      'Nashville',
    ],
    related: ['folk', 'blues', 'rock', 'singer-songwriter'],
    description:
      'アメリカ南部・中西部の白人の伝統音楽。バンジョーやフィドル、ペダルスチールの響きと、生活を語る歌詞が特徴。',
  },

  /* ---------------------------------- メタル ---------------------------------- */
  {
    id: 'metal',
    labelJa: 'メタル',
    labelEn: 'Metal',
    family: 'メタル',
    broad: true,
    aliases: [
      'Metal',
      'Heavy Metal',
      'メタル',
      'ヘヴィメタル',
      'ヘビーメタル',
      'Death Metal',
      'デスメタル',
      'Black Metal',
      'ブラックメタル',
      'Thrash Metal',
      'スラッシュメタル',
      'Power Metal',
      'パワーメタル',
      'Doom Metal',
      'ドゥームメタル',
      'Nu Metal',
      'ニューメタル',
      'Symphonic Metal',
      'シンフォニックメタル',
    ],
    related: ['hard-rock', 'punk', 'progressive-rock'],
    description:
      '歪んだギターと速いリフ、重いリズムを特徴とするロックの極端な形。サブジャンルが非常に多い。',
  },
  {
    id: 'metalcore',
    labelJa: 'メタルコア',
    labelEn: 'Metalcore',
    family: 'メタル',
    parent: 'metal',
    aliases: [
      'Metalcore',
      'Metal Core',
      'メタルコア',
      'Post Hardcore',
      'ポストハードコア',
      'Screamo',
      'スクリーモ',
      'Deathcore',
      'デスコア',
    ],
    related: ['metal', 'punk', 'emo'],
    description:
      'メタルとハードコア・パンクの融合。ブレイクダウンと呼ばれる急激な重パートと、クリーン／スクリームの歌い分けが特徴。',
  },

  /* ----------------------------- レゲエ・カリビアン ----------------------------- */
  {
    id: 'reggae',
    labelJa: 'レゲエ',
    labelEn: 'Reggae',
    family: 'レゲエ・カリビアン',
    aliases: [
      'Reggae',
      'Reggae Music',
      'レゲエ',
      'Roots Reggae',
      'ルーツレゲエ',
      'Dub',
      'ダブ',
      'Lovers Rock',
      'ラバーズロック',
    ],
    related: ['ska', 'dancehall', 'dubstep', 'soul'],
    description:
      'ジャマイカ発の音楽。裏拍を強調するオフビートのギターと、ゆったりしたベース、社会性のある歌詞が特徴。',
  },
  {
    id: 'dancehall',
    labelJa: 'ダンスホール',
    labelEn: 'Dancehall',
    family: 'レゲエ・カリビアン',
    parent: 'reggae',
    aliases: ['Dancehall', 'Dance Hall', 'ダンスホール', 'Ragga', 'ラガ', 'Bashment'],
    related: ['reggae', 'hip-hop', 'electronic'],
    description:
      'ジャマイカのダンスホールで発展したレゲエの一派。速めのデジタルビートと、DJの掛け声・ダンス文化が中心。',
  },
  {
    id: 'ska',
    labelJa: 'スカ',
    labelEn: 'Ska',
    family: 'レゲエ・カリビアン',
    parent: 'reggae',
    aliases: ['Ska', 'スカ', '2 Tone', 'Two Tone', 'Rocksteady', 'ロックステディ'],
    related: ['reggae', 'punk', 'dancehall'],
    description:
      'ジャマイカで生まれたダンス音楽。裏拍で刻むギターとホーンセクション、跳ねるビートが特徴で、パンクと融合した派生も多い。',
  },

  /* ---------------------------------- ラテン ---------------------------------- */
  {
    id: 'latin',
    labelJa: 'ラテン',
    labelEn: 'Latin',
    family: 'ラテン',
    broad: true,
    aliases: [
      'Latin',
      'Latin Music',
      'ラテン',
      'ラテンミュージック',
      'Salsa',
      'サルサ',
      'Merengue',
      'メレンゲ',
      'Cumbia',
      'クンビア',
      'Reggaeton',
      'レゲトン',
      'Bachata',
      'バチャータ',
      'Latin Pop',
      'ラテンポップ',
      'Latin Jazz',
      'ラテンジャズ',
      'Musica Tropical',
      'スペイン語ポップ',
      'ラテン・アーバン',
      'Latin Urban',
      'Spanish Pop',
    ],
    related: ['bossa-nova', 'world', 'dance', 'pop'],
    description:
      'スペイン語・ポルトガル語圏のダンス音楽の総称。アフリカ系のリズムとヨーロッパの旋律が混ざり、打楽器とホーンが華やか。',
  },
  {
    id: 'bossa-nova',
    labelJa: 'ボサノヴァ',
    labelEn: 'Bossa Nova',
    family: 'ラテン',
    parent: 'latin',
    aliases: ['Bossa Nova', 'Bossa', 'BossaNova', 'ボサノヴァ', 'ボサノバ', 'Brazilian Jazz'],
    related: ['latin', 'jazz', 'shibuya-kei', 'easy-listening'],
    description:
      'ブラジル発の洗練された音楽。サンバのリズムを静かに落とし込み、ギターの刻みと囁くような歌唱が特徴。',
  },

  /* ---------------------------------- ワールド ---------------------------------- */
  {
    id: 'world',
    labelJa: 'ワールド',
    labelEn: 'World',
    family: 'ワールド',
    broad: true,
    aliases: [
      'World',
      'World Music',
      'ワールド',
      'ワールドミュージック',
      '民族音楽',
      'Ethnic',
      'Afrobeat',
      'アフロビート',
      'Highlife',
      'ハイライフ',
      'Celtic',
      'ケルト',
      'Indian Classical',
      'インド音楽',
      'Gamelan',
      'ガムラン',
      'Flamenco',
      'フラメンコ',
    ],
    related: ['folk', 'latin', 'ambient', 'jazz'],
    description:
      '欧米ポップス以外の地域の伝統音楽や、それを現代的に解釈した音楽。地域固有の楽器・リズム・旋法が持ち味。',
  },

  /* ------------------------------- アニソン・ボカロ ------------------------------- */
  {
    id: 'anime',
    labelJa: 'アニソン',
    labelEn: 'Anime',
    family: 'アニソン・ボカロ',
    aliases: [
      'Anime',
      'Anison',
      'アニメ',
      'アニソン',
      'アニメソング',
      'Japanese Anime',
      'Anime Soundtrack',
      'アニメサウンドトラック',
      'Game Music',
      'ゲーム音楽',
      'Video Game',
      'ゲーム',
      'Japanese Video Game',
      '映画/ゲーム',
      'アニメ/ゲーム',
    ],
    related: ['j-pop', 'soundtrack', 'vocaloid', 'idol-pop'],
    description:
      'アニメ・ゲームの主題歌や劇伴。キャラクター性の強い歌唱と、映像に寄り添う劇的な展開が特徴。',
  },
  {
    id: 'vocaloid',
    labelJa: 'ボカロ',
    labelEn: 'Vocaloid',
    family: 'アニソン・ボカロ',
    parent: 'anime',
    aliases: [
      'Vocaloid',
      'Vocaloid Music',
      'ボカロ',
      'ボーカロイド',
      'Hatsune Miku',
      '初音ミク',
      'Utaite',
      '歌い手',
      'Vocal Synth',
    ],
    related: ['anime', 'j-pop', 'electronic'],
    description:
      '音声合成ソフトで歌わせた楽曲。機械的な声と人間離れした音域を活かした、速い曲や感情的な曲が多い。',
  },

  /* ------------------------------ サウンドトラック ------------------------------ */
  {
    id: 'soundtrack',
    labelJa: 'サウンドトラック',
    labelEn: 'Soundtrack',
    family: 'サウンドトラック',
    aliases: [
      'Soundtrack',
      'Original Soundtrack',
      'サウンドトラック',
      'OST',
      '劇伴',
      'Score',
      'Film Score',
      '映画音楽',
      'TV Soundtrack',
      'ドラマ音楽',
      'Musical',
      'ミュージカル',
      '映画サウンドトラック',
    ],
    related: ['classical', 'anime', 'ambient', 'pop'],
    description:
      '映画・ドラマ・ゲームなどの映像作品のための音楽。場面に合わせた劇的な展開と、テーマ曲の反復が特徴。',
  },

  /* ---------------------------------- その他 ---------------------------------- */
  {
    id: 'new-age',
    labelJa: 'ニューエイジ',
    labelEn: 'New Age',
    family: 'その他',
    aliases: [
      'New Age',
      'NewAge',
      'ニューエイジ',
      'ヒーリング',
      'Healing',
      'Relaxation',
      'リラクゼーション',
      'Meditation',
      '瞑想',
      'Nature Sounds',
    ],
    related: ['ambient', 'easy-listening', 'classical'],
    description:
      '癒やしや瞑想を目的とした音楽。シンセのパッドやピアノ、自然音で、静かで穏やかな時間をつくる。',
  },
  {
    id: 'childrens',
    labelJa: 'キッズ',
    labelEn: "Children's Music",
    family: 'その他',
    parent: 'pop',
    aliases: [
      "Children's Music",
      'Childrens Music',
      'Kids',
      'キッズ',
      'こどものうた',
      '童謡',
      'Kids Music',
      'Family Music',
    ],
    related: ['pop', 'anime', 'folk'],
    description:
      '子ども向けの歌や音楽。歌いやすいメロディと明るい編成で、童謡や教育用の曲が多い。',
  },
];

export const GENRE_BY_ID: ReadonlyMap<string, GenreDef> = new Map(
  GENRES.map((genre) => [genre.id, genre]),
);

export function getGenre(id: string): GenreDef | undefined {
  return GENRE_BY_ID.get(id);
}

/** 親ジャンル ID を返す。 */
export function parentOf(id: string): string | undefined {
  return GENRE_BY_ID.get(id)?.parent;
}

const CHILDREN_BY_PARENT: ReadonlyMap<string, GenreDef[]> = (() => {
  const map = new Map<string, GenreDef[]>();
  for (const genre of GENRES) {
    if (!genre.parent) continue;
    const list = map.get(genre.parent) ?? [];
    list.push(genre);
    map.set(genre.parent, list);
  }
  return map;
})();

/** 直接の子ジャンルを返す。 */
export function childrenOf(id: string): GenreDef[] {
  return CHILDREN_BY_PARENT.get(id) ?? [];
}

/** id が ancestorId の子孫かどうか（parent をたどる）。 */
export function isDescendantOf(id: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let current = parentOf(id);
  while (current && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    current = parentOf(current);
  }
  return false;
}

/** related を UI 用の {id, labelJa} に変換する（存在しない id は捨てる）。 */
export function relatedGenres(id: string): Array<{ id: string; labelJa: string }> {
  const genre = GENRE_BY_ID.get(id);
  if (!genre) return [];
  return genre.related.flatMap((relatedId) => {
    const related = GENRE_BY_ID.get(relatedId);
    return related ? [{ id: related.id, labelJa: related.labelJa }] : [];
  });
}
