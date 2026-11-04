# 仕様（実装コントラクト）

このリポジトリは「曲のジャンルがわからないときに、根拠つきで教えてくれるアプリ」。
リポジトリ名: `genre-finder` / 公開名: **これ何ジャンル？** / ホスティング: Cloudflare Pages。

```
ブラウザ (Vite + React + TS, src/)
      │  fetch /api/*
      ▼
Cloudflare Pages Functions (functions/api/*.ts)   ← ここで外部 API を叩く（CORS 回避・キー隠蔽）
      │
      ├─ iTunes Search API   （キー不要・CORS可・曲の公式ジャンル分類）
      ├─ Deezer API          （キー不要・アルバムのジャンル、日本語ローカライズ）
      ├─ MusicBrainz API     （キー不要・コミュニティのタグ/ジャンル、細かいサブジャンルが強い）
      └─ Last.fm / Spotify   （任意。シークレットが設定されているときだけ使う）
```

## 1. ディレクトリと所有範囲

| パス | 中身 | 担当 |
| --- | --- | --- |
| `functions/api/*.ts` | ルート（薄いラッパ） | backend |
| `functions/_lib/*.ts` | 外部APIクライアント・判定エンジン・キャッシュ | backend |
| `shared/types.ts` | 型契約（**変更禁止**。必要なら Lead に相談） | Lead |
| `shared/genre/*.ts` | ジャンル分類表・正規化 | backend |
| `tests/*.test.ts` | Vitest による純粋ロジックのテスト | backend |
| `src/**` | React UI・CSS・クライアントAPI・タグ読み取り | frontend |
| `README.md`, `docs/**` | 利用者向けドキュメント | docs |
| ルート設定（`package.json`, `vite.config.ts`, `wrangler.toml`, `.github/`, `index.html`） | ビルド/デプロイ | Lead |

`shared/types.ts` が唯一の契約。実装が型と食い違う場合は型ではなく実装を直す。
それでも型を変える必要が出たら、勝手に変えず Lead にメッセージすること。

## 2. API

すべて Cloudflare Pages Functions（`onRequest` を export）。共通で:

- JSON を返す（`content-type: application/json; charset=utf-8`）
- 失敗は `{ "error": "message", "detail"?: "..." }` と適切な status
- 外部APIは `AbortSignal.timeout(5000)` でタイムアウト。1ソースの失敗で全体を落とさず
  `failedSources` に積んで残りで判定する。
- CDN キャッシュ（`caches.default`）を使う。無い環境（`vite dev` の Node）ではメモリ Map に
  フォールバックする。TTL: 検索 10分 / 判定 1時間 / リンク解決 1時間。
- MusicBrainz へは `User-Agent: GenreFinder/0.1 ( https://genre-finder.pages.dev )` を必ず付ける。
  MusicBrainz へのリクエストは**同時に投げない**（1 req/sec 制限）。

### `GET /api/search?q=<曲名 or "曲名 アーティスト">&artist=<任意>`
→ `SearchResponse`

- iTunes `search`（`entity=song`, `limit=15`, `country=jp`）を主。0件なら `country=us` で再試行。
- Deezer `search/track` を並行で叩き、iTunes と重複しないものを数件足す。
- 重複判定は「正規化した曲名 + アーティスト名」で。`score` はクエリとの近さ（0-1）。
- クエリが空なら 400。

### `GET /api/analyze?title=&artist=&itunesId=&deezerId=`
→ `AnalyzeResponse`

1. **iTunes**: `itunesId` があれば `lookup?id=` で詳細（ジャンル・年・アートワーク）。
   無ければ `search` で最上位候補。
2. **Deezer**: `title`+`artist` で検索 → トラック → アルバム → `genres`。
3. **MusicBrainz**: recording 検索 → アーティストの `genres`/`tags` と recording の `tags`。
4. **Last.fm**（`LASTFM_API_KEY` がある時だけ）: `track.getTopTags`。
5. 集計 → `GenreJudgment`。

`title` は必須、`artist` は任意（無いと精度が落ちる旨を `caveats` に入れる）。

### `GET /api/resolve?url=<Spotify/YouTube/Apple Music/Deezer のURL>`
→ `ResolveResponse`

- 対応URL: `open.spotify.com/track|intl-xx/track`, `youtu.be`, `youtube.com/watch|shorts`,
  `music.apple.com/.../song|album?i=`, `deezer.com/track`.
- Spotify: `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` があれば Client Credentials で
  `GET /v1/tracks/{id}`（曲名・アーティスト・アートワーク・リリース年）。
  無ければ `https://open.spotify.com/oembed?url=` の `title` + 埋め込みページ
  （`https://open.spotify.com/embed/track/{id}`）からアーティスト名を拾う。
- YouTube: `https://www.youtube.com/oembed?url=...&format=json` の `title` を
  「アーティスト - 曲名」で分割。`VEVO` / `- Topic` / `(Official Video)` 等のノイズを除去。
- Apple Music: URL の `?i=` とパスから曲名を推測し、iTunes `lookup` で確定。
- 解決できたら `/api/search` と同じ検索を内部で実行し、`tracks` も返す（クライアントは即表示）。
- 未知URLは 400。

## 3. ジャンル判定エンジン（`functions/_lib` + `shared/genre`）

