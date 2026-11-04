// Web Push: payload encryption (RFC 8291), VAPID JWT, schedule rules, inbox routes.
// Run: node tests/push.test.mjs
import nodeCrypto from 'node:crypto';
import { loadWorker, suite, fakeKV } from './helpers.mjs';

const W = await loadWorker(['encryptPayload', 'vapidHeader', 'vapidPublicKey', 'dueNow', 'localParts', 'cleanProfile', 'nudgePrompt']);
const { check, done } = suite('push');
const b64u = (b) => Buffer.from(b).toString('base64url');

// Decrypts aes128gcm the way a browser does, so a broken encryptPayload is caught without npm packages.
function decrypt(body, ua, auth) {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16), idlen = buf[20], asPublic = buf.subarray(21, 21 + idlen), cipher = buf.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(nodeCrypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString('utf8');   // strip the padding delimiter
}

const ua = nodeCrypto.createECDH('prime256v1'); ua.generateKeys();
const auth = nodeCrypto.randomBytes(16);
const sub = { endpoint: 'https://web.push.apple.com/QAbc123', keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) } };
const msg = { title: 'Emma', body: 'Hey! How was your day? 😊 วันนี้เป็นไง', t: 1 };
const enc = await W.encryptPayload(sub, new TextEncoder().encode(JSON.stringify(msg)));
let plain = '';
try { plain = decrypt(enc, ua, auth); } catch (e) { plain = 'ERR ' + e.message; }
check('payload decrypts (RFC 8291)', plain === JSON.stringify(msg), plain.slice(0, 60));

