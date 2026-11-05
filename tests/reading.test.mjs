// IELTS Reading practice, the work-and-English content, the cadet course, the countdown and the
// overall band calculator. Run: node tests/reading.test.mjs
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
mem.set('lb_state', JSON.stringify({ ielts: [
  { t: 1000, kind: 'reading', id: 'mission', score: 5, total: 7 },
  { t: 2000, kind: 'reading', id: 'trees', score: 9, total: 7 },
  { t: 3000, kind: 'nonsense', id: 'x' },
] }));

const R = await import('../js/engine/reading.js');
const I = await import('../js/engine/ielts.js');
const C = await import('../js/engine/courses.js');
const S = await import('../js/store.js');
const { test, done } = suite('reading');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const low = (s) => s.toLowerCase();

await test('passages are complete, original and well formed', async () => {
  assert.ok(R.READING.length >= 4);
  assert.equal(new Set(R.READING.map((r) => r.id)).size, R.READING.length);
  assert.ok(R.READING.filter((r) => r.theme === 'police').length >= 2, 'police-themed passages');
  for (const r of R.READING) {
    assert.ok(r.paragraphs.length >= 3 && r.paragraphs.join(' ').split(/\s+/).length >= 250, `${r.id}: too short`);
    assert.ok(r.questions.length >= 6 && r.minutes > 0, r.id);
    const types = new Set(r.questions.map((q) => q.type));
    for (const t of ['tfng', 'gap', 'mc']) assert.ok(types.has(t), `${r.id}: no ${t}`);
    assert.ok(r.questions.some((q) => q.answer === 'NG'), `${r.id}: needs a NOT GIVEN`);
  }
});

await test('every answer is valid; gap answers are in the passage and within the word limit', async () => {
  for (const r of R.READING) {
    const text = low(r.paragraphs.join(' '));
    for (const q of r.questions) {
      if (q.type === 'tfng') assert.ok(['T', 'F', 'NG'].includes(q.answer), q.q);
      if (q.type === 'mc') assert.ok(q.answer >= 0 && q.answer < q.options.length, q.q);
      if (q.type === 'gap') {
        assert.ok(q.q.includes('___') && q.max >= 1, q.q);
        for (const a of [q.answer, ...(q.accept || [])]) assert.ok(R.withinLimit(a, q.max), `${r.id}: "${a}" is over the limit`);
        assert.ok(text.includes(low(q.answer)), `${r.id}: "${q.answer}" is not in the passage`);
        assert.ok(R.checkReading(q, q.answer), q.q);
      }
    }
    assert.equal(R.scoreReading(r, r.questions.map((q) => (q.type === 'mc' ? String(q.answer) : q.answer))), r.questions.length, r.id);
  }
});

await test('word limit: "NO MORE THAN TWO WORDS AND/OR A NUMBER"', async () => {
  assert.equal(R.withinLimit('key information', 2), true);
  assert.equal(R.withinLimit('the key information', 2), false);
  assert.equal(R.withinLimit('3 years', 2), true);
  assert.equal(R.withinLimit('12 June 2026', 2), false, 'two numbers');
  assert.equal(R.withinLimit('', 2), true);
  const q = R.readingById('mission').questions.find((x) => x.type === 'gap');
  assert.equal(R.checkReading(q, 'Key Information'), true, 'case does not matter');
  assert.equal(R.checkReading(q, 'the key information'), false, 'over the limit is wrong, as in the real test');
});

await test('checking: TRUE/FALSE/NOT GIVEN, multiple choice and number answers', async () => {
  const shifts = R.readingById('shifts');
  const tf = shifts.questions.find((q) => q.type === 'tfng' && q.answer === 'NG');
  assert.equal(R.checkReading(tf, 'ng'), true);
  assert.equal(R.checkReading(tf, 'F'), false);
  assert.equal(R.checkReading(tf, undefined), false);
  const four = shifts.questions.find((q) => q.answer === 'four');
  assert.equal(R.checkReading(four, '4'), true);
  const mc = shifts.questions.find((q) => q.type === 'mc');
  assert.equal(R.checkReading(mc, String(mc.answer)), true);
  assert.equal(R.answerText(tf), 'NOT GIVEN');
});

