// Phase 2 scenario engine: schema v2, search and level filters, steps, difficulty variants,
// progress reporting in replies, criteria scores, attempts history. Run: node tests/scenario.test.mjs
import assert from 'node:assert/strict';
import { suite } from './helpers.mjs';
import {
  SCENARIOS, SCENARIO_CATEGORIES, VARIANTS, upgradeScenario, validateScenario, scenarioById, searchScenarios, fitsLevel,
  scenarioBrief, progressOf, attemptsOf, matchCriteria,
} from '../js/engine/scenarios.js';
import { ROLES, CHARACTER_IDS, getCharacter } from '../js/engine/characters.js';
import { newSession, applyRole, roleForScenario } from '../js/engine/roles.js';
import { buildSystemPrompt, appNotes } from '../js/engine/prompt.js';
import { parseStructured, criteriaOf } from '../js/engine/response.js';

const { test, done } = suite('scenarios');

await test('25 scenarios, unique ids, every one passes the v2 validator', async () => {
  assert.ok(SCENARIOS.length >= 25, String(SCENARIOS.length));
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  for (const s of SCENARIOS) assert.deepEqual(validateScenario(s), [], s.id);
});
await test('roles and cast refer to real roles and characters', async () => {
  for (const s of SCENARIOS) {
    for (const r of s.aiRoles) assert.ok(ROLES[r], `${s.id}: role ${r}`);
    for (const c of s.cast) assert.ok(CHARACTER_IDS.includes(c), `${s.id}: cast ${c}`);
  }
});
await test('every non-exam category has a scenario, and the brief\'s 13 categories exist', async () => {
  assert.equal(SCENARIO_CATEGORIES.length, 13);
  for (const c of SCENARIO_CATEGORIES) assert.ok(SCENARIOS.some((s) => s.category === c.id), c.id);
});
await test('steps are derived from the flow with Thai labels', async () => {
  const cafe = scenarioById('cafe');
  assert.deepEqual(cafe.steps.map((s) => s.id), ['s1', 's2', 's3', 's4', 's5']);
  assert.equal(cafe.steps[0].th, 'ทักทายและสั่ง');
});
await test('a v1 scenario (group, no category or range) still upgrades', async () => {
  const old = upgradeScenario({ id: 'x', group: 'safety', th: 'เก่า', difficulty: 'A2', flow: ['a', 'b'], vocab: [] });
  assert.equal(old.category, 'healthcare'); assert.deepEqual(old.cefr, ['A2', 'A2']);
  assert.equal(old.steps[1].th, 'b'); assert.deepEqual(old.expressions, []);
});
await test('search finds Thai titles, English titles, vocabulary and phrases', async () => {
  const ids = (q) => searchScenarios(SCENARIOS, { q }).map((s) => s.id);
  assert.ok(ids('หมอ').includes('doctor'));
  assert.ok(ids('hotel').includes('hotel'));
  assert.ok(ids('refund').includes('support'));
  assert.ok(ids('slipped my mind').includes('apology'));
  assert.deepEqual(ids('zzzz'), []);
});
await test('category, level and language filters', async () => {
  assert.ok(searchScenarios(SCENARIOS, { category: 'healthcare' }).every((s) => s.category === 'healthcare'));
  const a1 = searchScenarios(SCENARIOS, { cefr: 'A1' });
  assert.ok(a1.length >= 5 && a1.every((s) => fitsLevel(s, 'A1')));
  assert.ok(!searchScenarios(SCENARIOS, { english: false }).some((s) => s.id === 'ielts'));
  assert.equal(fitsLevel(scenarioById('meeting'), 'A2'), false);
  assert.equal(fitsLevel(scenarioById('meeting'), 'B2'), true);
});
await test('the brief lists stage ids, phrases, the difficulty and the current stage', async () => {
  const b = scenarioBrief(scenarioById('cafe'), 'Barista', { variant: 'hard', step: 2 });
  assert.ok(b.includes('s1 greeting and order') && b.includes('Could I get a…, please?'));
  assert.ok(b.includes(VARIANTS.hard.prompt) && b.includes('reached stage s2') && b.includes('"scenario_done"'));
  assert.ok(scenarioBrief(scenarioById('cafe'), 'Barista').includes(VARIANTS.normal.prompt));
});
const emma = getCharacter('emma', {});
const ctx = (over = {}) => ({
  lang: 'English', isEnglish: true, variant: 'American', levelText: 'CEFR B1', cefr: 'B1', feedback: 'gentle',
  char: emma, session: newSession(emma), scenario: null, facts: [], topics: [], mistakes: [], knownWords: [],
  charMemories: [], memoryOn: { learner: true, character: true }, ...over,
});
await test('prompt asks for scenario_step only during a scenario', async () => {
  const sc = scenarioById('cafe');
  const session = { ...applyRole(newSession(emma), emma, roleForScenario(sc, emma), 'scenario'), scenario: 'cafe' };
  const p = buildSystemPrompt(ctx({ session, scenario: sc, sceneState: { variant: 'easy', step: 1 } }));
  assert.ok(p.includes('"scenario_step": "s1"') && p.includes('scenario_done') && p.includes(VARIANTS.easy.prompt));
  assert.ok(!buildSystemPrompt(ctx()).includes('"scenario_step"'));
  assert.ok(!buildSystemPrompt(ctx({ session, scenario: { custom: true, th: 'ห้องเช่า' } })).includes('"scenario_step"'));
});
await test('replies: stage id and done flag are validated', async () => {
  let r = parseStructured('{"message":"Here you go!","scenario_step":"s3","scenario_done":true}');
  assert.equal(r.scenarioStep, 's3'); assert.equal(r.scenarioDone, true);
  r = parseStructured('{"message":"x","scenario_step":"payment","scenario_done":"yes"}');
  assert.equal(r.scenarioStep, null); assert.equal(r.scenarioDone, false);
});
await test('criteria scores are validated and matched to the scene\'s own criteria', async () => {
  const raw = criteriaOf({ 'polite requests': 4, 'clear numbers and sizes': 3.7, bogus: 9, 'handling questions': 'x' });
  assert.deepEqual(raw, [{ name: 'polite requests', score: 4 }, { name: 'clear numbers and sizes', score: 3.5 }]);
  const m = matchCriteria(raw, scenarioById('cafe').criteria);
  assert.deepEqual(m.map((x) => x.name), ['polite requests (Could I / I\'d like)', 'clear numbers and sizes']);
  assert.deepEqual(criteriaOf([1, 2]), []);
});
await test('the end-of-scene note asks for criteria scores by name (also for IELTS)', async () => {
  const n = appNotes.sceneEnd({ title: 'คาเฟ่', name: 'Emma', lang: 'English', criteria: ['polite requests', 'numbers'] });
  assert.ok(n.includes('"criteria_scores"') && n.includes('"polite requests", "numbers"'));
  const ielts = scenarioById('ielts');
  const n2 = appNotes.sceneEnd({ title: ielts.th, name: 'David', lang: 'English', feedback: ielts.feedback, criteria: ielts.criteria });
  assert.ok(n2.includes('"Lexical Resource"') && n2.includes('practice estimate'));
});
await test('attempts and progress per scenario', async () => {
  const results = [{ id: 'cafe', t: 1, score: 5 }, { id: 'hotel', t: 2, score: 9 }, { id: 'cafe', t: 3, score: 8 }, { id: 'cafe', t: 4, score: null }];
  assert.deepEqual(attemptsOf(results, 'cafe').map((r) => r.t), [4, 3, 1]);
  assert.deepEqual(progressOf(results, 'cafe'), { count: 3, best: 8, last: results[2], delta: 3 });
  assert.deepEqual(progressOf(results, 'party'), { count: 0, best: null, last: null, delta: null });
});

done();
