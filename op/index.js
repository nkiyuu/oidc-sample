const { Provider } = require('oidc-provider');
const { configuration, issuer, port } = require('./opConfig');

const provider = new Provider(issuer, configuration);

provider.listen(port, () => {
  console.log(`OIDC OP listening on ${issuer}`);
});
