# アーキテクチャ

このアプリは、静的サイト（Vite + React）と Cloudflare Pages Functions の2つで構成します。Functions が外部 API を代理で呼び、ブラウザには判定結果だけを返します。

## 全体像

```
ブラウザ
  │  GET /api/search  /api/analyze  /api/resolve
  ▼
Cloudflare Pages Functions（functions/api/*.ts）
  │  外部 API を呼ぶ（MusicBrainz は 1 秒 1 リクエスト）
  ├─ iTunes Search API   （曲・ジャンル・アートワーク）
  ├─ Deezer API          （トラック・アルバム・ジャンル）
  ├─ MusicBrainz API     （アーティストとレコーディングのタグ）
  └─ Last.fm / Spotify   （シークレット設定時のみ）
  ▼
判定エンジン（functions/_lib, shared/genre）
  ▼
JSON（shared/types.ts の型）
```

Functions を挟む理由は2つあります。1つは CORS の回避で、ブラウザから直接叩けない API も Functions からなら呼べます。もう1つはキーの秘匿で、Spotify と Last.fm のシークレットをブラウザに渡さずに済みます。

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `src/` | React の画面、状態管理、クライアント API、タグ読み取り |
| `functions/api/` | HTTP ルート。リクエストを検証し、実行結果を JSON にする |
| `functions/_lib/` | 外部 API クライアント、判定エンジン、キャッシュ、fetch ヘルパ |
| `shared/types.ts` | クライアントと Functions が共有する型。API の契約 |
| `shared/genre/` | ジャンル分類表、正規化、スコア計算 |
| `tests/` | Vitest による純粋ロジックのテスト |
| `scripts/dev-api-plugin.ts` | `pnpm dev` で Functions を Vite 上で動かす開発用プラグイン |
| `public/` | 静的ファイル、`_redirects`、`_routes.json` |
| `wrangler.toml` | Pages プロジェクト名とビルド出力先 |
| `.github/workflows/ci.yml` | 型チェック、テスト、ビルド |

`shared/types.ts` が唯一の契約です。実装が型と食い違う場合は型ではなく実装を直します。型を変える場合は `shared/types.ts` だけを直し、クライアントと Functions の実装をそれに合わせます。

## API

すべての API は JSON を返し、失敗時は `{ "error": "...", "detail"?: "..." }` とステータスコードを返します。

| エンドポイント | パラメータ | 返すもの |
| --- | --- | --- |
| `GET /api/search` | `q`, `artist`（任意） | 曲の候補一覧（`SearchResponse`） |
| `GET /api/analyze` | `title`, `artist`（任意）, `itunesId`, `deezerId` | 判定結果（`AnalyzeResponse`） |
| `GET /api/resolve` | `url` | リンクから解決した曲名・アーティストと候補（`ResolveResponse`） |

### 検索

1. iTunes の `search` を `entity=song`、`limit=15`、`country=jp` で呼ぶ。
2. 0件なら `country=us` で再試行する。
3. 並行して Deezer の `search/track` を呼び、iTunes と重複しない曲を数件加える。
4. 正規化した曲名とアーティスト名で重複を判定し、クエリとの近さを `score`（0〜1）として付ける。

### 判定

1. iTunes の詳細（`itunesId` があれば `lookup`、無ければ `search` の最上位）を取る。
2. Deezer でトラックからアルバムをたどり、`genres` を取る。
3. MusicBrainz でレコーディングを検索し、アーティストとレコーディングのタグ・ジャンルを取る。
4. `LASTFM_API_KEY` があれば Last.fm の `track.getTopTags` を呼ぶ。
5. 集めて正規化した証拠をスコアリングし、`GenreJudgment` にする。

外部 API の1つが失敗しても全体は落とさず、失敗したソースを `failedSources` に記録します。`title` は必須で、`artist` が無い場合は精度が落ちることを `caveats` に書きます。

### リンク解決

`open.spotify.com`、`youtu.be` / `youtube.com`、`music.apple.com`、`deezer.com` の曲 URL を受け取り、曲名とアーティスト名を取り出します。Spotify は API キーがあれば `/v1/tracks/{id}`、無ければ oEmbed と埋め込みページから推定します。YouTube は oEmbed のタイトルを「アーティスト - 曲名」に分割し、`VEVO` や `- Topic`、`(Official Video)` などのノイズを除きます。

解決できたら、検索と同じ処理を内部で実行して `tracks` も返します。クライアントはすぐ候補を表示でき、追加の検索をしなくて済みます。

## ジャンルの正規化

iTunes の `primaryGenreName`、Deezer の日本語ジャンル名、MusicBrainz のタグは表記が揃っていません。そこで `shared/genre/taxonomy.ts` にジャンルを定義し、`aliases` に表記ゆれを並べます。

- `id`: kebab-case の識別子
- `labelJa` / `labelEn`: 表示名
- `family`: 大分類（日本語）
- `aliases`: 英語・日本語の表記ゆれ
- `related`: 関連ジャンル ID
- `description`: 日本語1〜2文の説明

