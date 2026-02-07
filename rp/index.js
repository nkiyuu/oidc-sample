const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { generators, Issuer } = require('openid-client');
const { renderPage } = require('./renderPage');

const app = express();
const PORT = Number(process.env.PORT ?? process.env.RP_PORT ?? 3000);
const RP_BASE_URL = process.env.RP_BASE_URL ?? `http://localhost:${PORT}`;
const ISSUER = process.env.OP_ISSUER ?? 'http://localhost:4000';

app.use(
  session({
    secret: 'replace-this-session-secret',
    resave: false,
    saveUninitialized: false
  })
);
app.use(express.urlencoded({ extended: false }));

async function getClient() {
  if (!app.locals.client) {
    const issuer = await Issuer.discover(ISSUER);
    app.locals.client = new issuer.Client({
      client_id: 'rp-client',
      client_secret: 'rp-secret',
      redirect_uris: [`${RP_BASE_URL}/callback`, `${RP_BASE_URL}/callback-implicit`],
      post_logout_redirect_uris: [`${RP_BASE_URL}/logout/callback`],
      response_types: ['code', 'id_token', 'id_token token']
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
       <p><a href="/login">ログイン (Authorization Code)</a></p>
       <p><a href="/login-implicit">ログイン (Implicit)</a></p>`;

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

app.get('/login-implicit', async (req, res, next) => {
  try {
    const client = await getClient();
    const state = generators.state();
    const nonce = generators.nonce();

    req.session.authRequest = {
      state,
      nonce
    };

    const authorizationUrl = client.authorizationUrl({
      scope: 'openid profile email',
      state,
      nonce,
      response_type: 'id_token token',
      response_mode: 'form_post'
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

    const tokenSet = await client.callback(`${RP_BASE_URL}/callback`, params, {
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

app.post('/callback-implicit', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const authRequest = req.session.authRequest || {};

    const tokenSet = await client.callback(`${RP_BASE_URL}/callback-implicit`, params, {
      state: authRequest.state,
      nonce: authRequest.nonce
    });

    const claims = tokenSet.claims();
    const userinfo = tokenSet.access_token
      ? await client.userinfo(tokenSet.access_token)
      : { sub: claims.sub };

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
        post_logout_redirect_uri: `${RP_BASE_URL}/logout/callback`,
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
  console.log(`OIDC RP listening on ${RP_BASE_URL}`);
});
