// 👮 RPCA-TEP practice: the question bank (four parts, B1–B2, about 40% policing), error
// identification, set building, scoring, saving, and wiring. Run: node tests/tep.test.mjs
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
  { t: 1000, kind: 'tep', part: 'grammar', id: 'grammar', score: 7, total: 10 },
  { t: 2000, kind: 'tep', part: 'nonsense', score: 3, total: 9 },
] }));

const T = await import('../js/engine/tep.js');
const S = await import('../js/store.js');
const C = await import('../js/engine/courses.js');
const B = await import('../js/engine/dashboard.js');
const { test, done } = suite('tep');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const all = (part) => T.BANK[part].flatMap((u) => (u.qs ? u.qs : [u]));

await test('structure follows the real test; pass marks from the official site', async () => {
  assert.deepEqual(T.PARTS.map((p) => [p.id, p.real]), [['listening', 40], ['grammar', 20], ['vocab', 20], ['reading', 40]]);
  assert.equal(T.PARTS.reduce((s, p) => s + p.real, 0), 120);
  assert.equal(T.PASS_BACHELOR, 60); assert.equal(T.PASS_MASTER, 65);
  assert.equal(T.POLICE_SHARE, 0.4);
});

await test('bank: enough questions, about 40% policing in every part, all item types present', async () => {
  for (const p of T.PARTS) {
    assert.ok(T.bankSize(p.id) >= 18, `${p.id}: ${T.bankSize(p.id)}`);
    const share = T.policeShareOf(p.id);
    assert.ok(share >= 0.35 && share <= 0.55, `${p.id}: police share ${share}`);
  }
  const types = (part) => new Set(T.BANK[part].map((u) => u.type));
  assert.deepEqual([...types('listening')].sort(), ['long', 'short', 'talk']);
  assert.deepEqual([...types('grammar')].sort(), ['complete', 'error']);
  assert.deepEqual([...types('vocab')].sort(), ['cloze', 'context']);
  assert.deepEqual([...types('reading')].sort(), ['long', 'short']);
});

await test('every question: 4 different options, a valid answer and a Thai explanation', async () => {
  for (const part of ['listening', 'vocab', 'reading']) {
    for (const q of all(part)) {
      assert.equal(q.options.length, 4, q.q);
      assert.equal(new Set(q.options).size, 4, `repeated option: ${q.q}`);
      assert.ok(q.answer >= 0 && q.answer < 4, q.q);
      assert.ok(/[฀-๿]/.test(q.why), `no Thai explanation: ${q.q}`);
    }
  }
  for (const u of T.BANK.grammar) {
    if (u.type === 'complete') { assert.equal(u.options.length, 4); assert.ok(/[฀-๿]/.test(u.why)); continue; }
    const { marks, pieces } = T.errorParts(u.s);
    assert.equal(marks.length, 4, `error item needs 4 underlined parts: ${u.s}`);
    assert.equal(pieces.length, 5);
    assert.ok(u.answer >= 0 && u.answer < 4 && u.fix && u.fix !== marks[u.answer], u.s);
    assert.ok(/[฀-๿]/.test(u.why), u.s);
  }
  for (const u of T.BANK.reading.filter((x) => x.type === 'long')) {
    assert.ok(u.text.split(/\s+/).length >= 250, `${u.title}: long passage too short`);
    const kinds = u.qs.map((q) => q.q).join(' ');
    assert.match(kinds, /main idea/i); assert.match(kinds, /closest in meaning/i); assert.match(kinds, /inferred|might/i); assert.match(kinds, /attitude|tone/i);
    for (const q of u.qs) {
      const m = q.q.match(/"(\w+)" in paragraph (\d)/);
      if (m) assert.ok(u.text.split('\n\n')[Number(m[2]) - 1].includes(m[1]), `${u.title}: "${m[1]}" is not in paragraph ${m[2]}`);
    }
  }
  for (const u of T.BANK.listening) assert.ok(u.script.every(([who, t]) => ['M', 'W'].includes(who) && t.length > 10));
});

await test('error identification: the wrong part is spread over A–D (no "always B" pattern)', async () => {
  const at = [0, 0, 0, 0];
  for (const u of T.BANK.grammar) if (u.type === 'error') at[u.answer] += 1;
  assert.ok(at.every((n) => n >= 3), `A–D: ${at.join(' ')}`);
});

