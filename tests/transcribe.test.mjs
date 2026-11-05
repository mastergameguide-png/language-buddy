// IELTS Writing essay photos: the transcription prompt, file checks, reply parsing, the request
// sent to the Worker, the photo counter, and that no photo is ever saved. Run: node tests/transcribe.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
globalThis.window = { addEventListener() {} };

const I = await import('../js/engine/ielts.js');
const { test, done } = suite('transcribe');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

await test('prompt: copy exactly, no fixes, [?] for unreadable words, JSON with no_text', async () => {
  const p = I.TRANSCRIBE_PROMPT;
  for (const must of [/ONLY what is written, exactly as written/, /Do NOT fix grammar/, /Keep every mistake/, /Do NOT add, remove/, /Do NOT interpret/, /\[\?\]/, /"no_text": true/]) {
    assert.match(p, must);
  }
});

await test('files: up to 3 images; PDF, other files and a 4th page are refused in Thai', async () => {
  const img = (n = 'a.jpg', type = 'image/jpeg', size = 1000) => ({ name: n, type, size });
  assert.equal(I.ESSAY_PHOTO_MAX, 3);
  assert.equal(I.checkEssayFiles([img(), img(), img()]).files.length, 3);
  assert.match(I.checkEssayFiles([img(), img(), img(), img()]).error, /สูงสุด 3 ภาพ/);
  assert.equal(I.checkEssayFiles([img('essay.pdf', 'application/pdf')]).error, I.PDF_MESSAGE);
  assert.equal(I.checkEssayFiles([img('essay.PDF', '')]).error, I.PDF_MESSAGE);
  assert.match(I.PDF_MESSAGE, /PNG\/JPG/);
  assert.match(I.checkEssayFiles([img('notes.txt', 'text/plain')]).error, /เฉพาะไฟล์ภาพ/);
  assert.match(I.checkEssayFiles([img('big.jpg', 'image/jpeg', 40 * 1024 * 1024)]).error, /ใหญ่เกินไป/);
  assert.equal(I.checkEssayFiles([]).error, '');
});

await test('parse: JSON text kept as written, mistakes untouched', async () => {
  const r = I.parseTranscript('{"text": "I very like my city.\\n\\n\\n\\nIt have many park.", "no_text": false}');
  assert.equal(r.text, 'I very like my city.\n\nIt have many park.');
  assert.equal(r.unclear, 0);
  assert.equal(r.blurry, false);
  assert.equal(I.parseTranscript('```json\n{"text":"Hello world"}\n```').text, 'Hello world');
  assert.equal(I.parseTranscript('Plain text reply').text, 'Plain text reply');
});

await test('parse: no text and many [?] are reported', async () => {
  assert.deepEqual(I.parseTranscript('{"text":"","no_text":true}'), { empty: true });
  assert.deepEqual(I.parseTranscript('{"text":"   "}'), { empty: true });
  assert.deepEqual(I.parseTranscript(''), { empty: true });
  const blur = I.parseTranscript('{"text":"The [?] is [?] and [?] people [?] it."}');
  assert.equal(blur.unclear, 4);
  assert.equal(blur.blurry, true);
  const ok = I.parseTranscript('{"text":"Many people believe that public transport should be free for everyone, but I [?] disagree with this idea."}');
  assert.equal(ok.unclear, 1);
  assert.equal(ok.blurry, false);
});

await test('pages join in order and empty pages are skipped', async () => {
  assert.equal(I.joinPages([{ text: 'Page one.' }, { empty: true }, { text: 'Page three.' }]), 'Page one.\n\nPage three.');
  assert.equal(I.joinPages([{ empty: true }]), '');
});

