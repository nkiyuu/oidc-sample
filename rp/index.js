const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { generators, Issuer } = require('openid-client');

const app = express();
const PORT = 3000;
const ISSUER = 'http://localhost:4000';

app.use(
  session({
    secret: 'replace-this-session-secret',
    resave: false,
    saveUninitialized: false
  })
);

function renderPage({ title, body }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <h1>${title}</h1>
    ${body}
  </body>
</html>`;
}

async function getClient() {
  if (!app.locals.client) {
    const issuer = await Issuer.discover(ISSUER);
    app.locals.client = new issuer.Client({
      client_id: 'rp-client',
      client_secret: 'rp-secret',
      redirect_uris: ['http://localhost:3000/callback'],
      post_logout_redirect_uris: ['http://localhost:3000/logout/callback'],
      response_types: ['code']
    });
  }

  return app.locals.client;
}

app.get('/', (req, res) => {
  const sessionData = req.session.user;
  const body = sessionData
    ? `<p>ログイン済みです。</p>
       <pre>${JSON.stringify(sessionData, null, 2)}</pre>
       <p><a href="/logout">ログアウト</a></p>`
    : `<p>未ログインです。</p>
       <p><a href="/login">ログイン</a></p>`;

  res.send(renderPage({ title: 'OIDC RP サンプル', body }));
});

app.get('/login', async (req, res, next) => {
  try {
    const client = await getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    req.session.authRequest = {
      state,
      nonce,
      codeVerifier
    };

    const authorizationUrl = client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    res.redirect(authorizationUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const authRequest = req.session.authRequest || {};

    const tokenSet = await client.callback('http://localhost:3000/callback', params, {
      state: authRequest.state,
      nonce: authRequest.nonce,
      code_verifier: authRequest.codeVerifier
    });

    const userinfo = await client.userinfo(tokenSet.access_token);

    req.session.user = {
      tokens: tokenSet,
      userinfo
    };

    res.redirect('/');
  } catch (error) {
    next(error);
  }
});

app.get('/logout', async (req, res, next) => {
  try {
    const client = await getClient();
    const idToken = req.session.user?.tokens?.id_token;
    req.session.destroy(() => {
      const url = client.endSessionUrl({
        id_token_hint: idToken,
        post_logout_redirect_uri: 'http://localhost:3000/logout/callback',
        state: crypto.randomUUID()
      });

      res.redirect(url);
    });
  } catch (error) {
    next(error);
  }
});

app.get('/logout/callback', (req, res) => {
  res.send(
    renderPage({
      title: 'ログアウト完了',
      body: '<p><a href="/">トップに戻る</a></p>'
    })
  );
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(renderPage({ title: 'エラー', body: `<pre>${err.message}</pre>` }));
});

app.listen(PORT, () => {
  console.log(`OIDC RP listening on http://localhost:${PORT}`);
});
