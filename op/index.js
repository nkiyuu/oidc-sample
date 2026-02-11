const { configuration, issuer, port, host } = require('./opConfig');

// oidc-provider is ESM-only; load it via dynamic import in CommonJS.
(async () => {
  const { Provider } = await import('oidc-provider');
  const provider = new Provider(issuer, configuration);

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
