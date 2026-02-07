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

`http://localhost:3000` にアクセスし、ログインボタンから OIDC フロー（Authorization Code / Implicit）を確認できます。

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
