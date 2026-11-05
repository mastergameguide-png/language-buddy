// Lv. system: XP from measured stats (with daily caps and a streak bonus), the Lv. curve, gates
// every 5 Lv., the offline gate tests, saving and syncing. Run: node tests/levels.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const L = await import('../js/engine/levels.js');
const G = await import('../js/engine/gates.js');
const { test, done } = suite('levels');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

await test('XP per day: each kind is capped; bonus only on a day with practice', async () => {
  const { xp, by } = L.totalXp({ '2026-11-01': { secs: 20 * 60, msgs: 10, reviews: 5, shadow: 2, listen: 1 } });
  assert.equal(by.mins, 20); assert.equal(by.msgs, 20); assert.equal(by.reviews, 5); assert.equal(by.voice, 3);
  assert.equal(by.bonus, L.DAY_BONUS + L.STREAK_XP * 1);
  assert.equal(xp, 20 + 20 + 5 + 3 + 12);
  const big = L.totalXp({ '2026-11-01': { secs: 5 * 3600, msgs: 400, reviews: 900 } });
  assert.equal(big.by.mins, 60); assert.equal(big.by.msgs, 100); assert.equal(big.by.reviews, 50);
  assert.equal(L.totalXp({ '2026-11-01': { secs: 60 } }).xp, 1, 'one quiet minute is not a practice day');
  assert.equal(L.totalXp({}).xp, 0);
});

await test('streak bonus grows with days in a row (to 10) and resets after a gap', async () => {
  const days = {};
  for (let i = 1; i <= 12; i++) days[`2026-10-${String(i).padStart(2, '0')}`] = { msgs: 1 };
  days['2026-10-14'] = { msgs: 1 };   // gap on the 13th
  const r = L.totalXp(days);
  const streakPart = r.by.bonus - L.DAY_BONUS * 13;
  // 1+2+…+10, then 10 and 10 (capped), then 1 after the gap
  assert.equal(streakPart, L.STREAK_XP * (55 + 10 + 10 + 1));
  assert.equal(r.bestRow, 12);
  assert.equal(r.activeDays, 13);
  assert.equal(L.totalXp({ '2026-10-31': { msgs: 1 }, '2026-11-01': { msgs: 1 } }).bestRow, 2, 'across a month end');
});

await test('IELTS practice gives XP on its day (capped at 3 a day)', async () => {
  const t = new Date(2026, 10, 2, 10).getTime();
  const r = L.totalXp({}, [{ t }, { t: t + 1 }, { t: t + 2 }, { t: t + 3 }]);
  assert.equal(r.by.ielts, 45);
  assert.equal(r.activeDays, 1);
});

await test('Lv. curve', async () => {
  assert.equal(L.rawLevel(0), 1);
  assert.equal(L.rawLevel(99), 1);
  assert.equal(L.rawLevel(100), 2);
  assert.equal(L.xpToReach(5), 100 + 120 + 140 + 160);
  assert.equal(L.rawLevel(L.xpToReach(5)), 5);
});

await test('gates: Lv. stops at an unpassed gate; XP is kept; passing releases it', async () => {
  const xp = L.xpToReach(8) + 10;
  const blocked = L.levelInfo(xp, []);
  assert.equal(blocked.lv, 5); assert.equal(blocked.gate, 5); assert.ok(blocked.ready && blocked.blocked);
  assert.equal(blocked.banked, xp - L.xpToReach(5));
  assert.equal(blocked.tier, 'A2');
  const open = L.levelInfo(xp, [5]);
  assert.equal(open.lv, 8); assert.equal(open.gate, null); assert.equal(open.ready, false);
  const at = L.levelInfo(L.xpToReach(5), []);
  assert.equal(at.lv, 5); assert.ok(at.ready && !at.blocked);
  const two = L.levelInfo(L.xpToReach(13), [5]);
  assert.equal(two.lv, 10); assert.equal(two.tier, 'B1');
  assert.equal(L.levelInfo(xp, [], false).lv, 8, 'not English: no gates');
  assert.deepEqual([5, 10, 15, 20, 30].map(L.tierOf), ['A2', 'B1', 'B2', 'C1', 'C1']);
});

await test('tries a day, saving and merging two devices', async () => {
  const now = new Date(2026, 10, 6, 12).getTime();
  const tries = [{ t: now - 1000, gate: 5 }, { t: now - 2000, gate: 5 }, { t: now - 86400000 * 2, gate: 5 }, { t: now, gate: 10 }];
  assert.equal(L.triesToday(tries, 5, now), 2);
  const c = L.cleanLevels({ passed: [5, '10', 7, -5, 5], tries: [{ t: 1, gate: 5, score: 99, total: 12 }, null, { gate: 5 }] });
  assert.deepEqual(c.passed, [5, 10]);
  assert.deepEqual(c.tries, [{ t: 1, gate: 5, score: 12, total: 12 }]);
  const m = L.mergeLevels({ passed: [5], tries: [{ t: 1, gate: 5, score: 8, total: 12 }] }, { passed: [10], tries: [{ t: 1, gate: 5, score: 8, total: 12 }, { t: 2, gate: 10, score: 11, total: 12 }] });
  assert.deepEqual(m.passed, [5, 10]);
  assert.equal(m.tries.length, 2);
  assert.deepEqual(L.cleanLevels(null), { passed: [], tries: [] });
});

