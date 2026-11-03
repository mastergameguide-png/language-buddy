// Makes a VAPID key pair for Web Push and prints the private key as JWK JSON.
// Store it as a secret (it never goes in the repo):
//   node make-vapid.mjs | npx wrangler secret put VAPID_PRIVATE_JWK
const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', privateKey);
process.stdout.write(JSON.stringify({ kty, crv, x, y, d }));
