// Worker security: origin, access code, rate limit, size limits, upstream timeout fallback.
// Run: node tests/worker-security.test.mjs
import { loadWorker, suite } from './helpers.mjs';

const W = (await loadWorker()).__default;
const { check, done } = suite('worker security');
const keepAlive = setInterval(() => {}, 1000);   // AbortSignal.timeout does not hold Node open

let mode = 'ok';
globalThis.fetch = async (url, init) => {
  const who = String(url).includes('groq') ? 'groq' : 'gemini';
  if (mode === 'hang' && who === 'gemini') {
    return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'TimeoutError' }))));
  }
  return new Response(JSON.stringify(who === 'groq' ? { choices: [{ message: { content: '{"reply":"g"}' } }] } : { candidates: [{ content: { parts: [{ text: '{"reply":"m"}' }] } }] }), { status: 200 });
};
const base = { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'q', ALLOWED_ORIGIN: 'https://site' };
const body = (sys = 's', contents = [{ role: 'user', parts: [{ text: 'hi' }] }]) => JSON.stringify({ system: sys, contents });
const req = (headers = {}, b = body()) => new Request('https://w/', { method: 'POST', headers: { Origin: 'https://site', ...headers }, body: b });

let r = await W.fetch(req({ Origin: 'https://evil.example' }), base);
check('other website blocked', r.status === 403);
r = await W.fetch(req(), { ...base, ACCESS_CODE: 'secret123' });
check('access code required when set', r.status === 401);
r = await W.fetch(req({ 'X-Buddy-Key': 'nope' }), { ...base, ACCESS_CODE: 'secret123' });
check('wrong access code rejected', r.status === 401);
r = await W.fetch(req({ 'X-Buddy-Key': 'secret123' }), { ...base, ACCESS_CODE: 'secret123' });
check('right access code accepted', r.status === 200);
r = await W.fetch(req(), base);
check('no ACCESS_CODE set = open (current deployment)', r.status === 200);
const pre = await W.fetch(new Request('https://w/', { method: 'OPTIONS', headers: { Origin: 'https://site' } }), base);
check('CORS allows X-Buddy-Key', /X-Buddy-Key/.test(pre.headers.get('Access-Control-Allow-Headers')));

let n = 0;
const LIMITER = { limit: async () => ({ success: ++n <= 2 }) };
const a = await W.fetch(req(), { ...base, LIMITER }), b = await W.fetch(req(), { ...base, LIMITER }), c = await W.fetch(req(), { ...base, LIMITER });
check('rate limit: 3rd request blocked', a.status === 200 && b.status === 200 && c.status === 429, [a.status, b.status, c.status]);

r = await W.fetch(req({}, body('x'.repeat(25000))), base);
check('oversized system prompt rejected', r.status === 400);
r = await W.fetch(req({}, body('x'.repeat(20000))), base);
check('20k-char character prompt accepted', r.status === 200);
r = await W.fetch(req({}, body('s', Array.from({ length: 61 }, () => ({ role: 'user', parts: [{ text: 'x' }] })))), base);
check('more than 60 turns rejected', r.status === 400);
r = await W.fetch(req({}, 'not json'), base);
check('bad JSON rejected', r.status === 400);
r = await W.fetch(req({}, 'x'.repeat(1500001)), base);
check('oversized body rejected', r.status === 413);

mode = 'hang';
r = await W.fetch(req(), base);
const j = await r.json();
check('Gemini hang → times out and Groq answers', r.status === 200 && j.provider === 'groq' && j.fellBack[0].status === 504, j);
r = await W.fetch(req(), { ...base, GROQ_API_KEY: undefined });
check('Gemini hang, no Groq → 504', r.status === 504);

r = await W.fetch(new Request('https://w/push/run', { method: 'POST' }), { ...base, INTERNAL_KEY: 'k' });
check('/push/run needs the internal key', r.status === 403);

clearInterval(keepAlive);
done();