### 分類表 `shared/genre/taxonomy.ts`
- 55〜70 ジャンル。大分類（family）は日本語: ポップス / ロック / ヒップホップ / R&B・ソウル /
  エレクトロニック / ダンス / ジャズ / クラシック / フォーク・アコースティック / メタル /
  パンク・オルタナティブ / レゲエ・カリビアン / ラテン / ワールド / アニソン・ボカロ /
  サウンドトラック / ゴスペル・ソウル / ブルース / カントリー / その他
- 各エントリ: `id`(kebab-case), `labelJa`, `labelEn`, `family`,
  `aliases`（英語・日本語の表記ゆれを網羅: iTunes の `primaryGenreName` 全種、Deezer の日本語
  ジャンル名、MusicBrainz の代表的タグ）, `related`（関連ジャンルID 2-4個）,
  `description`（日本語1〜2文。何が特徴のジャンルか）。
- iTunes の主な値: Pop, Rock, Hip-Hop/Rap, R&B/Soul, Electronic, Dance, Jazz, Classical,
  Folk, Metal, Punk, Reggae, Latin, World, Anime, Soundtrack, Vocal, Blues, Country,
  Gospel, New Age, Easy Listening, Children's Music, Singer/Songwriter, Alternative,
  Hip-Hop, J-Pop, K-Pop, Enka, Kayokyoku, House, Techno, Trance, Dubstep, Dancehall 等。
- 曖昧な値（"Pop" など）は大分類として扱い、細分類が別ソースから出ればそちらを primary に
  昇格させてよい（例: iTunes=Pop, MusicBrainz=french house → primary=ハウス、secondary=ポップス）。

### 正規化 `shared/genre/normalize.ts`
`normalize(raw: string): { id: string; matchedBy: 'exact'|'alias'|'fuzzy' } | null`
- 小文字化・記号除去・`&`→`and`・日本語の全半角/中黒ゆれを吸収。
- まず完全一致、次にエイリアス、最後に前方一致。誤爆しやすい語（"pop" を含む "pop rock" 等）は
  長い一致を優先。

### 信頼度
証拠ごとの重み:

| ソース | 重み |
| --- | --- |
| iTunes primaryGenreName | 0.90 |
| Deezer album genre | 0.75 |
| MusicBrainz artist genre | `0.45 + 0.55 * min(count/25, 1)` |
| MusicBrainz recording tag | 上記 × 0.9 |
| Last.fm tag | `0.40 + 0.60 * min(count/100, 1)` |

- ジャンルIDごとに重みを合計 → `confidence = 支持重み / 全重み`
- 2ソース以上が一致したらブースト: `min(0.97, confidence * 1.15 + 0.06)`
- `confidence >= 0.6` → high / `>= 0.35` → medium / `> 0` → low / 証拠なし → unknown
- 表に載らない MusicBrainz/Last.fm タグは `fineTags` に回す（重複除去・count 降順・最大10件）。
- `explanation` は日本語で「何が根拠か」を 1〜2 文。根拠が薄いときは正直にそう書く。
- `caveats`: 判定の限界（例: "iTunes は『ポップ』としか分類していません",
  "MusicBrainz にタグが付いていません"）。

## 4. UI（`src/`）

- 日本語 UI。1ページ完結（ルーター不要）。状態: `idle → searching → results → analyzing → judgment`。
- 3つの入口を同じ画面で受ける:
  1. 曲名検索（曲名だけでも可。「曲名 アーティスト」も許容）
  2. Spotify / YouTube のリンク貼り付け（入力欄に貼ると自動検出して解決）
  3. 音声ファイルのドラッグ&ドロップ / ファイル選択（`jsmediatags` でタグ読み取り → 検索。
     タグが無ければファイル名から「アーティスト - 曲名」を推測）
- 結果一覧: アートワーク・曲名・アーティスト・アルバム・年・ソースのジャンルを表示。クリックで判定へ。
- 判定ビュー:
  - 大きなジャンル名（日本語）＋英語名＋大分類、信頼度メーター（% と 高/中/低）
  - 説明文、根拠リスト（ソース名・生ラベル・重み）、細分類タグ、関連ジャンル
  - 外部リンク（Apple Music / Spotify / YouTube で検索）
  - 失敗したソースの注記、もう一度調べるボタン
- 読み込み中はスケルトン、エラーは日本語で復帰導線つき。
- アクセシビリティ: フォームにラベル、`aria-live` で結果通知、キーボード操作、`prefers-reduced-motion`。
- 見た目: **レコード店／アナログ**。暖かい黒（#12100e 系）＋生成り（#f5efe6）＋琥珀（#e8b04b）。
  見出しは明朝系（`"Hiragino Mincho ProN", "Yu Mincho", serif`）、本文はゴシック系。
  マイクロラベルは等幅＋字間広め。紫グラデ・ガラスモーフィズム・絵文字だらけは禁止。
  アルバムアートが主役。レスポンシブ（360px〜）。

## 5. 開発・検証・デプロイ

```bash
pnpm install
pnpm dev          # Vite + Functions を同時に（scripts/dev-api-plugin.ts）
pnpm typecheck
pnpm test         # Vitest
pnpm build
pnpm preview:cf   # ビルドして Cloudflare ランタイムで確認（wrangler pages dev）
pnpm deploy       # Cloudflare Pages へデプロイ（要 wrangler ログイン）
```

- `pnpm dev` は 5173 番。`/api/*` はローカルの Functions 実装がそのまま動く。
- `.dev.vars` は任意（`.dev.vars.example` 参照）。無くても動くこと。
- シークレット未設定でも「iTunes + Deezer + MusicBrainz」で完全に動くこと。
