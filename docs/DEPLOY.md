# Cloudflare Pages へのデプロイ

このアプリは Vite でビルドした静的ファイルと、`functions/api/*.ts` の Pages Functions を Cloudflare Pages に置いて動かします。ここでは、Wrangler で直接デプロイする手順と、GitHub Actions で自動化する手順を書きます。

## 前提

- Cloudflare アカウント（無料プランで可）
- Node.js 20 以上（CI と Actions の例は Node 22）
- pnpm（`package.json` の `packageManager` は `pnpm@12.16.1`）
- コマンドはリポジトリのルートで実行する

Wrangler は `devDependencies` に入っています。以下の例では `pnpm exec wrangler` と書きます。Wrangler をグローバルにインストールしている場合は、`pnpm exec` を省いて `wrangler` で実行できます。

## Wrangler にログインする

Cloudflare アカウントに CLI からアクセスするため、ブラウザを開いて認証します。

```bash
pnpm exec wrangler login
```

認証できたか確認します。

```bash
pnpm exec wrangler whoami
```

## Pages プロジェクトを作る（初回のみ）

プロジェクト名は `wrangler.toml` の `name` と `package.json` の `deploy` スクリプトに合わせて `genre-finder` にします。

```bash
pnpm exec wrangler pages project create genre-finder --production-branch main
```

すでにプロジェクトがある場合は作らずに次へ進みます。一覧は `pnpm exec wrangler pages project list` で確認できます。

## デプロイする

`pnpm deploy` は、型チェックとビルドを実行してから `wrangler pages deploy` を呼びます。

```bash
pnpm deploy
```

内部で実行されるコマンドは次のとおりです。

```bash
pnpm build
wrangler pages deploy dist --project-name genre-finder --branch main
```

デプロイが終わると、本番 URL が表示されます。

- 本番: <https://genre.slytxt.dev>（カスタムドメインを設定していない場合は <https://genre-finder.pages.dev>）
- デプロイごとの URL: `https://<ハッシュ>.genre-finder.pages.dev`

`--branch main` を付けたデプロイは本番環境として扱われます。`main` 以外のブランチ名を指定するとプレビュー環境になります。

## シークレットを設定する

シークレットは任意です。未設定でも iTunes・Deezer・MusicBrainz で判定します。値を設定すると、Spotify のリンク解決と Last.fm のタグが加わります。

| 名前 | 用途 |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | Spotify API のクライアント ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify API のクライアントシークレット |
| `LASTFM_API_KEY` | Last.fm の API キー |

```bash
pnpm exec wrangler pages secret put SPOTIFY_CLIENT_ID --project-name genre-finder
pnpm exec wrangler pages secret put SPOTIFY_CLIENT_SECRET --project-name genre-finder
pnpm exec wrangler pages secret put LASTFM_API_KEY --project-name genre-finder
```

値はプロンプトで聞かれます。シェル履歴に残したくない場合は、コマンドライン引数で渡さないでください。

シークレットの変更は、新しいデプロイで反映されます。設定後に `pnpm deploy` をもう一度実行してください。

ローカル開発用の値は `.dev.vars` に書きます。`.dev.vars` は `.gitignore` に含まれているので、コミットされません。

```bash
cp .dev.vars.example .dev.vars
```

## GitHub への push で自動デプロイする

GitHub Actions からデプロイするには、Cloudflare の API トークンとアカウント ID を GitHub のリポジトリシークレットに置き、workflow を追加します。既存の `.github/workflows/ci.yml` は型チェック・テスト・ビルドだけを行い、デプロイはしません。

### 1. Cloudflare の API トークンを発行する

1. Cloudflare ダッシュボード右上のアカウントメニューから「API Tokens」を開く。
2. 「Create Token」を選び、テンプレート「Edit Cloudflare Workers」を使う。
3. 権限に「Cloudflare Pages: Edit」が含まれているか確認する。無ければ追加する。
4. アカウントとゾーンの範囲を確認して発行し、トークンを控える（再表示されない）。

アカウント ID は「Workers & Pages」の概要画面、またはダッシュボードの URL から取得できます。