await test('question bank: every tier is complete, answers valid, no repeated options', async () => {
  for (const tier of ['A2', 'B1', 'B2', 'C1']) {
    const b = G.BANK[tier];
    assert.ok(b.vocab.length >= 6 && b.grammar.length >= 6 && b.reading.length >= 2 && b.listening.length >= 4, tier);
    const all = [...b.vocab, ...b.grammar, ...b.reading.flatMap((r) => r.qs), ...b.listening];
    for (const q of all) {
      assert.ok(q.options.length >= 3 && q.answer >= 0 && q.answer < q.options.length, `${tier}: ${q.q}`);
      assert.equal(new Set(q.options).size, q.options.length, `${tier}: repeated option in ${q.q}`);
    }
    for (const q of [...b.vocab, ...b.grammar]) assert.ok(q.q.includes('___'), `${tier}: ${q.q}`);
    for (const r of b.reading) assert.ok(r.text.split(/\s+/).length >= 30 && r.qs.length >= 2);
    for (const q of b.listening) assert.ok(q.say.length > 20);
  }
});

await test('a gate test: 12 questions in section order; options shuffled but the answer follows', async () => {
  const bankOf = (tier) => { const b = G.BANK[tier]; return [...b.vocab, ...b.grammar, ...b.reading.flatMap((r) => r.qs), ...b.listening]; };
  for (const seed of [0.1, 0.5, 0.93]) {
    const t = G.buildGate('B1', seed);
    assert.equal(t.length, 12);
    assert.deepEqual(t.map((q) => q.section), ['vocab', 'vocab', 'vocab', 'vocab', 'grammar', 'grammar', 'grammar', 'grammar', 'reading', 'reading', 'listening', 'listening']);
    assert.equal(new Set(t.map((q) => q.q)).size, 12, 'no repeated question');
    for (const q of t) {
      const orig = bankOf('B1').find((o) => o.q === q.q);
      assert.equal(q.options[q.answer], orig.options[orig.answer], q.q);
    }
    assert.equal(t[8].text, t[9].text, 'both reading questions use one passage');
  }
  assert.deepEqual(G.buildGate('A2', 0.3), G.buildGate('A2', 0.3), 'same seed, same test');
  const places = new Set(Array.from({ length: 20 }, (_, i) => G.buildGate('C1', i / 20 + 0.01)).flatMap((t) => t.map((q) => q.answer)));
  assert.ok(places.size >= 3, 'the right answer is not always in the same place');
});

await test('scoring: all right, all wrong, unanswered counts as wrong', async () => {
  const t = G.buildGate('B2', 0.4);
  const right = Object.fromEntries(t.map((q, i) => [i, String(q.answer)]));
  assert.equal(G.scoreGate(t, right).score, 12);
  assert.deepEqual(G.scoreGate(t, right).by.listening, { score: 2, total: 2 });
  const wrong = Object.fromEntries(t.map((q, i) => [i, String((q.answer + 1) % q.options.length)]));
  assert.equal(G.scoreGate(t, wrong).score, 0);
  assert.equal(G.scoreGate(t, {}).score, 0);
  assert.ok(L.PASS >= 9 && L.PASS <= 12);
});

await test('wiring: page, route, offline files, saved and synced', async () => {
  const main = src('js/main.js'), sw = src('sw.js'), store = src('js/store.js'), sync = src('js/sync.js'), home = src('js/views/home.js'), html = src('index.html');
  assert.match(main, /levels: \{ el: 'view-levels', render: \(\) => renderLevels\(\$\('levelsBody'\)\)/);
  assert.match(html, /id="view-levels"[^>]*><div class="scroll"><div class="wrap" id="levelsBody">/);
  for (const f of ['js/engine/levels.js', 'js/engine/gates.js', 'js/views/levels.js']) assert.ok(sw.includes(`'${f}'`), f);
  assert.match(store, /s\.levels = cleanLevels\(s\.levels\)/);
  assert.match(sync, /add\('x:levels', state\.levels\)/);
  assert.match(sync, /state\.levels = mergeLevels\(state\.levels, v\)/);
  assert.match(home, /href: '#levels'/);
  const page = src('js/views/levels.js');
  assert.ok(!/askIelts|callWorker|from '\.\.\/ai\.js'/.test(page), 'gate tests must not use AI');
  assert.match(page, /TRIES_PER_DAY - tries/);
});

done();
