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