`shared/genre/normalize.ts` の `normalize(raw)` は、小文字化、記号除去、`&` から `and` への変換、全角半角と中黒の揺れの吸収を行います。完全一致、エイリアス、前方一致の順に照合し、長い一致を優先します。`"pop"` と `"pop rock"` のように包含関係がある場合は、長い方の一致を採ります。

## 信頼度の計算

証拠の重みはソースによって変えます。iTunes は公式の分類なので高く、MusicBrainz はコミュニティのタグなので投票数に応じて変えます。

| 証拠 | 重み |
| --- | --- |
| iTunes `primaryGenreName` | 0.90 |
| Deezer アルバムジャンル | 0.75 |
| MusicBrainz アーティストジャンル | `0.45 + 0.55 × min(count / 25, 1)` |
| MusicBrainz レコーディングタグ | `0.45 + 0.55 × min(count / 25, 1)` の 0.9 倍 |
| Last.fm タグ | `0.40 + 0.60 × min(count / 100, 1)` |

集計は次の順です。

1. 正規化できた証拠をジャンル ID ごとに分け、重みを合計する。
2. `confidence = そのジャンルを支持する重み / 全証拠の重み` を出す。
3. 2ソース以上が同じジャンルを支持したら `min(0.97, confidence × 1.15 + 0.06)` で底上げする。
4. `confidence >= 0.6` を `high`、`>= 0.35` を `medium`、`> 0` を `low`、証拠が無ければ `unknown` とする。

分類表に無いタグは信頼度の計算から外し、`fineTags` に入れます。重複を除き、投票数の降順で最大10件です。`explanation` は「どのソースが何と言ったか」を日本語1〜2文にまとめます。根拠が薄い場合は、薄いと書きます。

## キャッシュ

Cloudflare の `caches.default` を使います。`vite dev` の Node 環境のように `caches` が無い場合は、プロセス内のメモリ `Map` に切り替えます。

| 対象 | TTL |
| --- | --- |
| 検索 | 10分 |
| 判定 | 1時間 |
| リンク解決 | 1時間 |

外部 API のレート制限を避ける目的と、同じ曲を何度も調べたときの応答速度の両方に効きます。キャッシュはリクエストのパラメータから作ったキーで引き、判定条件が変われば別のエントリになります。

キーには `CACHE_VERSION`（`functions/_lib/cache.ts`）を前置しています。レスポンスの形やタクソノミーを変えたらこの値を上げてください。デプロイ直後でもキーが変わるため、古い判定結果が返りません。

## 外部 API の扱い

- すべての外部呼び出しに `AbortSignal.timeout(5000)` を付け、応答が無い場合は失敗として扱う。
- JSON の取得は共通の `fetchJson` ヘルパに集約し、ステータスとパースの扱いを揃える。
- MusicBrainz には `User-Agent: GenreFinder/0.1 ( https://genre-finder.pages.dev )` を付ける。User-Agent が無いリクエストは拒否される。
- MusicBrainz へは同時にリクエストを投げない（1秒1リクエストの制限に合わせる）。
- ソースごとの失敗は握りつぶさず `failedSources` に残し、画面に出す。

## 開発サーバーの仕組み

`pnpm dev` は Vite の開発サーバーを起動します。`scripts/dev-api-plugin.ts` が `/api/*` へのリクエストを横取りし、`functions/api/<route>.ts` を読み込んで `onRequest` を呼びます。`.dev.vars` を読み、`env` として渡します。API 用の別プロセスは立てません。

本番では同じハンドラを Cloudflare の workerd が実行します。ビルドは `tsc --noEmit` と `vite build` の2段で、`dist/` に静的ファイルと `_routes.json`、`_redirects` が入ります。

- `_routes.json` は `/api/*` だけを Functions に回す。
- `_redirects` は SPA のフォールバックを設定する。

## ソースを増やすとき

1. `shared/types.ts` の `SourceName` と `SOURCE_LABELS` にソースを追加する（契約の変更）。
2. `functions/_lib/` に API クライアントを追加する。タイムアウトとヘッダーの扱いは既存のヘルパに合わせる。
3. `/api/analyze` の証拠集めに呼び出しを足し、失敗時は `failedSources` に積む。
4. スコア計算に重みを追加する。重みの根拠（公式分類か、コミュニティタグか）を決めてから数値を置く。
5. `shared/genre/taxonomy.ts` の `aliases` に、そのソースが返すラベルを足す。
6. テストを追加し、README の出典表と利用条件を更新する。

## 制約

- Pages Functions は Node.js の API を使えない。ファイル読み書きや `Buffer` に頼らず、標準の `fetch` と Web API で書く。
- データベースは無い。保存するのはキャッシュだけなので、履歴やお気に入りは持たない。
- 音声の解析はしない。音声ファイルはタグとファイル名だけを使う。
- 外部 API の仕様変更やレート制限で判定精度が変わる。各 API の利用条件は README の「データの出典と利用条件」にまとめている。
