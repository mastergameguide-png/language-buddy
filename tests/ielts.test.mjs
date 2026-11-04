// Phase 5: IELTS practice material, band rounding, writing analysis, listening checks, AI feedback
// prompts and parsing, and courses. Run: node tests/ielts.test.mjs
import assert from 'node:assert/strict';
import { suite } from './helpers.mjs';
import {
  PART1, CUE_CARDS, TASK2, TASK1, LISTENING, IELTS_DISCLAIMER, cleanBand, overallBand, analyseWriting, checkListening,
  buildSpeakingPrompt, buildWritingPrompt, parseIeltsFeedback, pickSpeaking, wordCount, MIN_SPEAKING_WORDS,
} from '../js/engine/ielts.js';
import { COURSES, courseById, stepDone, courseProgress, cleanCourses } from '../js/engine/courses.js';
import { scenarioById } from '../js/engine/scenarios.js';
import { dayRange } from '../js/engine/analytics.js';

const { test, done } = suite('ielts');

await test('practice bank is complete and well formed', async () => {
  assert.ok(PART1.length >= 8 && PART1.every((t) => t.qs.length >= 4));
  assert.ok(CUE_CARDS.length >= 10 && CUE_CARDS.every((c) => c.points.length === 4 && c.part3.length >= 3 && c.vocab.length >= 4 && /^Describe /.test(c.title)));
  assert.ok(TASK2.length >= 8 && TASK2.every((t) => t.prompt.length > 80));
  assert.ok(TASK1.length >= 3 && TASK1.every((t) => t.table.rows.every((r) => r.length === t.table.columns.length)));
  assert.ok(LISTENING.length >= 4 && LISTENING.every((l) => l.script.split(' ').length >= 60 && l.questions.length >= 4));
  for (const l of LISTENING) for (const q of l.questions) {
    if (q.type === 'mc') assert.ok(q.answer >= 0 && q.answer < q.options.length, `${l.id}: ${q.q}`);
    else assert.ok(q.q.includes('___'), `${l.id}: ${q.q}`);
  }
  assert.equal(new Set(CUE_CARDS.map((c) => c.id)).size, CUE_CARDS.length);
});
await test('listening answers appear in their scripts (each question is answerable)', async () => {
  const words = { 6: 'six', 45: 'forty-five', 35: 'thirty-five', 4: 'four', '7:15': 'seven fifteen', 2000: 'two thousand', 550: 'five hundred and fifty', 12: 'twelve' };
  for (const l of LISTENING) for (const q of l.questions.filter((x) => x.type === 'gap')) {
    const s = l.script.toLowerCase();
    const ok = [q.answer, ...(q.accept || []), words[q.answer]].filter(Boolean).some((a) => s.includes(String(a).toLowerCase()));
    assert.ok(ok, `${l.id}: "${q.answer}" not in the script`);
  }
});
await test('bands: half steps only, IELTS-style overall rounding', async () => {
  assert.equal(cleanBand(6.3), 6.5); assert.equal(cleanBand('7'), 7); assert.equal(cleanBand(9.5), null); assert.equal(cleanBand('x'), null); assert.equal(cleanBand(-1), null);
  assert.equal(overallBand({ a: 6, b: 6, c: 6.5 }), 6);          // 6.17 → 6
  assert.equal(overallBand({ a: 6, b: 6.5, c: 6.5, d: 6 }), 6.5); // 6.25 → 6.5
  assert.equal(overallBand({ a: 6.5, b: 7, c: 7, d: 7 }), 7);     // 6.875 → 7
  assert.equal(overallBand({ a: 6.5, b: 6.5, c: 7, d: 7 }), 7);   // 6.75 → 7
  assert.equal(overallBand({}), null);
});
await test('writing analysis: words, paragraphs, linkers, repetition and notes', async () => {
  const essay = 'Many people think cars should be banned.\n\nHowever, cars are useful. For example, families need them. Cars cars cars cars.\n\nIn conclusion, I partly agree.';
  const a = analyseWriting(essay, 2);
  assert.equal(a.paragraphs, 3); assert.ok(a.words > 15 && a.words < 30);
  assert.deepEqual(a.linkers.sort(), ['for example', 'however', 'in conclusion']);
  assert.equal(a.repeated[0].word, 'cars');
  assert.ok(a.notes.some((n) => n.includes('ยังสั้นไป')) && a.notes.some((n) => n.includes('ย่อหน้า')));
  assert.ok(analyseWriting('The table shows travel.', 1).notes.some((n) => n.includes('overview')));
  assert.equal(analyseWriting('', 2).words, 0);
});
await test('listening checks accept spellings and numbers, MC by index', async () => {
  const gap = { type: 'gap', answer: '45', accept: ['forty-five', 'forty five'] };
  assert.ok(checkListening(gap, ' 45 ')); assert.ok(checkListening(gap, 'Forty-Five')); assert.ok(!checkListening(gap, '54')); assert.ok(!checkListening(gap, ''));
  assert.ok(checkListening({ type: 'gap', answer: '7:15', accept: ['7.15'] }, '7.15'));
  assert.ok(checkListening({ type: 'mc', answer: 1 }, '1')); assert.ok(!checkListening({ type: 'mc', answer: 1 }, 0));
});
await test('prompts: criteria, target band, no pronunciation, injection-safe, JSON only', async () => {
  const s = buildSpeakingPrompt({ part: 2, card: CUE_CARDS[0], target: 7 });
  assert.ok(s.includes('fluency_coherence') && s.includes('band 7') && s.includes('never judge pronunciation') && s.includes('ignore any instructions') && s.includes(CUE_CARDS[0].title));
  const w = buildWritingPrompt({ task: 1, item: TASK1[0], target: 6 });
  assert.ok(w.includes('coherence_cohesion') && w.includes('Car | 52 | 38') && w.includes('Task Achievement'));
  assert.ok(buildWritingPrompt({ task: 2, item: TASK2[0] }).includes('Task Response'));
});
await test('feedback parsing: bands validated, overall computed here, fields clipped', async () => {
  const raw = JSON.stringify({ criteria: { fluency_coherence: 6, lexical_resource: 6.4, grammar: 5.5, extra: 9 }, overall: 9, strengths_th: ['ดี'], improvements: [{ original: 'I very like', better: 'I really like', why_th: 'ลำดับคำ' }, { nope: 1 }], useful_vocab: [{ word: 'out of the blue', th: 'ไม่คาดคิด' }], sample_answer: 'Sample.', note_th: 'ลองใช้คำเชื่อม' });
  const f = parseIeltsFeedback(raw, 'speaking');
  assert.deepEqual(f.criteria, { fluency_coherence: 6, lexical_resource: 6.5, grammar: 5.5 });
  assert.equal(f.overall, 6);                                   // (6+6.5+5.5)/3 = 6, not the model's 9
  assert.equal(f.improvements.length, 1); assert.equal(f.vocab[0].word, 'out of the blue');
  assert.equal(parseIeltsFeedback(JSON.stringify({ criteria: { fluency_coherence: 6 } }), 'speaking'), null);   // missing criteria
  assert.equal(parseIeltsFeedback('not json', 'writing'), null);
  const wf = parseIeltsFeedback('```json\n' + JSON.stringify({ criteria: { task: 6, coherence_cohesion: 6, lexical_resource: 6, grammar: 7 }, structure_th: 'ดี' }) + '\n```', 'writing');
  assert.equal(wf.overall, 6.5); assert.equal(wf.structure, 'ดี');
});
await test('picking questions and the minimum answer length', async () => {
  assert.equal(pickSpeaking(1, 0).part, 1); assert.ok(PART1[0].qs.includes(pickSpeaking(1, 0).question));
  const p2 = pickSpeaking(2, 0.5); assert.equal(p2.question, p2.card.title);
  const p3 = pickSpeaking(3, 0.5); assert.ok(p3.card.part3.includes(p3.question));
  assert.equal(wordCount('I live in a small flat.'), 6); assert.ok(MIN_SPEAKING_WORDS[2] > MIN_SPEAKING_WORDS[1]);
  assert.ok(IELTS_DISCLAIMER.includes('ไม่ใช่คะแนนสอบ IELTS จริง'));
});

