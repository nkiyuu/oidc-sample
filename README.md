# OIDC OP / RP サンプル

OpenID Connect の OP (OpenID Provider) と RP (Relying Party) をローカルで動かすための最小サンプルです。

## 構成

- `op/`: OIDC Provider (`oidc-provider`)
- `rp/`: OIDC Relying Party (`openid-client` + Express)

## 前提条件

- Node.js 18 以上

## 起動手順

### 1. OP を起動

```bash
cd op
npm install
npm start
```

`http://localhost:4000` で OP が起動します。

テストを実行する場合:

```bash
npm test
```

### 2. RP を起動

別ターミナルで:

```bash
cd rp
npm install
npm start
```

`http://localhost:3000` にアクセスし、ログインボタンから OIDC フロー（Authorization Code / Implicit / Hybrid）を確認できます。

※ ローカルの `http://` 環境では `post_logout_redirect_uri` を登録/送信しません（`oidc-provider` は implicit 用の HTTPS 制約を適用するため）。HTTPS の URL を `RP_BASE_URL` に設定した場合のみ有効化されます。

テストを実行する場合:

```bash
npm test
```

## 参考

このサンプルは `oidc-provider` の dev interaction を有効にしています。画面上のログインフォームで適当なユーザー名・パスワードを入力して進めてください。

## Docker で起動する場合

Docker Compose で OP と RP をまとめて起動できます。

```bash
docker compose up --build
```

`http://localhost:3000` にアクセスして動作を確認してください。

### 環境変数

OP / RP の URL を変更したい場合は、以下の環境変数を指定できます。

- `OP_ISSUER`: OP の issuer URL（例: `http://localhost:4000`）
- `OP_PORT`: OP の待受ポート（例: `4000`）
- `RP_BASE_URL`: RP の外部 URL（例: `http://localhost:3000`）
- `RP_PORT`: RP の待受ポート（例: `3000`）

`docker-compose.yml` は Linux 環境向けに `network_mode: host` を使っています。macOS/Windows で利用する場合は、`network_mode` を削除し、`OP_ISSUER` と `RP_BASE_URL` にホストからアクセス可能な URL を設定してください。

## Google Cloud Run にデプロイする場合

Cloud Run ではサービスごとにコンテナをデプロイするため、OP と RP を別サービスとしてデプロイします。
各サービスの URL が HTTPS になる点を前提に、OP/RP の環境変数を調整してください。

### 事前準備

- gcloud CLI をセットアップし、対象プロジェクトを選択する
- Container Registry または Artifact Registry を利用できるようにする

### OP をデプロイ

```bash
gcloud run deploy oidc-op \
  --source ./op \
  --region asia-northeast1 \
  --set-env-vars OP_ISSUER=https://<OPのCloud Run URL>,RP_BASE_URL=https://<RPのCloud Run URL>
```

### RP をデプロイ

```bash
gcloud run deploy oidc-rp \
  --source ./rp \
  --region asia-northeast1 \
  --set-env-vars OP_ISSUER=https://<OPのCloud Run URL>,RP_BASE_URL=https://<RPのCloud Run URL>
```

### 注意点

- Cloud Run は `PORT` 環境変数を使うため、OP/RP ともに `PORT` が優先されます。
- OP/RP の URL が変わる場合は、両方の `OP_ISSUER` / `RP_BASE_URL` を合わせて更新してください。
