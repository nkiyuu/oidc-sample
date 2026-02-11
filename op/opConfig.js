const host = process.env.OP_HOST ?? '127.0.0.1';
const issuer = process.env.OP_ISSUER ?? `http://localhost:4000`;
const port = Number(process.env.PORT ?? process.env.OP_PORT ?? 4000);
const rpBaseUrl = process.env.RP_BASE_URL ?? 'http://localhost:3000';

const isHttps = rpBaseUrl.startsWith('https://');
const applicationType = isHttps ? 'web' : 'native';

const configuration = {
  clients: [
    {
      client_id: 'rp-client',
      client_secret: 'rp-secret',
      application_type: applicationType,
      grant_types: ['authorization_code', 'refresh_token', 'implicit'],
      response_types: ['code', 'id_token', 'code id_token'],
      redirect_uris: [`${rpBaseUrl}/callback`, `${rpBaseUrl}/callback/fragment`],
      post_logout_redirect_uris: [`${rpBaseUrl}/logout/callback`],
      token_endpoint_auth_method: 'client_secret_basic'
    }
  ],
  features: {
    devInteractions: { enabled: true }
  },
  pkce: {
    required: () => false
  },
  cookies: {
    keys: ['replace-this-cookie-secret'],
    long: { signed: true },
    short: { signed: true }
  },
  ttl: {
    AccessToken: 3600,
    AuthorizationCode: 600,
    ClientCredentials: 3600,
    DeviceCode: 600,
    IdToken: 3600,
    RefreshToken: 24 * 3600
  }
};

module.exports = {
  configuration,
  issuer,
  port,
  host
};