await test('error identification: pieces and marks rebuild the sentence', async () => {
  const s = 'The children {was} {excited} {to visit} the museum {for} the first time.';
  const { pieces, marks } = T.errorParts(s);
  assert.deepEqual(marks, ['was', 'excited', 'to visit', 'for']);
  assert.equal(pieces.map((p, i) => p + (marks[i] ?? '')).join(''), 'The children was excited to visit the museum for the first time.');
});

await test('sets: about 10 questions, about 40% policing, answers follow shuffled options', async () => {
  for (const p of T.PARTS) {
    let police = 0, count = 0;
    for (let i = 0; i < 60; i++) {
      const set = T.buildSet(p.id, i / 60 + 0.005);
      const qs = T.setQuestions(set);
      assert.ok(qs.length >= 8 && qs.length <= T.SET_SIZE, `${p.id}: ${qs.length}`);
      assert.deepEqual(qs.map((q) => q.n), qs.map((_, k) => k + 1));
      count += qs.length; police += qs.filter((q) => q.police).length;
      for (const g of set) {
        if (g.unit.type === 'error') { assert.equal(g.questions[0].answer, g.unit.answer, 'error items keep A–D in sentence order'); continue; }
        const orig = g.unit.qs || [g.unit];
        g.questions.forEach((q, k) => assert.equal(q.options[q.answer], orig[k].options[orig[k].answer]));
      }
    }
    const share = police / count;
    assert.ok(share >= 0.33 && share <= 0.5, `${p.id}: police share in sets ${share.toFixed(2)}`);
  }
  assert.deepEqual(T.buildSet('vocab', 0.3), T.buildSet('vocab', 0.3), 'same seed, same set');
});

await test('scoring counts unanswered as wrong', async () => {
  const set = T.buildSet('grammar', 0.42);
  const qs = T.setQuestions(set);
  const right = Object.fromEntries(qs.map((q, i) => [i, String(q.answer)]));
  assert.deepEqual(T.scoreSet(set, right), { score: qs.length, total: qs.length });
  assert.equal(T.scoreSet(set, {}).score, 0);
});

await test('saved attempts keep the part; bad parts fall back; dashboard and course read them', async () => {
  const tep = S.state.ielts.filter((a) => a.kind === 'tep');
  assert.deepEqual(tep[0], { t: 1000, kind: 'tep', id: 'grammar', part: 'grammar', score: 7, total: 10 });
  assert.equal(tep[1].part, 'reading');
  const now = 1000 + 86400000;
  const s = B.tepSeries(tep, 7, now);
  assert.equal(s.points.length, 2);
  assert.deepEqual(s.byPart.grammar, { sets: 1, score: 7, total: 10, pct: 70 });
  const cadet = C.courseById('cadet');
  const steps = cadet.steps.filter((x) => x.kind === 'tep');
  assert.deepEqual(steps.map((x) => x.part), ['listening', 'grammar']);
  assert.equal(C.stepDone(steps[1], { start: 500, ielts: tep }), true);
  assert.equal(C.stepDone(steps[0], { start: 500, ielts: tep }), false);
});

await test('wiring: own page with practice tabs, offline files, no AI', async () => {
  const main = src('js/main.js'), html = src('index.html'), sw = src('sw.js'), view = src('js/views/tep.js');
  assert.match(main, /tep: \{ el: 'view-tep', render: \(\) => renderTep\(\$\('tepBody'\)\), nav: 'practice' \}/);
  assert.match(html, /id="view-tep"[\s\S]*?id="tepBody"/);
  assert.equal((html.match(/<a href="#tep" data-p="tep">👮 TEP<\/a>/g) || []).length, 4, 'TEP tab on every practice page');
  for (const f of ['js/engine/tep.js', 'js/views/tep.js']) assert.ok(sw.includes(`'${f}'`), f);
  assert.ok(!/from '\.\.\/ai\.js'/.test(view));
  assert.match(src('js/views/learn.js'), /step\.kind === 'tep'\) openTep\(step\.part\)/);
});

done();
