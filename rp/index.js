const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { custom, generators, Issuer } = require('openid-client');
const { renderPage } = require('./renderPage');

const app = express();
const PORT = Number(process.env.PORT ?? process.env.RP_PORT ?? 3000);
const RP_BASE_URL = process.env.RP_BASE_URL ?? `http://localhost:${PORT}`;
const ISSUER = process.env.OP_ISSUER ?? 'http://localhost:4000';
function isTokenEndpoint(urlValue) {
  if (!urlValue) {
    return false;
  }
  try {
    const url = urlValue instanceof URL ? urlValue : new URL(urlValue);
    return url.pathname.endsWith('/token');
  } catch {
    return false;
  }
}

function sanitizeTokenRequest(options) {
  const headers = { ...(options.headers || {}) };
  if (headers.authorization) {
    headers.authorization = '***';
  }

  let body = options.form ?? options.body ?? null;
  if (body && typeof body === 'object') {
    if (body instanceof URLSearchParams) {
      body = Object.fromEntries(body.entries());
    } else {
      body = { ...body };
    }
    if ('client_secret' in body) {
      body.client_secret = '***';
    }
  }

  return { headers, body };
}

custom.setHttpOptionsDefaults({
  hooks: {
    beforeRequest: [
      (options) => {
        const url = options?.url?.href || options?.url;
        if (!isTokenEndpoint(url)) {
          return options;
        }

        const { headers, body } = sanitizeTokenRequest(options);
        console.log('token_endpoint request', {
          method: options.method,
          url,
          headers,
          body
        });
        return options;
      }
    ],
    afterResponse: [
      (response) => {
        const url = response?.url;
        if (!isTokenEndpoint(url)) {
          return response;
        }

        let body = response.body;
        if (Buffer.isBuffer(body)) {
          body = body.toString('utf8');
        }
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch {
            // keep as string
          }
        }

        console.log('token_endpoint response', {
          statusCode: response.statusCode,
          headers: response.headers,
          body
        });

        return response;
      }
    ]
  }
});

app.use(
  session({
    secret: 'replace-this-session-secret',
    resave: false,
    saveUninitialized: false
  })
);
app.use(express.urlencoded({ extended: false }));

const ALLOWED_QUERY_PARAMS = new Set([
  'scope',
  'prompt',
  'max_age',
  'login_hint',
  'ui_locales',
  'acr_values',
  'response_type',
  'redirect_uri',
]);

function pickAllowedParams(input) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (ALLOWED_QUERY_PARAMS.has(key) && value !== '') {
      output[key] = value;
    }
  }
  return output;
}

function normalizeAuthParams(params, req) {
  const authParams = { ...params };
  authParams.scope = authParams.scope || 'openid profile email';
  authParams.state = generators.state();
  authParams.nonce = generators.nonce();

  // redirect_uri は許可済みのもののみ固定で上書き
  const redirectMap = new Map([
    ['callback', `${RP_BASE_URL}/callback`],
    ['fragment', `${RP_BASE_URL}/callback/fragment`]
  ]);
  if (authParams.redirect_uri && redirectMap.has(authParams.redirect_uri)) {
    authParams.redirect_uri = redirectMap.get(authParams.redirect_uri);
  } else if (!authParams.redirect_uri) {
    authParams.redirect_uri = `${RP_BASE_URL}/callback`;
  } else {
    throw new Error('redirect_uri は callback / fragment のみ指定できます');
  }

  if (!authParams.response_type) {
    authParams.response_type = 'code';
  }

  if (authParams.response_type.includes('code')) {
    req.session.authRequest = {
      state: authParams.state,
      nonce: authParams.nonce
    };
  } else {
    req.session.authRequest = {
      state: authParams.state,
      nonce: authParams.nonce
    };
  }

  return authParams;
}

function buildAuthRequest(flow) {
  const state = generators.state();
  const nonce = generators.nonce();
  const baseParams = {
    scope: 'openid profile email',
    state,
    nonce
  };

  switch (flow) {
    case 'code': {
      return {
        authRequest: { state, nonce },
        params: {
          ...baseParams,
          response_type: 'code',
          redirect_uri: `${RP_BASE_URL}/callback`
        }
      };
    }
    case 'implicit': {
      return {
        authRequest: { state, nonce },
        params: {
          ...baseParams,
          response_type: 'id_token',
          redirect_uri: `${RP_BASE_URL}/callback/fragment`
        }
      };
    }
    case 'hybrid': {
      return {
        authRequest: { state, nonce },
        params: {
          ...baseParams,
          response_type: 'code id_token',
          redirect_uri: `${RP_BASE_URL}/callback/fragment`
        }
      };
    }
    default:
      throw new Error(`unsupported flow: ${flow}`);
  }
}

