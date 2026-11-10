// Worker: Gemini/Groq routing and fallback with fake upstreams. Run: node tests/worker-route.test.mjs
import fs from 'node:fs';
import { loadWorker, suite, WORKER_PATH } from './helpers.mjs';

const W = (await loadWorker()).__default;
const { check, done } = suite('worker routing');
const ORIGIN = 'https://site';

let script = {}, calls = [];
globalThis.fetch = async (url, init) => {
  const who = String(url).includes('groq') ? 'groq' : 'gemini';
  const body = JSON.parse(init.body);
  calls.push({ who, body });
  const r = script[who](body);
  return new Response(JSON.stringify(r.body), { status: r.status });
};
const gemOk = () => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: '{"reply":"from gemini"}' }] } }], usageMetadata: { totalTokenCount: 10 } } });
const groqOk = () => ({ status: 200, body: { choices: [{ message: { content: '{"reply":"from groq"}' } }], usage: { total_tokens: 7 } } });
const err = (status, message) => () => ({ status, body: { error: { message } } });

const env = (extra = {}) => ({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', ALLOWED_ORIGIN: ORIGIN, ...extra });
const ask = async (e, payload = {}) => {
  calls = [];
  const res = await W.fetch(new Request('https://w/', {
    method: 'POST', headers: { Origin: ORIGIN },
    body: JSON.stringify({ system: 's', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], ...payload }),
  }), e);
  return { status: res.status, json: await res.json(), who: calls.map((c) => c.who) };
};
const photo = { contents: [{ role: 'user', parts: [{ text: 'look' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } }] }] };

script = { gemini: gemOk, groq: groqOk };
let r = await ask(env());
check('auto: Gemini first', r.json.provider === 'gemini' && r.who.join() === 'gemini');

script = { gemini: err(429, 'Quota exceeded per day'), groq: groqOk };
r = await ask(env());
check('auto: Gemini 429 → Groq', r.json.provider === 'groq' && r.json.fellBack[0].status === 429);

script = { gemini: err(400, 'User location is not supported'), groq: groqOk };
r = await ask(env());
check('auto: location error → Groq', r.json.provider === 'groq');

script = { gemini: err(503, 'overloaded'), groq: err(500, 'down') };
r = await ask(env());
check('both down → error with details', r.status === 500 && r.json.fellBack.length === 2);

script = { gemini: gemOk, groq: groqOk };
r = await ask(env(), { ai: 'groq' });
check('groq mode: Groq first', r.json.provider === 'groq' && r.who[0] === 'groq');

r = await ask(env(), photo);
check('photo always Gemini', r.json.provider === 'gemini' && r.who.join() === 'gemini');

script = { gemini: err(429, 'quota'), groq: groqOk };
r = await ask(env(), photo);
check('photo does not fall back to Groq', r.status === 429 && !r.who.includes('groq'));

script = { gemini: gemOk, groq: err(503, 'down') };
r = await ask(env(), { ai: 'groq' });
check('groq mode: Groq down → Gemini', r.json.provider === 'gemini');

let n = 0;
script = { gemini: err(429, 'quota'), groq: (b) => (n++ === 0 && b.response_format ? { status: 400, body: { error: { message: 'response_format not supported' } } } : groqOk()) };
r = await ask(env());
check('Groq JSON-mode 400 → retried without response_format', r.json.provider === 'groq' && !calls[calls.length - 1].body.response_format);

script = { gemini: gemOk };
r = await ask(env({ GROQ_API_KEY: undefined }));
check('no Groq key: Gemini only', r.json.provider === 'gemini');
script = { gemini: err(429, 'quota') };
r = await ask(env({ GROQ_API_KEY: undefined }));
check('no Groq key: Gemini 429 returned', r.status === 429);

script = { gemini: err(429, 'quota'), groq: groqOk };
await ask(env(), { contents: [{ role: 'user', parts: [{ text: 'a' }] }, { role: 'model', parts: [{ text: 'b' }] }] });
const groqCall = calls.find((c) => c.who === 'groq').body;
check('Groq message format', groqCall.messages[0].role === 'system' && groqCall.messages[2].role === 'assistant');