const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey('jwk', privateKey);
const venv = { VAPID_PRIVATE_JWK: JSON.stringify({ kty, crv, x, y, d }), ALLOWED_ORIGIN: 'https://mastergameguide-png.github.io' };
const hdr = await W.vapidHeader(venv, sub.endpoint);
const m = hdr.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
check('vapid header format', !!m);
const pub = nodeCrypto.createPublicKey({ key: { kty, crv, x, y }, format: 'jwk' });
check('vapid JWT signature verifies', !!m && nodeCrypto.verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')));
const claims = m ? JSON.parse(Buffer.from(m[2], 'base64url')) : {};
check('vapid claims', claims.aud === 'https://web.push.apple.com' && claims.sub === venv.ALLOWED_ORIGIN && claims.exp - Date.now() / 1000 < 3600, claims);
check('public key is a 65-byte point', !!m && Buffer.from(m[4], 'base64url').length === 65 && m[4] === W.vapidPublicKey(venv));

// ---- schedule ----
const bkk = (h, min = 0) => new Date(Date.UTC(2026, 10, 4, h - 7, min)).getTime();   // Asia/Bangkok = UTC+7
const rate = (rec, when) => { let n = 0; for (let i = 0; i < 3000; i++) if (W.dueNow(rec, when)) n++; return n / 3000; };
check('localParts Bangkok', W.localParts('Asia/Bangkok', new Date(bkk(10, 15))).hour === 10);

const base = { sub, profile: W.cleanProfile({ perDay: 2, tz: 'Asia/Bangkok' }), lastActive: 0, pending: [] };
check('random: never at night (23:00)', rate(base, bkk(23)) === 0);
check('random: never at 08:30', rate(base, bkk(8, 30)) === 0);
const morning = rate(base, bkk(10));
check('random: sometimes in the morning (10:00)', morning > 0.01 && morning < 0.2, morning);
check('random: always in the last run (20:45) if still owed', rate(base, bkk(20, 45)) === 1);
check('random: not while an unread message is pending', rate({ ...base, pending: [{ text: 'x' }] }, bkk(15)) === 0);
check('random: not right after the user chatted', rate({ ...base, lastActive: bkk(14) }, bkk(15)) === 0);
check('random: not when the daily count is reached', rate({ ...base, sent: { day: '2026-11-04', count: 2, last: 0 } }, bkk(15)) === 0);
check('random: not within 3h of the last push', rate({ ...base, sent: { day: '2026-11-04', count: 1, last: bkk(13) } }, bkk(15)) === 0);
check('perDay 0 = off', rate({ ...base, profile: { ...base.profile, perDay: 0 } }, bkk(20, 45)) === 0);

const fixed = { sub, lastActive: 0, pending: [], profile: W.cleanProfile({ mode: 'fixed', times: ['19:00', '07:30', 'bad', '07:30'], tz: 'Asia/Bangkok' }) };
check('cleanProfile keeps valid unique sorted times', fixed.profile.times.join() === '07:30,19:00', fixed.profile.times);
check('fixed: due at 07:30', W.dueNow(fixed, bkk(7, 30))?.slot === '07:30');
check('fixed: due at 07:41 (late cron)', W.dueNow(fixed, bkk(7, 41))?.slot === '07:30');
check('fixed: not at 07:29', W.dueNow(fixed, bkk(7, 29)) === false);
check('fixed: not at 07:45 (window passed)', W.dueNow(fixed, bkk(7, 45)) === false);
check('fixed: always due (not random)', rate(fixed, bkk(19, 5)) === 1);
const sentSlot = { ...fixed, sent: { day: '2026-11-04', count: 1, slots: ['07:30'], last: bkk(7, 30) } };
check('fixed: not twice for the same slot', W.dueNow(sentSlot, bkk(7, 40)) === false);
check('fixed: other slot still due', W.dueNow(sentSlot, bkk(19))?.slot === '19:00');
check('fixed: new day resets slots', W.dueNow({ ...fixed, sent: { day: '2026-11-03', count: 2, slots: ['07:30', '19:00'], last: 0 } }, bkk(7, 30))?.slot === '07:30');
check('fixed: skipped while chatting', W.dueNow({ ...fixed, lastActive: bkk(7, 25) }, bkk(7, 30)) === false);
check('fixed: no times = never', W.dueNow({ ...fixed, profile: { ...fixed.profile, times: [] } }, bkk(19)) === false);

const rnd = { sub, lastActive: 0, pending: [], profile: W.cleanProfile({ mode: 'random', perDay: 2, from: 18, to: 23, tz: 'Asia/Bangkok' }) };
check('custom window saved', rnd.profile.from === 18 && rnd.profile.to === 23);
check('custom window: never before (17:50) or after (23:10)', rate(rnd, bkk(17, 50)) === 0 && rate(rnd, bkk(23, 10)) === 0);
check('bad window falls back to 9–21', W.cleanProfile({ from: 20, to: 10 }).from === 9 && W.cleanProfile({ from: 20, to: 10 }).to === 21);
const shortWin = { ...rnd, profile: W.cleanProfile({ perDay: 3, from: 20, to: 22, tz: 'Asia/Bangkok' }), sent: { day: '2026-11-04', count: 1, slots: [], last: bkk(20, 0) } };
check('short window shrinks the gap', rate(shortWin, bkk(21, 55)) === 1);
check('old profile without mode = random 9–21', W.cleanProfile({ perDay: 1 }).mode === 'random' && W.cleanProfile({}).from === 9);

// ---- character identity + honesty ----
check('profile keeps a valid character id', W.cleanProfile({ char: 'emma' }).char === 'emma');
check('profile drops a bad character id', W.cleanProfile({ char: '<script>' }).char === '' && W.cleanProfile({}).char === '');
const np = W.nudgePrompt(W.cleanProfile({ name: 'Emma', char: 'emma' }));
check('push prompt says it is a fictional AI character', /fictional AI character/.test(np) && /Never claim to be a real human/.test(np));
check('push prompt no longer hides being an AI', !/Do not say you are an AI/.test(np));

// ---- routes with a fake KV and fake AI: pending messages carry the character; cron logs no text ----
const KV = fakeKV();
const SECRET = 'Today I went hiking at Doi Suthep';
globalThis.fetch = async (url) => {
  if (String(url).includes('generativelanguage') || String(url).includes('groq')) {
    return new Response(JSON.stringify(String(url).includes('groq') ? { choices: [{ message: { content: JSON.stringify({ reply: SECRET }) } }] } : { candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: SECRET }) }] } }] }), { status: 200 });
  }
  return new Response('', { status: 201 });   // push service accepts
};
const env = { GEMINI_API_KEY: 'g', BUDDY: KV, ...venv, ALLOWED_ORIGIN: 'https://site', INTERNAL_KEY: 'ik' };
const id = crypto.randomUUID();
const call = (path, body, method = 'POST') => W.__default.fetch(new Request(`https://w${path}${method === 'GET' ? `?id=${id}` : ''}`, method === 'GET' ? { headers: { Origin: 'https://site' } } : { method, headers: { Origin: 'https://site' }, body: JSON.stringify({ id, ...body }) }), env);
let r = await call('/push/subscribe', { sub, profile: { name: 'Emma', char: 'emma', perDay: 1 } });
check('subscribe ok', r.status === 200);
r = await call('/push/test', { profile: { name: 'Emma', char: 'emma' } });
check('test push sent', r.status === 200, await r.clone().text());
r = await call('/push/inbox', null, 'GET');
const inbox = (await r.json()).messages || [];
check('inbox message is tagged with its character', inbox.length === 1 && inbox[0].char === 'emma' && inbox[0].text === SECRET, inbox);

// Force a due random push, then check /push/run's output (what the cron logs) has no text.
const rec = await KV.get('u:' + id, 'json');
rec.profile = { ...rec.profile, perDay: 3, from: 0, to: 24 };
rec.pending = []; rec.lastActive = 0; rec.sent = { day: '1999-01-01', count: 0, slots: [], last: 0 };
await KV.put('u:' + id, JSON.stringify(rec));
const realRandom = Math.random; Math.random = () => 0;
r = await W.__default.fetch(new Request('https://w/push/run', { method: 'POST', headers: { 'x-internal': 'ik' } }), env);
Math.random = realRandom;
const runText = await r.text();
check('cron run sends', /"sent":true/.test(runText), runText);
check('cron output contains no message text', !runText.includes(SECRET) && !runText.includes('hiking'));

done();
