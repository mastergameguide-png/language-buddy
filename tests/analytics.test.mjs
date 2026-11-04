// Phase 4 analytics: metric registry with sources and minimum samples, weekly report, weak spots,
// recommendations, history and the 7-day plan. Run: node tests/analytics.test.mjs
import assert from 'node:assert/strict';
import { suite } from './helpers.mjs';
import {
  dayRange, sumDays, confidenceOf, METRICS, computeMetrics, weeklyReport, weaknesses, recommendations, history,
} from '../js/engine/analytics.js';
import { makePlan, taskProgress, changeTarget, removeTask, addTask, cleanPlan, planCovers, TASK_KINDS, MAX_TASKS } from '../js/engine/plan.js';

const { test, done } = suite('analytics');
const NOW = new Date(2026, 10, 4, 15, 0).getTime();          // Wed 4 Nov 2026, local time
const at = (daysAgo, h = 10) => new Date(2026, 10, 4 - daysAgo, h).getTime();
const key = (daysAgo) => dayRange(NOW, 1, daysAgo)[0];

await test('day ranges are local calendar days, oldest first', async () => {
  assert.deepEqual(dayRange(NOW, 3), ['2026-11-02', '2026-11-03', '2026-11-04']);
  assert.deepEqual(dayRange(NOW, 2, 7), ['2026-10-27', '2026-10-28']);
  assert.equal(dayRange(new Date(2026, 2, 1, 12).getTime(), 2)[0], '2026-02-28');
});
await test('sums and active days', async () => {
  const t = sumDays({ [key(0)]: { msgs: 5, secs: 600 }, [key(1)]: { secs: 60 }, [key(2)]: { reviews: 3 } }, dayRange(NOW, 3));
  assert.equal(t.msgs, 5); assert.equal(t.secs, 660); assert.equal(t.activeDays, 2);
});
await test('every metric declares a source; rates have a minimum sample', async () => {
  for (const m of METRICS) {
    assert.ok(m.source && m.source.length > 10, m.id);
    if (m.kind === 'rate') assert.ok(m.minN >= 2, m.id);
  }
  assert.ok(METRICS.find((m) => m.id === 'heard').source.includes('ไม่ใช่คะแนนการออกเสียง'));
});
await test('confidence grows with the sample; too little data hides the value', async () => {
  assert.equal(confidenceOf(9, 10), 'none'); assert.equal(confidenceOf(10, 10), 'low');
  assert.equal(confidenceOf(30, 10), 'medium'); assert.equal(confidenceOf(100, 10), 'high');
  const few = computeMetrics({ days: { [key(0)]: { checked: 5, corrected: 1, msgs: 5 } } }, dayRange(NOW, 7));
  const acc = few.find((m) => m.id === 'accuracy');
  assert.equal(acc.value, null); assert.equal(acc.confidence, 'none'); assert.equal(acc.n, 5);
  const msgs = few.find((m) => m.id === 'messages');
  assert.equal(msgs.value, 5); assert.equal(msgs.confidence, 'exact');
});
await test('rates and averages are right when there is enough data', async () => {
  const data = {
    days: { [key(0)]: { checked: 20, corrected: 5, msgs: 20, hints: 4, reviewsGraded: 10, reviewForgot: 2, listen: 5, listenOk: 4, shadowWords: 40, shadowHeard: 30 } },
    results: [{ t: at(0), score: 8 }, { t: at(1), score: 6 }, { t: at(2), score: null }, { t: at(10), score: 2 }],
  };
  const m = Object.fromEntries(computeMetrics(data, dayRange(NOW, 7)).map((x) => [x.id, x]));
  assert.equal(m.accuracy.value, 75); assert.equal(m.recall.value, 80); assert.equal(m.hints.value, 20);
  assert.equal(m.listening.value, 80); assert.equal(m.heard.value, 75);
  assert.equal(m.scenarios.value, 3); assert.equal(m.scenarioScore.value, 7); assert.equal(m.scenarioScore.n, 2);
});
await test('weekly report compares with the week before and knows which way is good', async () => {
  const data = {
    days: { [key(1)]: { checked: 20, corrected: 2, msgs: 20, hints: 2 }, [key(8)]: { checked: 20, corrected: 8, msgs: 20, hints: 10 } },
    mistakes: [{ t: at(1), category: 'tense' }, { t: at(8), category: 'tense' }, { t: at(8), category: 'tense' }, { t: at(9), category: 'tense' }, { t: at(2), category: 'article' }, { t: at(3), category: 'article' }],
    labels: { tense: 'กาล', article: 'คำนำหน้า' },
  };
  const r = weeklyReport(data, NOW);
  const acc = r.metrics.find((m) => m.id === 'accuracy'), hints = r.metrics.find((m) => m.id === 'hints');
  assert.deepEqual([acc.prev, acc.value, acc.trend, acc.good], [60, 90, 'up', true]);
  assert.deepEqual([hints.prev, hints.value, hints.trend, hints.good], [50, 10, 'down', true]);   // fewer hints is good
  assert.deepEqual(r.categories.find((c) => c.category === 'tense'), { category: 'tense', now: 1, before: 3 });
  assert.ok(r.highlights.some((h) => h.includes('กาล') && h.includes('น้อยลง')));
  assert.ok(r.highlights.some((h) => h.startsWith('ดีขึ้น:')));
  assert.equal(r.from, key(6)); assert.equal(r.to, key(0));
});
await test('an empty week gives a friendly start line and no fake numbers', async () => {
  const r = weeklyReport({ days: {} }, NOW);
  assert.ok(r.highlights[0].includes('ยังไม่ได้เรียน'));
  assert.ok(r.metrics.filter((m) => m.kind === 'rate').every((m) => m.value === null));
});
await test('weak spots: repeated mistake type, forgotten cards, due pile, hint reliance', async () => {
  const card = (lapses, due = NOW + 1e9) => ({ srs: { lapses, due } });
  const data = {
    days: { [key(0)]: { msgs: 12, hints: 8 } },
    mistakes: [...Array(4)].map((_, i) => ({ t: at(i), category: 'tense', ...card(2) })),
    vocab: [...Array(10)].map(() => card(0, NOW - 1000)),
    labels: { tense: 'กาล' },
  };
  const w = weaknesses(data, NOW);
  const ids = w.map((x) => x.id);
  assert.ok(ids.includes('category') && ids.includes('lapses') && ids.includes('due') && ids.includes('hints'), ids.join());
  assert.equal(w[0].id, 'category'); assert.equal(w[0].action.label, 'กาล');
  assert.ok(w.every((x) => x.evidence && x.action && x.action.type));
  assert.ok(ids.includes('noVoice'));                                                          // chatted, no voice practice
  assert.ok(!ids.includes('noChat'));
});
await test('weak spots: low scenario criterion, weak listening; style tips are not mistakes', async () => {
  const data = {
    days: { [key(1)]: { listen: 10, listenOk: 3 } },
    results: [{ id: 'cafe', scene: 'คาเฟ่', t: at(1), criteria: [{ name: 'polite requests', score: 2 }] }, { id: 'cafe', scene: 'คาเฟ่', t: at(2), criteria: [{ name: 'polite requests', score: 2.5 }] }],
    mistakes: [...Array(5)].map((_, i) => ({ t: at(i), category: 'naturalness', type: 'style' })),
  };
  const w = weaknesses(data, NOW);
  assert.ok(w.find((x) => x.id === 'criterion')?.action.id === 'cafe');
  assert.ok(w.find((x) => x.id === 'listening'));
  assert.ok(!w.find((x) => x.id === 'category'));
  assert.ok(w.find((x) => x.id === 'noChat'));
});
await test('recommendations: top 3, no two of the same action', async () => {
  const data = { days: { [key(0)]: { msgs: 12, hints: 8, shadowWords: 40, shadowHeard: 10 } }, mistakes: [...Array(4)].map((_, i) => ({ t: at(i), category: 'tense', srs: { lapses: 2, due: NOW + 1e9 } })) };
  const r = recommendations(data, NOW);
  assert.ok(r.length <= 3);
  const keys = r.map((x) => x.action.type + (x.action.tab || x.action.id || x.action.category || ''));
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(recommendations({ days: {} }, NOW).map((x) => x.id), ['noChat']);
});
await test('history lists only days with activity, newest first', async () => {
  const h = history({ days: { [key(0)]: { msgs: 3, secs: 300 }, [key(5)]: { reviews: 2 } }, results: [{ t: at(5) }] }, NOW, 10);
  assert.deepEqual(h.map((x) => x.key), [key(0), key(5)]);
  assert.equal(h[0].mins, 5); assert.equal(h[1].scenarios, 1);
});

