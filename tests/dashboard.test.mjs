// 📊 Dashboard: the data behind each chart (calendar, XP, vocabulary, IELTS, mistakes), the
// range buckets, and the page wiring. Run: node tests/dashboard.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const B = await import('../js/engine/dashboard.js');
const L = await import('../js/engine/levels.js');
const { test, done } = suite('dashboard');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NOW = new Date(2026, 10, 6, 15, 0).getTime();          // Friday 6 Nov 2026, 15:00
const at = (d, hr = 10) => new Date(2026, 10, d, hr).getTime();

await test('day level from active minutes', async () => {
  assert.equal(B.dayLevel(undefined), 0);
  assert.equal(B.dayLevel({ secs: 30 }), 0);
  assert.equal(B.dayLevel({ secs: 30, msgs: 1 }), 1, 'messages count even under a minute');
  assert.equal(B.dayLevel({ secs: 9 * 60 }), 1);
  assert.equal(B.dayLevel({ secs: 10 * 60 }), 2);
  assert.equal(B.dayLevel({ secs: 25 * 60 }), 3);
  assert.equal(B.dayLevel({ secs: 45 * 60 }), 4);
});

await test('calendar: 12 Monday-first weeks ending this week; future days marked', async () => {
  const cols = B.heatmap({ '2026-11-06': { secs: 1500, msgs: 4 }, '2026-11-02': { reviews: 3 } }, NOW, 12);
  assert.equal(cols.length, 12);
  assert.ok(cols.every((c) => c.length === 7));
  const last = cols[11];
  assert.equal(last[0].key, '2026-11-02', 'the last column starts on Monday');
  assert.equal(last[0].level, 1);
  assert.equal(last[4].key, '2026-11-06');
  assert.deepEqual([last[4].level, last[4].mins, last[4].msgs], [3, 25, 4]);
  assert.ok(last[5].future && last[6].future && !last[4].future);
  assert.equal(cols[0][0].key, '2026-08-17');
});

await test('buckets: by day for 7 and 30, by week for 90, ending today', async () => {
  const d7 = B.buckets(7, NOW);
  assert.equal(d7.size, 1); assert.equal(d7.list.length, 7);
  assert.deepEqual(d7.list[6].keys, ['2026-11-06']);
  assert.deepEqual(d7.list[0].keys, ['2026-10-31']);
  const d90 = B.buckets(90, NOW);
  assert.equal(d90.size, 7); assert.equal(d90.list.length, 13);
  assert.equal(d90.list[12].keys[6], '2026-11-06');
  assert.equal(d90.list[12].keys[0], '2026-10-31');
});

await test('XP series uses the XP worked out per day by the Lv. system', async () => {
  const days = { '2026-11-05': { secs: 600, msgs: 2 }, '2026-11-06': { secs: 1200 } };
  const { perDay, xp } = L.totalXp(days);
  assert.equal(Object.values(perDay).reduce((a, b) => a + b, 0), xp);
  const s = B.xpSeries(perDay, 7, NOW);
  assert.equal(s.points.length, 7);
  assert.equal(s.points[5].value, perDay['2026-11-05']);
  assert.equal(s.points[6].value, perDay['2026-11-06']);
  const w = B.xpSeries(perDay, 90, NOW);
  assert.equal(w.points[12].value, xp, 'both days fall in the last week');
});

await test('vocabulary: words in the bank at the end of each day', async () => {
  const vocab = [{ t: at(1) }, { t: at(5) }, { t: at(5, 20) }, { t: at(6) }, { t: at(7) }];
  const s = B.vocabGrowth(vocab, 7, NOW);
  assert.deepEqual(s.points.map((p) => p.value), [0, 1, 1, 1, 1, 3, 4], 'a word added tomorrow is not counted');
});

await test('IELTS: bands for Speaking/Writing, percent for Reading/Listening, only in range', async () => {
  const ielts = [
    { t: at(5), kind: 'speaking', overall: 6 }, { t: at(6), kind: 'speaking', overall: 6.5 }, { t: at(6), kind: 'speaking' },
    { t: at(4), kind: 'writing', overall: 5.5 }, { t: at(3), kind: 'reading', score: 5, total: 7 }, { t: at(2), kind: 'listening', score: 0, total: 0 },
    { t: new Date(2026, 8, 1).getTime(), kind: 'speaking', overall: 4 },
  ];
  const s = B.ieltsSeries(ielts, 30, NOW);
  assert.deepEqual(s.speaking.map((p) => p.value), [6, 6.5], 'no band → not drawn; old one out of range');
  assert.deepEqual(s.writing.map((p) => p.value), [5.5]);
  assert.deepEqual(s.reading[0], { t: at(3), value: 71, score: 5, total: 7 });
  assert.deepEqual(s.listening, [], 'a set with no questions is skipped');
});

await test('mistakes: this range against the same length before it', async () => {
  const m = (d, category) => ({ t: at(d), category });
  const list = [m(6, 'tense'), m(5, 'tense'), m(4, 'article'), m(1, 'tense'), { t: new Date(2026, 9, 28).getTime(), category: 'tense' }, { t: new Date(2026, 9, 26).getTime(), category: 'article' }, { t: new Date(2026, 9, 26).getTime(), category: 'article' }];
  const r = B.mistakeTrend(list, 7, NOW);
  assert.deepEqual(r.rows, [{ category: 'tense', now: 3, before: 1 }, { category: 'article', now: 1, before: 2 }]);
  assert.equal(r.total, 4); assert.equal(r.totalBefore, 3);
  assert.deepEqual(B.mistakeTrend([], 30, NOW).rows, []);
});

await test('range totals and nice axis maximum', async () => {
  const days = { '2026-11-06': { secs: 600, msgs: 3, reviews: 2 }, '2026-11-01': { secs: 30 }, '2026-10-01': { secs: 9999 } };
  const t = B.rangeTotals(days, { '2026-11-06': 40 }, 7, NOW);
  assert.deepEqual(t, { secs: 630, msgs: 3, reviews: 2, active: 1, xp: 40, days: 7 });
  assert.deepEqual([0, 1, 7, 13, 45, 120, 999].map(B.niceMax), [1, 1, 10, 20, 50, 200, 1000]);
});

await test('wiring: route, links, offline files; no AI; tooltips and table views', async () => {
  const main = src('js/main.js'), html = src('index.html'), sw = src('sw.js'), view = src('js/views/dashboard.js');
  assert.match(main, /dashboard: \{ el: 'view-dashboard', render: \(\) => renderDashboard\(\$\('dashboardBody'\)\)/);
  assert.match(html, /id="view-dashboard"[^>]*><div class="scroll"><div class="wrap" id="dashboardBody">/);
  for (const f of ['js/engine/dashboard.js', 'js/views/dashboard.js']) assert.ok(sw.includes(`'${f}'`), f);
  assert.match(src('js/views/home.js'), /href: '#dashboard'/);
  assert.match(src('js/views/me.js'), /href: '#dashboard'/);
  assert.ok(!/from '\.\.\/ai\.js'/.test(view), 'the dashboard never calls the AI');
  assert.match(view, /function tableView\(/);
  assert.ok((view.match(/tableView\(\[/g) || []).length >= 5, 'every chart has a table view');
  assert.match(view, /addEventListener\('focus', \(e\) => showTip/);
  assert.ok(!/stroke-dasharray|yAxis2|secondAxis/.test(view), 'one axis per chart');
});

done();
