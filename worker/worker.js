// Cloudflare Worker for Language Buddy.
// - POST /            chat: the app sends { system, contents }; this Worker adds the Gemini key.
// - /push/*           "buddy messages first": stores a push subscription + a small profile in KV,
//                     and a cron trigger writes a message with Gemini and sends a Web Push.
//
// Settings (deploy with `npx wrangler deploy` from this folder; see wrangler.toml):
//   GEMINI_API_KEY    (Secret, required)  key from aistudio.google.com
//   VAPID_PRIVATE_JWK (Secret, for push)  P-256 key as JWK JSON, made by make-vapid.mjs
//   INTERNAL_KEY      (Secret, for push)  random string; lets the cron call /push/run
//   ALLOWED_ORIGIN    (Text, recommended) your GitHub Pages address, e.g. https://yourname.github.io
//   GEMINI_MODEL      (Text, optional)    defaults to gemini-3.5-flash-lite
//   BUDDY             (KV binding, for push)

const WORKER_VERSION = 5;         // shown when you open the worker link; bump on every change
const MAX_TURNS = 60;
const MAX_BODY_CHARS = 1500000;   // room for one resized photo
const MAX_IMAGE_CHARS = 1400000;  // base64 length of a single photo
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Push schedule: only between these local hours, never within QUIET_AFTER_ACTIVE of the user
// chatting, at least MIN_GAP apart, and not while an earlier message is still unread.
const PUSH_FIRST_HOUR = 9;
const PUSH_LAST_HOUR = 21;
const QUIET_AFTER_ACTIVE = 3 * 3600 * 1000;
const MIN_GAP = 3 * 3600 * 1000;
const CRON_MINUTES = 30;          // must match [triggers] crons in wrangler.toml

// Each turn may have text parts and (from the app) one photo as inlineData.
function cleanParts(parts) {
  const out = [];
  for (const p of Array.isArray(parts) ? parts.slice(0, 4) : []) {
    if (typeof p?.text === 'string') out.push({ text: p.text.slice(0, 4000) });
    else if (p?.inlineData && IMAGE_TYPES.includes(p.inlineData.mimeType) &&
             typeof p.inlineData.data === 'string' && p.inlineData.data.length <= MAX_IMAGE_CHARS) {
      out.push({ inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } });
    }
  }
  return out.length ? out : [{ text: '' }];
}

async function callGemini(env, system, contents) {
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 1024 },
    }),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) return { ok: false, status: res.status, error: data.error?.message || `Gemini error ${res.status}` };
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) return { ok: false, status: 502, error: 'Gemini returned an empty answer (maybe blocked by safety filters)' };
  const u = data.usageMetadata || {};
  return { ok: true, text, usage: { prompt: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0, total: u.totalTokenCount || 0 } };
}

// ---------- base64url ----------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};
const utf8 = (s) => new TextEncoder().encode(s);

// ---------- Web Push (VAPID, RFC 8292) ----------
function vapidPublicKey(env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  return b64u(concat(new Uint8Array([4]), unb64u(jwk.x), unb64u(jwk.y)));
}