await test('work-and-English content: Speaking Part 1, Part 2 card, two Task 2 essays', async () => {
  assert.ok(I.PART1.find((t) => t.id === 'career').qs.length >= 4);
  const card = I.CUE_CARDS.find((c) => c.id === 'safety');
  assert.ok(card && card.points.length === 4 && card.part3.length >= 3 && /^Describe /.test(card.title));
  for (const id of ['english_public', 'cameras']) assert.ok(I.TASK2.find((t) => t.id === id).prompt.length > 80, id);
  assert.equal(new Set(I.TASK2.map((t) => t.id)).size, I.TASK2.length);
});

await test('cadet course: police scenarios, police passages, ticks reading by passage', async () => {
  const c = C.courseById('cadet');
  assert.ok(c && c.englishOnly);
  const reading = c.steps.filter((s) => s.kind === 'reading');
  assert.deepEqual(reading.map((s) => s.id), ['mission', 'cameras']);
  for (const s of reading) assert.ok(R.readingById(s.id), s.id);
  const start = 100;
  const step = reading[0];
  assert.equal(C.stepDone(step, { start, ielts: [{ kind: 'reading', id: 'trees', t: 200 }] }), false, 'another passage does not count');
  assert.equal(C.stepDone(step, { start, ielts: [{ kind: 'reading', id: 'mission', t: 50 }] }), false, 'before the start does not count');
  assert.equal(C.stepDone(step, { start, ielts: [{ kind: 'reading', id: 'mission', t: 200 }] }), true);
  for (const s of c.steps.filter((x) => x.type === 'scenario')) assert.ok(['police', 'emergency'].includes(s.id));
});

await test('reading attempts are kept (raw score only); bad kinds are dropped', async () => {
  const r = S.state.ielts;
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { t: 1000, kind: 'reading', id: 'mission', score: 5, total: 7 });
  assert.equal(r[1].total, 9, 'total is never below the score');
  assert.ok(!('overall' in r[0]), 'no band for a short reading set');
});

await test('overall band: average of four skills, rounded to the nearest half', async () => {
  assert.equal(I.overallBand({ listening: 6.5, reading: 6.5, writing: 5, speaking: 7 }), 6.5);   // 6.25 → 6.5
  assert.equal(I.overallBand({ listening: 4, reading: 3.5, writing: 4, speaking: 4 }), 4);       // 3.875 → 4
  assert.equal(I.overallBand({ listening: 6, reading: 6, writing: 6, speaking: 6.5 }), 6);       // 6.125 → 6
  assert.equal(I.overallBand({ listening: 7, reading: 7.5, writing: 6, speaking: 6 }), 6.5);     // 6.625 → 6.5
});

await test('page wiring: Reading tab, countdowns, calculator, offline file', async () => {
  const learn = src('js/views/learn.js'), sw = src('sw.js');
  assert.match(learn, /\['reading', '📖 Reading'\]/);
  assert.match(learn, /countdownRow\(`w\$\{wr\.task\}`, wr\.task === 1 \? 20 : 40, root\)/);
  assert.match(learn, /countdownRow\(`r\$\{item\.id\}`, item\.minutes, root\)/);
  // the clock ticks by changing one element's text; the page is redrawn only when time is up
  const tick = learn.slice(learn.indexOf('id: setInterval(() => {\n        cd.left'), learn.indexOf("toast('หมดเวลาแล้ว"));
  assert.ok(tick.length > 20 && !/render\(/.test(tick), 'countdown redraws the page every second');
  assert.match(learn, /stopCountdown\(\);\n  if \(micOn\)/, 'leaving the page stops the countdown');
  assert.match(learn, /function bandCalculator\(\)/);
  assert.match(learn, /'aria-label': `band \$\{label\}`/);
  assert.ok(sw.includes("'js/engine/reading.js'"));
});

done();