await test('request: one photo per call, goes as inlineData, counted once in usage.photos, nothing saved', async () => {
  const S = await import('../js/store.js');
  S.setSettings({ ...S.settings, workerUrl: 'https://worker.test' });
  const AI = await import('../js/ai.js');
  const sent = [];
  globalThis.fetch = async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    return { ok: true, status: 200, json: async () => ({ text: '{"text":"I goes to school.","no_text":false}', provider: 'gemini', usage: { total: 300 } }) };
  };
  const before = AI.todayUsage().photos;
  const photo = { dataUrl: 'data:image/jpeg;base64,QUJD', mimeType: 'image/jpeg', data: 'QUJD' };
  const out = await AI.askTranscribe(I.TRANSCRIBE_PROMPT, photo);
  assert.equal(I.parseTranscript(out).text, 'I goes to school.');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].system, I.TRANSCRIBE_PROMPT);
  assert.equal(sent[0].contents.length, 1);
  assert.deepEqual(sent[0].contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  assert.equal(AI.todayUsage().photos, before + 1);
  for (const [k, v] of mem) assert.ok(!v.includes('QUJD'), `photo data found in localStorage key ${k}`);
});

await test('code: one shared resize helper, photos never stored by the Writing page', async () => {
  const chat = src('js/views/chat.js'), learn = src('js/views/learn.js'), util = src('js/util.js');
  assert.match(util, /export async function preparePhoto\(/);
  assert.ok(!/toDataURL|createElement\('canvas'\)/.test(chat), 'chat.js still has its own resize code');
  assert.ok(!/toDataURL|createElement\('canvas'\)/.test(learn), 'learn.js has its own resize code');
  assert.match(chat, /preparePhoto\(file\)/);
  assert.match(learn, /preparePhoto\(file, \{ maxSide: ESSAY_PHOTO_SIDE \}\)/);
  // the photo stays a local variable: never put on wr, state, settings or storage
  assert.ok(!/(wr|state|settings)\.\w*photo/i.test(learn), 'a photo is kept on app state');
  assert.ok(!/photoData/.test(learn));
  assert.match(learn, /accept: 'image\/\*', multiple: true/);
  assert.match(learn, /'aria-label': `แนบภาพเรียงความ/);
  assert.match(learn, /TRANSCRIBE_NOTE/);
  assert.equal(I.TRANSCRIBE_NOTE, 'ถอดจากภาพแล้ว กรุณาตรวจคำที่มี [?] และคำที่อ่านผิดก่อนส่งตรวจ');
});

await test('scoring is unchanged: transcription never calls the Writing feedback by itself', async () => {
  const learn = src('js/views/learn.js');
  const fn = learn.slice(learn.indexOf('async function attachEssayPhotos'), learn.indexOf('// ---------- listening'));
  assert.ok(fn.length > 100);
  assert.ok(!/getFeedback|askIelts|saveAttempt/.test(fn));
});

await test('a timed-out page is retried once; quota, offline and size errors are not', async () => {
  const learn = src('js/views/learn.js'), ai = src('js/ai.js');
  const re = new RegExp(learn.match(/const AI_TIMEOUT = \/(.+)\/;/)[1]);
  const msgs = (pattern) => [...ai.matchAll(new RegExp(`AIError\\('([^']*${pattern}[^']*)'`, 'g'))].map((m) => m[1]);
  const timeouts = [...msgs('ช้าเกินไป'), ...msgs('นานเกินไป')];
  assert.equal(timeouts.length, 2, 'ai.js timeout messages changed');
  for (const m of timeouts) assert.ok(re.test(m), m);
  for (const m of [...msgs('โควตา'), ...msgs('อินเทอร์เน็ต'), ...msgs('รูปใหญ่'), ...msgs('ถี่เกินไป')]) assert.ok(!re.test(m), `retried by mistake: ${m}`);
  const fn = learn.slice(learn.indexOf('async function transcribePage'), learn.indexOf('async function attachEssayPhotos'));
  assert.equal((fn.match(/askTranscribe\(/g) || []).length, 2, 'exactly one retry');
});

done();