const g = await W.fetch(new Request('https://w/'), env());
const gj = await g.json();
check('GET / lists AIs and version', gj.ok && gj.ai.join() === 'gemini,groq' && Number.isInteger(gj.version));

// ---------- Workers AI (binding "AI"): the third AI, only after Gemini and Groq ----------
let cfCalls = [];
const fakeAI = (reply) => ({ run: async (model, input) => { cfCalls.push({ model, input }); return reply(input); } });
const cfOk = () => ({ choices: [{ message: { content: '{"reply":"from cloudflare"}' } }], usage: { total_tokens: 5 } });

script = { gemini: gemOk, groq: groqOk }; cfCalls = [];
r = await ask(env({ AI: fakeAI(cfOk) }));
check('Workers AI not used while Gemini works', r.json.provider === 'gemini' && cfCalls.length === 0);

script = { gemini: err(503, 'high demand'), groq: err(429, 'rate limit') }; cfCalls = [];
r = await ask(env({ AI: fakeAI(cfOk) }), { contents: [{ role: 'user', parts: [{ text: 'a' }] }, { role: 'model', parts: [{ text: 'b' }] }] });
check('Gemini + Groq down → Workers AI', r.status === 200 && r.json.provider === 'cloudflare' && r.json.text === '{"reply":"from cloudflare"}' && r.json.fellBack.length === 2);
check('Workers AI: default free model, chat format, JSON mode', cfCalls[0].model === '@cf/google/gemma-4-26b-a4b-it' && cfCalls[0].input.messages[0].role === 'system' && cfCalls[0].input.messages[2].role === 'assistant' && cfCalls[0].input.response_format?.type === 'json_object');

cfCalls = [];
r = await ask(env({ AI: fakeAI(() => ({ response: { reply: 'obj' } })) }));
check('Workers AI: older "response" field and parsed JSON both work', r.json.text === '{"reply":"obj"}');

cfCalls = [];
r = await ask(env({ AI: { run: async (m, input) => { cfCalls.push(input); if (input.response_format) throw new Error('response_format not supported'); return { response: 'plain' }; } } }));
check('Workers AI: JSON mode rejected → retried without it', r.json.text === 'plain' && cfCalls.length === 2 && !cfCalls[1].response_format);

r = await ask(env({ AI: { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } } }));
check('Workers AI out of free allocation → 429 with all three tried', r.status === 429 && r.json.fellBack.map((f) => f.provider).join() === 'gemini,groq,cloudflare');

script = { gemini: err(429, 'quota'), groq: groqOk }; cfCalls = [];
r = await ask(env({ AI: fakeAI(cfOk) }), photo);
check('photo never goes to Workers AI', r.status === 429 && cfCalls.length === 0);

script = { gemini: err(503, 'x'), groq: err(503, 'x') }; cfCalls = [];
r = await ask(env({ AI: fakeAI(cfOk) }), { ai: 'gemini' });
check('"Gemini only" setting is respected', r.status === 503 && cfCalls.length === 0);

script = {}; cfCalls = [];
r = await ask(env({ GEMINI_API_KEY: undefined, GROQ_API_KEY: undefined, AI: fakeAI(cfOk) }));
check('only the AI binding set → still answers', r.json.provider === 'cloudflare');

const g2 = await (await W.fetch(new Request('https://w/'), env({ AI: fakeAI(cfOk) }))).json();
check('GET / lists Workers AI when bound', g2.ai.join() === 'gemini,groq,cloudflare');
check('wrangler.toml binds Workers AI as AI', /\[ai\]\s*\nbinding = "AI"/.test(fs.readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8')));

// Version in the file matches what GET / reports (bump reminder).
const ver = Number(fs.readFileSync(WORKER_PATH, 'utf8').match(/WORKER_VERSION = (\d+)/)[1]);
check('WORKER_VERSION reported', gj.version === ver);

done();