async function handleLogin(flow, req, res, next) {
  try {
    const client = await getClient();
    const usePending = req.query.use === '1';
    let pending = req.session.pendingAuth;
    let auth;

    if (usePending && pending && pending.flow === flow) {
      auth = pending;
      req.session.pendingAuth = null;
    } else {
      auth = buildAuthRequest(flow);
    }

    const authorizationUrl = client.authorizationUrl(auth.params);

    if (req.query.show === '1') {
      req.session.pendingAuth = { flow, ...auth };
      res.send(
        renderPage({
          title: `認可リクエスト (${flow})`,
          body: `<p>以下のパラメータで認可リクエストを送信します。</p>
<pre>${JSON.stringify(auth.params, null, 2)}</pre>
<p>認可URL:</p>
<pre>${authorizationUrl}</pre>
<p><a href="${req.path}?use=1">この内容でログイン</a></p>
<p><a href="/">トップに戻る</a></p>`
        })
      );
      return;
    }

    req.session.authRequest = auth.authRequest;
    res.redirect(authorizationUrl);
  } catch (error) {
    next(error);
  }
}

async function getClient() {
  if (!app.locals.client) {
    const issuer = await Issuer.discover(ISSUER);
    app.locals.client = new issuer.Client({
      client_id: 'rp-client',
      client_secret: 'rp-secret',
      redirect_uris: [`${RP_BASE_URL}/callback`, `${RP_BASE_URL}/callback/fragment`],
      post_logout_redirect_uris: [`${RP_BASE_URL}/logout/callback`],
      response_types: ['code', 'id_token', 'code id_token']
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
       <p><a href="/login?show=1">パラメータ表示 (Authorization Code)</a></p>
       <p><a href="/login/implicit">ログイン (Implicit)</a></p>
       <p><a href="/login/implicit?show=1">パラメータ表示 (Implicit)</a></p>
       <p><a href="/login/hybrid">ログイン (Hybrid)</a></p>
       <p><a href="/login/hybrid?show=1">パラメータ表示 (Hybrid)</a></p>
       <p><a href="/login/custom">カスタム認可リクエスト</a></p>`;

  res.send(renderPage({ title: 'OIDC RP サンプル', body }));
});

app.get('/login/custom', (req, res) => {
  const body = `<form method="post" action="/login/custom">
  <p><label>response_type:
    <input name="response_type" value="code" placeholder="code / id_token / code id_token" />
  </label></p>
  <p><label>redirect_uri:
    <select name="redirect_uri">
      <option value="callback">callback (query)</option>
      <option value="fragment">callback/fragment</option>
    </select>
  </label></p>
  <p><label>scope:
    <input name="scope" value="openid profile email" />
  </label></p>
  <p><label>prompt:
    <input name="prompt" placeholder="login / consent / select_account" />
  </label></p>
  <p><label>max_age:
    <input name="max_age" placeholder="300" />
  </label></p>
  <p><label>login_hint:
    <input name="login_hint" placeholder="alice" />
  </label></p>
  <p><label>ui_locales:
    <input name="ui_locales" placeholder="ja en" />
  </label></p>
  <p><label>acr_values:
    <input name="acr_values" placeholder="urn:mace:incommon:iap:silver" />
  </label></p>
  <p><button type="submit">この内容でログイン</button></p>
</form>
<p><a href="/">トップに戻る</a></p>`;
  res.send(renderPage({ title: 'カスタム認可リクエスト', body }));
});

app.post('/login/custom', async (req, res, next) => {
  try {
    const client = await getClient();
    const rawParams = pickAllowedParams(req.body);
    const authParams = normalizeAuthParams(rawParams, req);
    const authorizationUrl = client.authorizationUrl(authParams);

    res.send(
      renderPage({
        title: 'カスタム認可リクエスト',
        body: `<p>以下のパラメータで認可リクエストを送信します。</p>
<pre>${JSON.stringify(authParams, null, 2)}</pre>
<p>認可URL:</p>
<pre>${authorizationUrl}</pre>
<p><a href="${authorizationUrl}">この内容でログイン</a></p>
<p><a href="/">トップに戻る</a></p>`
      })
    );
  } catch (error) {
    next(error);
  }
});

app.get('/login', (req, res, next) => handleLogin('code', req, res, next));
app.get('/login/implicit', (req, res, next) => handleLogin('implicit', req, res, next));
app.get('/login/hybrid', (req, res, next) => handleLogin('hybrid', req, res, next));

app.get('/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const authRequest = req.session.authRequest || {};

    const tokenSet = await client.callback(`${RP_BASE_URL}/callback`, params, {
      state: authRequest.state,
      nonce: authRequest.nonce
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

app.get('/callback/fragment', (req, res) => {
  res.send(
    renderPage({
      title: 'ログイン処理中',
      body: `<script>
  (function () {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) {
      document.body.innerHTML = '<p>認可応答が見つかりません。</p>';
      return;
    }
    var form = document.createElement('form');
    form.method = 'post';
    form.action = '${RP_BASE_URL}/callback/fragment';
    var params = new URLSearchParams(hash.slice(1));
    params.forEach(function (value, key) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  })();
</script>`
    })
  );
});

app.post('/callback/fragment', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = req.body || {};
    const authRequest = req.session.authRequest || {};

    const tokenSet = await client.callback(`${RP_BASE_URL}/callback/fragment`, params, {
      state: authRequest.state,
      nonce: authRequest.nonce
    });

    const userinfo = tokenSet.access_token
      ? await client.userinfo(tokenSet.access_token)
      : null;

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
