const test = require('node:test');
const assert = require('node:assert/strict');

const { configuration, issuer, port } = require('../opConfig');

test('op config exposes issuer and port', () => {
  assert.equal(issuer, 'http://localhost:4000');
  assert.equal(port, 4000);
});

test('op config registers rp-client', () => {
  const [client] = configuration.clients;
  assert.equal(client.client_id, 'rp-client');
  assert.ok(client.redirect_uris.includes('http://localhost:3000/callback'));
});
