const { configuration, issuer, port, host } = require('./opConfig');

// oidc-provider is ESM-only; load it via dynamic import in CommonJS.
(async () => {
  const { Provider } = await import('oidc-provider');
  const provider = new Provider(issuer, configuration);

  provider.use(async (ctx, next) => {
    if (ctx.path !== '/token') {
      return next();
    }

    const headers = { ...ctx.request.headers };
    if (headers.authorization) {
      headers.authorization = '***';
    }

    console.log('token_endpoint request', {
      method: ctx.method,
      headers
    });

    await next();

    let requestBody = ctx.request.body ?? ctx.oidc?.params;
    if (requestBody && typeof requestBody === 'object') {
      requestBody = { ...requestBody };
      if ('client_secret' in requestBody) {
        requestBody.client_secret = '***';
      }
    }

    console.log('token_endpoint request body', requestBody);
    console.log('token_endpoint response', {
      status: ctx.status,
      body: ctx.body
    });
  });

  provider.on('server_error', (ctx, err) => {
    console.error('OIDC server_error:', err);
  });

  provider.listen(port, host, () => {
    console.log(`OIDC OP listening on ${issuer}`);
  });
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