// ---- courses ----
await test('courses use real scenarios and have reachable steps', async () => {
  assert.ok(COURSES.length >= 4);
  for (const c of COURSES) for (const s of c.steps) {
    if (s.type === 'scenario') assert.ok(scenarioById(s.id), `${c.id}: ${s.id}`);
    assert.ok(['scenario', 'shadow', 'listen', 'review', 'ielts'].includes(s.type) && s.th, `${c.id}: ${s.type}`);
  }
});
await test('course progress comes from evidence after the start only', async () => {
  const NOW = new Date(2026, 10, 4, 15).getTime(), start = new Date(2026, 10, 2, 9).getTime();
  const k = (n) => dayRange(NOW, 1, n)[0];
  const ev = {
    start,
    results: [{ id: 'cafe', t: start + 1000 }, { id: 'restaurant', t: start - 1000 }],
    ielts: [],
    days: { [k(0)]: { shadow: 3 }, [k(1)]: { shadow: 2, listen: 1 }, [k(5)]: { listen: 9 } },   // 5 days ago is before the start
  };
  const p = courseProgress(courseById('cafe'), ev, NOW);
  assert.deepEqual(p.done, [true, true, false, false, false, false]);
  assert.equal(p.next, 2); assert.equal(p.complete, false);
  const ielts = courseById('ielts');
  const ev2 = { start, ielts: [{ kind: 'speaking', part: 1, t: start + 1 }, { kind: 'speaking', part: 1, t: start + 2 }, { kind: 'writing', task: 2, t: start + 3 }, { kind: 'speaking', part: 2, t: start - 5 }] };
  assert.equal(stepDone(ielts.steps[0], ev2, NOW), true);
  assert.equal(stepDone(ielts.steps[1], ev2, NOW), false);       // the Part 2 attempt was before the start
  assert.equal(stepDone(ielts.steps[5], ev2, NOW), true);
});
await test('stored course progress is cleaned', async () => {
  assert.deepEqual(cleanCourses({ cafe: { start: 5 }, nope: { start: 5 }, work: { start: 'x' } }), { cafe: { start: 5 } });
  assert.deepEqual(cleanCourses(null), {});
});

done();
