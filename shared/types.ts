/**
 * クライアントと Cloudflare Functions が共有する型定義。
 * API のレスポンス形はこのファイルが唯一の正とする。
 */

export type SourceName =
  | 'itunes'
  | 'deezer'
  | 'musicbrainz'
  | 'lastfm'
  | 'spotify'
  | 'youtube';

export const SOURCE_LABELS: Record<SourceName, string> = {
  itunes: 'iTunes / Apple Music',
  deezer: 'Deezer',
  musicbrainz: 'MusicBrainz',
  lastfm: 'Last.fm',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

/** 検索結果一覧に出す 1 曲分の情報。 */
export interface TrackCandidate {
  /** クライアント側の key。source:sourceId 形式。 */
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  releaseDate?: string;
  artworkUrl?: string;
  durationMs?: number;
  source: SourceName;
  sourceId: string;
  /** ソースが申告しているジャンル（粗いラベル。判定の材料として使う） */
  rawGenre?: string;
  /** rawGenre をタクソノミーで正規化した IIDX 風表記（例: "SOUNDTRACK"）。 */
  arcadeGenre?: string;
  /** 30秒試聴の URL（iTunes / Deezer が提供する場合）。 */
  previewUrl?: string;
  links?: Partial<Record<SourceName, string>>;
  /** 検索スコア（高いほどクエリに近い）。 */
  score?: number;
}

/** あるソースが主張したジャンル 1 件。 */
export interface GenreEvidence {
  source: SourceName;
  /** ソースが返した生のラベル（例: "J-Pop", "french house", "ダンス"） */
  raw: string;
  /** 正規化したジャンル ID。対応表に無ければ null。 */
  canonicalId: string | null;
  /** 0-1。この証拠の重み。 */
  weight: number;
  /** 人が読める補足（例: "MusicBrainz の投票数 20"） */
  note?: string;
}

/** 集計後のジャンル 1 件。 */
export interface GenreScore {
  id: string;
  labelJa: string;
  labelEn: string;
  /**
   * IIDX 風の全大文字ジャンル表記（例: "HYPER TECHNO", "DRUM'N'BASS"）。
   * 判定画面ではこの文字列を主役として表示する。
   */
  arcade?: string;
  /** 大分類（例: "エレクトロニック"） */
  family: string;
  /** 0-1。全証拠のうちこのジャンルを支持する割合を重み付きで計算したもの。 */
  confidence: number;
  evidence: GenreEvidence[];
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/** 1 曲のジャンル判定結果。 */
export interface GenreJudgment {
  track: TrackCandidate;
  /** 第一候補。判定不能なら null。 */
  primary: GenreScore | null;
  /** 第二候補以降（confidence 降順）。 */
  others: GenreScore[];
  /**
   * 正規化表に載っていないが有益な細分類タグ。
   * 例: "french house", "shibuya-kei"。confidence の計算には一次ソースとしてのみ利用。
   */
  fineTags: Array<{ name: string; count: number; source: SourceName }>;
  /** 判定に使われた全証拠（重み降順）。 */
  evidence: GenreEvidence[];
  sourcesUsed: SourceName[];
  /** 失敗したソース（UI で「一部の情報源に接続できませんでした」と出す） */
  failedSources: SourceName[];
  confidence: ConfidenceLevel;
  /** 日本語 1-2 文の説明。何を根拠にそのジャンルと言えるか。 */
  explanation: string;
  /** 注意書き（例: "iTunes はポップとだけ分類しています"） */
  caveats: string[];
  /**
   * ゲーム音楽と判定したときの作品名（例: "UNDERTALE", "東方Project", "beatmania IIDX"）。
   * 検出できたときだけ入る。UI ではジャンル名の下に小さく出す。
   */
  workTitle?: string;
  /** ジャンルの代表曲・関連ジャンルなど、UI の補助情報。 */
  genreInfo?: {
    description: string;
    /** IIDX のジャンル説明のような、短くて遊びのある一行（任意）。 */
    tagline?: string;
    related: Array<{ id: string; labelJa: string; arcade?: string }>;
  };
}

/* ---------------------------------- API ---------------------------------- */

export interface SearchResponse {
  query: { title: string; artist?: string };
  tracks: TrackCandidate[];
  warnings: string[];
}

export interface AnalyzeResponse {
  judgment: GenreJudgment;
  warnings: string[];
  /** 処理時間(ms)。デバッグ用。 */
  elapsedMs: number;
}

export type ResolvedPlatform = 'spotify' | 'youtube' | 'apple' | 'deezer' | 'unknown';

export interface ResolveResponse {
  platform: ResolvedPlatform;
  /** リンクから取り出せた曲名・アーティスト（不明なら null） */
  title: string | null;
  artist: string | null;
  /** 解決済みならそのまま検索結果（クライアントは再検索不要） */
  tracks: TrackCandidate[];
  warnings: string[];
}

export interface ApiError {
  error: string;
  detail?: string;
}