async function vapidHeader(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(utf8(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 50 * 60,
    sub: env.ALLOWED_ORIGIN && !env.ALLOWED_ORIGIN.includes('*') ? env.ALLOWED_ORIGIN.split(',')[0].trim() : 'https://github.com',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapidPublicKey(env)}`;
}

// Payload encryption (RFC 8291, aes128gcm). Browsers only accept push data encrypted to their key.
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

async function encryptPayload(sub, plaintext) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function sendPush(env, sub, message) {
  const body = await encryptPayload(sub, utf8(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '43200',
      Urgency: 'normal',
    },
    body,
  });
  return { status: res.status, gone: res.status === 404 || res.status === 410, text: res.ok ? '' : (await res.text()).slice(0, 300) };
}

// ---------- the buddy's first message ----------
function localParts(tz, date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: p.weekday };
}

function nudgePrompt(profile) {
  const facts = (profile.facts || []).map((f) => '- ' + f).join('\n') || '(nothing yet)';
  return `You are ${profile.name}, the user's friend who chats with them in ${profile.lang} so they can practise. You are a person with your own life, not a teacher.
Personality: ${profile.persona}
The user is Thai, ${profile.lang} level about CEFR ${profile.level}. Use vocabulary that fits that level.
What you remember about the user:
${facts}
Answer with JSON only: {"reply": "your message in ${profile.lang}"}`;
}

async function writeNudge(env, rec) {
  const p = rec.profile || {};
  const t = localParts(p.tz);
  const contents = (p.recent || []).slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text || '').slice(0, 600) || '(photo)' }] }));
  contents.push({ role: 'user', parts: [{ text: `[App note, not from the user: it is ${t.weekday} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} for the user and they have not opened the chat for a while. Send ONE short message first, like a friend texting out of the blue (1–2 sentences): ask about their day, follow up on something you remember, or share a small thing about "your" day with a question. Do not say you are an AI and do not mention this note.]` }] });
  if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(opened the chat)' }] });
  const r = await callGemini(env, nudgePrompt(p), contents);
  if (!r.ok) return r;
  let reply = r.text.trim();
  try { reply = JSON.parse(reply.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')).reply || reply; } catch {}
  return { ok: true, reply: String(reply).slice(0, 800) };
}

async function nudge(env, id, rec, force) {
  const w = await writeNudge(env, rec);
  if (!w.ok) return { sent: false, error: w.error };
  const now = Date.now();
  const day = localParts(rec.profile?.tz).day;
  rec.pending = [...(rec.pending || []), { text: w.reply, t: now }].slice(-5);
  rec.sent = { day, count: (rec.sent?.day === day ? rec.sent.count : 0) + (force ? 0 : 1), last: now };
  const push = await sendPush(env, rec.sub, { title: rec.profile?.name || 'Buddy', body: w.reply, t: now });
  if (push.gone) { await env.BUDDY.delete('u:' + id); return { sent: false, error: 'subscription expired', push }; }
  await env.BUDDY.put('u:' + id, JSON.stringify(rec));
  return { sent: push.status < 300, push, text: w.reply };
}

function dueNow(rec, now = Date.now()) {
  const p = rec.profile || {};
  const perDay = Math.min(3, Math.max(0, Number(p.perDay) || 0));
  if (!perDay || !rec.sub) return false;
  const t = localParts(p.tz, new Date(now));
  if (t.hour < PUSH_FIRST_HOUR || t.hour >= PUSH_LAST_HOUR) return false;
  const sentToday = rec.sent?.day === t.day ? rec.sent.count : 0;
  if (sentToday >= perDay) return false;
  if ((rec.pending || []).length) return false;
  if (now - (rec.lastActive || 0) < QUIET_AFTER_ACTIVE) return false;
  if (now - (rec.sent?.last || 0) < MIN_GAP) return false;
  // Spread the remaining messages over the cron runs left today, so times feel random.
  const minutesLeft = (PUSH_LAST_HOUR - t.hour) * 60 - t.minute;
  const runsLeft = Math.max(1, Math.ceil(minutesLeft / CRON_MINUTES));
  return Math.random() < (perDay - sentToday) / runsLeft;
}

async function runDue(env) {
  const results = [];
  let cursor;
  do {
    const list = await env.BUDDY.list({ prefix: 'u:', cursor });
    for (const k of list.keys) {
      const rec = await env.BUDDY.get(k.name, 'json');
      if (rec && dueNow(rec)) results.push({ id: k.name.slice(2, 10), ...(await nudge(env, k.name.slice(2), rec, false)) });
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  return results;
}

function cleanProfile(p = {}) {
  const s = (v, n) => String(v ?? '').slice(0, n);
  return {
    name: s(p.name, 20) || 'Buddy',
    persona: s(p.persona, 400),
    lang: s(p.lang, 20) || 'English',
    level: s(p.level, 3) || 'B1',
    tz: s(p.tz, 40) || 'Asia/Bangkok',
    perDay: Math.min(3, Math.max(0, Number(p.perDay) || 0)),
    facts: (Array.isArray(p.facts) ? p.facts : []).slice(-20).map((f) => s(f, 120)),
    recent: (Array.isArray(p.recent) ? p.recent : []).slice(-6).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: s(m.text, 600) })),
  };
}

async function handlePush(path, request, env, json) {
  if (!env.BUDDY || !env.VAPID_PRIVATE_JWK) return json({ error: 'Push is not set up on this worker' }, 501);
  if (path === '/push/key') return json({ key: vapidPublicKey(env) });

  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') { try { body = JSON.parse((await request.text()).slice(0, 20000)); } catch { return json({ error: 'Bad JSON' }, 400); } }
  const id = String(body.id || url.searchParams.get('id') || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Bad id' }, 400);
  const key = 'u:' + id;
  const rec = (await env.BUDDY.get(key, 'json')) || null;

  if (path === '/push/subscribe') {
    const sub = body.sub;
    if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'Bad subscription' }, 400);
    const next = { ...(rec || {}), sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, profile: cleanProfile(body.profile), lastActive: Date.now() };
    await env.BUDDY.put(key, JSON.stringify(next));
    return json({ ok: true });
  }
  if (!rec) return json({ error: 'Not subscribed' }, 404);

  if (path === '/push/sync') {
    rec.profile = cleanProfile(body.profile);
    rec.lastActive = Date.now();
    await env.BUDDY.put(key, JSON.stringify(rec));
    return json({ ok: true });
  }
  if (path === '/push/inbox') {
    const messages = rec.pending || [];
    if (messages.length) { rec.pending = []; await env.BUDDY.put(key, JSON.stringify(rec)); }
    return json({ messages });
  }
  if (path === '/push/test') {
    if (Date.now() - (rec.lastTest || 0) < 60 * 1000) return json({ error: 'รอ 1 นาทีก่อนทดสอบอีกครั้ง' }, 429);
    rec.lastTest = Date.now();
    rec.profile = body.profile ? cleanProfile(body.profile) : rec.profile;
    const r = await nudge(env, id, rec, true);
    return json(r, r.sent ? 200 : 502);
  }
  if (path === '/push/unsubscribe') {
    await env.BUDDY.delete(key);
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/$/, ''));
    const originOk = allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // The cron calls this through the SELF binding so the Gemini request runs where [placement] puts it.
    if (path === '/push/run') {
      if (!env.INTERNAL_KEY || request.headers.get('x-internal') !== env.INTERNAL_KEY) return json({ error: 'Forbidden' }, 403);
      return json({ results: await runDue(env) });
    }
    if (path === '/' && request.method === 'GET') return json({ ok: true, version: WORKER_VERSION, push: !!(env.BUDDY && env.VAPID_PRIVATE_JWK), message: 'Language Buddy worker is running' });
    if (!originOk) return json({ error: 'This website is not allowed to use the worker (check ALLOWED_ORIGIN)' }, 403);
    if (path.startsWith('/push/')) return handlePush(path, request, env, json);
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not set on the worker' }, 500);

    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return json({ error: 'Request too large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Bad JSON' }, 400); }

    const { system, contents } = body;
    if (typeof system !== 'string' || !Array.isArray(contents) || !contents.length || contents.length > MAX_TURNS) {
      return json({ error: 'Expected { system: string, contents: [...] }' }, 400);
    }
    const clean = contents.map((c) => ({ role: c.role === 'model' ? 'model' : 'user', parts: cleanParts(c.parts) }));
    const r = await callGemini(env, system, clean);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ text: r.text, usage: r.usage });
  },

  async scheduled(event, env, ctx) {
    if (!env.BUDDY || !env.VAPID_PRIVATE_JWK) return;
    if (env.SELF && env.INTERNAL_KEY) {
      const res = await env.SELF.fetch('https://internal/push/run', { method: 'POST', headers: { 'x-internal': env.INTERNAL_KEY } });
      console.log('cron', res.status, await res.text());
    } else {
      console.log('cron (inline)', JSON.stringify(await runDue(env)));
    }
  },
};