### 2. GitHub のリポジトリシークレットを登録する

GitHub のリポジトリで「Settings」→「Secrets and variables」→「Actions」→「New repository secret」を開き、次の2つを登録します。

| 名前 | 値 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 手順1で発行したトークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID |

### 3. workflow を追加する

`.github/workflows/deploy.yml` を新規作成し、次の内容をコミットします。既存の `ci.yml` は残したままで構いません。

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Deploy
        run: pnpm deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

`pnpm deploy` は型チェックとビルドを行いますが、テストは実行しません。デプロイ前にテストも通したい場合は、Deploy ステップの前に `pnpm test` を足します。

```yaml
      - name: Test
        run: pnpm test
```

`cloudflare/wrangler-action` を使う書き方もあります。どちらでも結果は同じです。

### 補足: Pages の Git 連携を使う場合

Cloudflare ダッシュボードから「Workers & Pages」→「Create」→「Pages」→「Connect to Git」でリポジトリを接続する方法もあります。この場合は上の workflow を追加せず、ビルド設定だけを入れます。

| 項目 | 値 |
| --- | --- |
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Production branch | `main` |

この方法では、Functions のシークレットもダッシュボードの「Settings」→「Variables and Secrets」で設定します。workflow と Git 連携の両方を有効にすると二重にデプロイされるので、どちらか一方にします。

## ローカルで本番同等に確認する

`wrangler pages dev` は、ビルド済みの `dist/` と Functions を Cloudflare のランタイム（workerd）で動かします。

```bash
pnpm preview:cf
```

内部では `pnpm build` のあと `wrangler pages dev dist --port 8788` を実行します。<http://localhost:8788> で確認できます。`wrangler pages dev` は `.dev.vars` を読み込むため、シークレットの動きもローカルで確かめられます。

`public/_routes.json` により、Functions が動くのは `/api/*` だけです。それ以外のパスは `dist/` の静的ファイルを返します。

## カスタムドメインを設定する

1. Cloudflare ダッシュボードで「Workers & Pages」→「genre-finder」→「Custom domains」を開く。
2. 「Set up a custom domain」を選び、使うドメインを入力する。
3. 表示される DNS レコードを設定する。

ドメインが同じ Cloudflare アカウントで管理されている場合は、DNS レコードが自動で追加されます。外部の DNS を使っている場合は、`genre-finder.pages.dev` への CNAME を追加します。HTTPS の証明書は Cloudflare が発行します。

## ロールバックする

デプロイの一覧を確認します。

```bash
pnpm exec wrangler pages deployment list --project-name genre-finder
```

ダッシュボードで「Workers & Pages」→「genre-finder」→「Deployments」を開き、戻したいデプロイの「Rollback to this deployment」を選びます。ロールバックできるのは本番環境のデプロイです。プレビュー環境のデプロイは本番には影響しません。

## ログを見る

Functions のログをリアルタイムで表示します。

```bash
pnpm exec wrangler pages deployment tail --project-name genre-finder
```

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| `Authentication error` や 401 が出る | `pnpm exec wrangler login` をやり直す。GitHub Actions では `CLOUDFLARE_API_TOKEN` の権限と有効期限を確認する |
| `Project not found` が出る | `--project-name` の値が `genre-finder` か確認する。プロジェクトが無ければ作成する |
| `/api/*` が 404 になる | リポジトリ直下に `functions/` があるか確認する。ビルド後の `dist/` に `_routes.json` が含まれているか確認する |
| 古い判定結果が返る | 検索は10分、判定とリンク解決は1時間キャッシュされる。時間を置くか、別のクエリで試す |
| シークレットが反映されない | 設定後に `pnpm deploy` で新しいデプロイを作る |
| デプロイが途中で失敗する | Node.js が 20 以上か確認する。`pnpm install --frozen-lockfile` が通るか確認する |
| MusicBrainz が 403 を返す | MusicBrainz は User-Agent が無いリクエストを拒否する。コードを変更した場合はヘッダーが残っているか確認する |
| Functions で 500 が出る | `pnpm exec wrangler pages deployment tail --project-name genre-finder` でログを見る |
