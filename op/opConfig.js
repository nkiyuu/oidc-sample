const issuer = 'http://localhost:4000';
const port = 4000;

const configuration = {
  clients: [
    {
      client_id: 'rp-client',
      client_secret: 'rp-secret',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      redirect_uris: ['http://localhost:3000/callback'],
      post_logout_redirect_uris: ['http://localhost:3000/logout/callback'],
      token_endpoint_auth_method: 'client_secret_basic'
    }
  ],
  features: {
    devInteractions: { enabled: true }
  },
  cookies: {
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
  port
};