// ---- plan ----
await test('a new plan: 7 days from today, chat + review + a rotating practice task', async () => {
  const p = makePlan({ goals: { messages: 12, reviews: 8 }, focus: ['voice:listen', 'scenario'], now: NOW });
  assert.equal(p.days.length, 7); assert.equal(p.start, key(0)); assert.equal(p.days[6].key, dayRange(NOW, 1, -6)[0]);
  assert.deepEqual(p.days[0].tasks.map((t) => [t.kind, t.target]), [['chat', 12], ['review', 8], ['listen', 5]]);
  assert.equal(p.days[1].tasks[2].kind, 'scenario');
  assert.ok(new Set(p.days.flatMap((d) => d.tasks.map((t) => t.id))).size === 21);
  assert.ok(planCovers(p, key(0)) && !planCovers(p, key(1)));
});
await test('task progress comes from the real day counters', async () => {
  assert.deepEqual(taskProgress({ kind: 'chat', target: 10 }, { msgs: 4 }), { done: 4, target: 10, complete: false });
  assert.equal(taskProgress({ kind: 'time', target: 15 }, { secs: 960 }).complete, true);
  assert.equal(taskProgress({ kind: 'scenario', target: 1 }, {}, 1).complete, true);
  assert.equal(taskProgress({ kind: 'review', target: 5 }, undefined).done, 0);
});
await test('editing: targets step and stay in range, remove, add (no duplicates, max 5)', async () => {
  let p = makePlan({ now: NOW });
  const d0 = p.days[0], chat = d0.tasks[0];
  p = changeTarget(p, d0.key, chat.id, +1); assert.equal(p.days[0].tasks[0].target, 15);
  for (let i = 0; i < 30; i++) p = changeTarget(p, d0.key, chat.id, -1);
  assert.equal(p.days[0].tasks[0].target, 1);
  p = removeTask(p, d0.key, chat.id); assert.equal(p.days[0].tasks.length, 2);
  p = addTask(p, d0.key, 'time'); p = addTask(p, d0.key, 'time'); p = addTask(p, d0.key, 'nope');
  assert.equal(p.days[0].tasks.filter((t) => t.kind === 'time').length, 1);
  for (const k of Object.keys(TASK_KINDS)) p = addTask(p, d0.key, k);
  assert.equal(p.days[0].tasks.length, MAX_TASKS);
  assert.equal(p.days[1].tasks.length, 3);                                    // other days untouched
});
await test('stored plans are validated; broken ones become null', async () => {
  const p = cleanPlan({ days: [{ key: '2026-11-04', tasks: [{ id: 'a', kind: 'chat', target: 999 }, { kind: 'hack' }] }, { key: 'bad', tasks: [] }] });
  assert.deepEqual(p.days, [{ key: '2026-11-04', tasks: [{ id: 'a', kind: 'chat', target: 100 }] }]);
  assert.equal(cleanPlan(null), null); assert.equal(cleanPlan({ days: [] }), null); assert.equal(cleanPlan({ days: 'x' }), null);
});

done();
