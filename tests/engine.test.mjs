// Unit tests for the character engine (no browser, no network). Run: node tests/engine.test.mjs
import assert from 'node:assert/strict';
import { CHARACTERS, ROLES, getCharacter, validateCharacter, customCharacter } from '../js/engine/characters.js';
import { nextEmotion, expressionFor, voiceFor, baseEmotion } from '../js/engine/emotion.js';
import { newSession, freshSession, applyRole, roleForScenario, SESSION_IDLE_MS } from '../js/engine/roles.js';
import { remember, rememberFact, recall, expire, safeMemoryText, applyMemoryUpdates } from '../js/engine/memory.js';
import { SCENARIOS, validateScenario, scenarioById } from '../js/engine/scenarios.js';
import { parseStructured, mapCategory } from '../js/engine/response.js';
import { buildSystemPrompt, CEFR_GUIDE } from '../js/engine/prompt.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const char = (id) => getCharacter(id, {});

test('six characters with complete, valid configuration', () => {
  assert.deepEqual(CHARACTERS.map((c) => c.id), ['emma', 'james', 'mika', 'david', 'sofia', 'alex']);
  for (const c of CHARACTERS) assert.deepEqual(validateCharacter(c), [], c.id);
  assert.equal(new Set(CHARACTERS.map((c) => c.name)).size, 6);
});
test('roles from the brief are present', () => {
  assert.deepEqual(char('emma').roles, ['friend', 'cafe_customer', 'travel_companion', 'interviewer']);
  assert.deepEqual(char('james').roles, ['colleague', 'interviewer', 'manager', 'business_partner']);
  assert.ok(char('alex').roles.includes('police_officer') && char('david').roles.includes('speaking_examiner'));
});
test('custom buddy keeps the user name and persona', () => {
  const b = getCharacter('buddy', { name: 'Sam', persona: 'kind' });
  assert.equal(b.name, 'Sam'); assert.equal(b.style, 'kind'); assert.ok(b.custom);
  assert.equal(getCharacter('nobody', { name: 'Kai' }).name, 'Kai');
});
test('all scenarios are complete and the 11 required ones exist', () => {
  for (const s of SCENARIOS) assert.deepEqual(validateScenario(s), [], s.id);
  for (const id of ['daily', 'cafe', 'restaurant', 'interview', 'airport', 'hotel', 'shopping', 'party', 'abroad', 'emergency', 'police']) assert.ok(scenarioById(id), id);
  for (const s of SCENARIOS) for (const r of s.aiRoles) assert.ok(ROLES[r], `${s.id}: ${r}`);
});

// ---- emotion ----
test('emotion: same mood blends, never above character max', () => {
  const emma = char('emma');
  const e = nextEmotion({ state: 'happy', intensity: 0.6 }, { state: 'happy', intensity: 1 }, emma);
  assert.equal(e.state, 'happy'); assert.ok(e.intensity <= emma.emotional.max && e.intensity > 0.6);
});
test('emotion: weak signal does not flip the mood', () => {
  const e = nextEmotion({ state: 'happy', intensity: 0.6 }, { state: 'surprised', intensity: 0.3 }, char('emma'));
  assert.equal(e.state, 'happy');
});
test('emotion: clear signal changes mood, eased in', () => {
  const e = nextEmotion({ state: 'happy', intensity: 0.6 }, { state: 'empathetic', intensity: 0.9 }, char('emma'));
  assert.equal(e.state, 'empathetic'); assert.ok(e.intensity < 0.9);
});
test('emotion: calm characters need more evidence than playful ones', () => {
  const p = { state: 'focused', intensity: 0.5 }, n = { state: 'playful', intensity: 0.6 };
  assert.equal(nextEmotion(p, n, char('alex')).state, 'focused');
  assert.equal(nextEmotion(p, n, char('sofia')).state, 'playful');
});
test('emotion: invalid or missing input drifts back to baseline', () => {
  assert.equal(nextEmotion(null, { state: 'furious', intensity: 1 }, char('james')).state, 'focused');
  let e = { state: 'surprised', intensity: 0.6 };
  for (let i = 0; i < 6; i++) e = nextEmotion(e, null, char('emma'));
  assert.deepEqual(e, baseEmotion(char('emma')));
});
test('emotion maps to avatar expression and voice', () => {
  assert.equal(expressionFor({ state: 'curious' }), 'thinking');
  assert.equal(expressionFor({ state: 'neutral' }), 'default');
  const v = voiceFor({ state: 'empathetic', intensity: 0.8 });
  assert.ok(v.rate < 1 && v.pitch < 1);
});

// ---- roles ----
test('role: Emma becomes interviewer for a scenario and returns to friend', () => {
  const emma = char('emma');
  let s = newSession(emma);
  s = applyRole(s, emma, roleForScenario(scenarioById('interview'), emma), 'scenario');
  assert.equal(s.role, 'interviewer'); assert.equal(s.roleSource, 'scenario');
  s = applyRole(s, emma, null, 'default');
  assert.equal(s.role, 'friend'); assert.equal(s.scenario, null);
});
test('role: user choice beats model detection', () => {
  const emma = char('emma');
  let s = applyRole(newSession(emma), emma, 'travel_companion', 'manual');
  s = applyRole(s, emma, 'interviewer', 'auto');
  assert.equal(s.role, 'travel_companion');
});
test('role: model detection works when nothing was chosen, only for own roles', () => {
  const james = char('james');
  let s = applyRole(newSession(james), james, 'interviewer', 'auto');
  assert.equal(s.role, 'interviewer'); assert.equal(s.roleSource, 'auto');
  assert.equal(applyRole(s, james, 'barista', 'auto').role, 'interviewer');
  assert.equal(applyRole(s, james, 'colleague', 'auto').roleSource, 'default');
});
test('role: scenario may give a role the character lacks; idle sessions reset', () => {
  const mika = char('mika');
  assert.equal(roleForScenario(scenarioById('restaurant'), mika), 'restaurant_staff');
  const old = { ...applyRole(newSession(mika, 0), mika, 'hotel_receptionist', 'manual'), t: 0 };
  assert.equal(freshSession(old, mika, SESSION_IDLE_MS + 1).role, 'travel_companion');
  const inScene = { ...old, scenario: 'hotel', roleSource: 'scenario' };
  assert.equal(freshSession(inScene, mika, SESSION_IDLE_MS + 1).role, 'hotel_receptionist');
});

// ---- memory ----
test('memory: duplicates merge, sensitive text is refused', () => {
  let l = remember([], 'Talked about pizza with pineapple', 1);
  l = remember(l, 'talked about pizza with pineapple!', 2);
  assert.equal(l.length, 1); assert.equal(l[0].t, 2);
  assert.equal(safeMemoryText('my password is hunter2'), '');
  assert.equal(safeMemoryText('phone 081 234 5678'), '');
  assert.deepEqual(rememberFact(['likes cats'], 'Likes cats'), ['likes cats']);
});
test('memory: recall prefers relevant items, expire drops old ones', () => {
  const now = 400 * 86400000;
  const l = [{ text: 'practised a job interview for a hotel', t: now }, { text: 'loves pizza', t: now - 10 * 86400000 }, { text: 'went hiking', t: 0 }];
  assert.equal(recall(l, 'what pizza do you like?', 1, now)[0].text, 'loves pizza');
  assert.equal(expire(l, now).length, 2);
});
test('memory: character memory is separate and can be switched off', () => {
  const r = applyMemoryUpdates({ facts: [], list: [] }, [{ scope: 'learner', text: 'has a dog' }, { scope: 'character', text: 'we talked about pizza' }], { learner: true, character: false }, 5);
  assert.deepEqual(r.facts, ['has a dog']); assert.deepEqual(r.list, []);
});

// ---- response ----
test('response: full structured reply is validated', () => {
  const r = parseStructured(JSON.stringify({
    character_id: 'emma', message: 'Oh nice! What did you have?', emotion: { state: 'curious', intensity: 0.6 }, active_role: 'friend',
    language_feedback: { original: 'went restaurant', corrected: 'went to a restaurant', category: 'Article usage', explanation: 'ใช้ a', natural_expression: 'I went to a restaurant yesterday.' },
    suggested_follow_up: 'I had pasta.', memory_updates: [{ scope: 'character', text: 'talked about a restaurant' }], topic: 'eating out',
    assessment: { grammar: 3, vocabulary: 9, fluency: 'x' },
  }), { charId: 'emma', roles: char('emma').roles });
  assert.equal(r.malformed, false); assert.equal(r.reply, 'Oh nice! What did you have?');
  assert.equal(r.correction.category, 'article'); assert.equal(r.correction.right, 'went to a restaurant');
  assert.deepEqual(r.emotion, { state: 'curious', intensity: 0.6 });
  assert.deepEqual(r.assessment, { grammar: 3 });
  assert.equal(r.memoryUpdates[0].scope, 'character');
});
test('response: several reply ideas, deduped and capped', () => {
  const r = parseStructured(JSON.stringify({ message: 'Hi', suggested_replies: [
    { label: 'ตอบตรงๆ', text: 'I am studying for IELTS.' }, { label: 'ถามกลับ', text: 'What about you?' },
    'I like movies.', { label: 'x', text: 'what about you?' }, { label: 'a', text: 'One' }, { label: 'b', text: 'Two' }] }));
  assert.equal(r.suggestions.length, 4);
  assert.deepEqual(r.suggestions[0], { label: 'ตอบตรงๆ', text: 'I am studying for IELTS.' });
  assert.equal(r.suggestions[2].label, '');
  assert.deepEqual(parseStructured('{"message":"Hi","suggested_follow_up":"Sure!"}').suggestions, [{ label: '', text: 'Sure!' }]);
  assert.deepEqual(parseStructured('not json').suggestions, []);
});
test('response: older field names still work', () => {
  const r = parseStructured('```json\n{"reply":"Hi","correction":{"wrong":"I go","right":"I went","category":"tense","why":"past"},"remember":["likes tea"]}\n```');
  assert.equal(r.reply, 'Hi'); assert.equal(r.correction.wrong, 'I go'); assert.deepEqual(r.memoryUpdates, [{ scope: 'learner', text: 'likes tea' }]);
});
test('response: malformed output is shown as text, never crashes', () => {
  assert.equal(parseStructured('Sorry, something went wrong').malformed, true);
  assert.equal(parseStructured('{"message": 5}').malformed, true);
  assert.equal(parseStructured('').reply, '…');
});
test('response: unsafe or foreign fields are ignored', () => {
  const r = parseStructured(JSON.stringify({ message: 'ok', character_id: 'james', active_role: 'barista', emotion: { state: 'rage', intensity: 5 }, run: 'deleteAll()', score: 99 }), { charId: 'emma', roles: char('emma').roles });
  assert.equal(r.characterId, 'emma'); assert.equal(r.activeRole, null); assert.equal(r.emotion, null); assert.equal(r.score, 10);
  assert.ok(!('run' in r));
});
test('response: unquoted keys and trailing commas from the model are repaired', () => {
  const r = parseStructured('{\n  "message": "hi",\n  "language_feedback": {\n    "original": "I go",\n    "corrected": "I went",\n    name: "article",\n    "category": "tense",\n  },\n}');
  assert.equal(r.malformed, false); assert.equal(r.correction.right, 'I went');
});
test('category mapping', () => {
  assert.equal(mapCategory('Verb Tense'), 'tense'); assert.equal(mapCategory('grammar'), 'other'); assert.equal(mapCategory('Collocation'), 'naturalness');
});

// ---- prompt ----
const ctx = (over = {}) => ({
  lang: 'English', isEnglish: true, variant: 'American', levelText: 'CEFR A1', cefr: 'A1', feedback: 'gentle',
  char: char('emma'), session: newSession(char('emma')), scenario: null, facts: ['likes cats'], topics: [], mistakes: [], knownWords: [],
  charMemories: ['talked about pizza'], memoryOn: { learner: true, character: true }, ...over,
});
test('prompt: core personality, role, emotion, memory and level are all included', () => {
  const p = buildSystemPrompt(ctx());
  for (const s of ['You are Emma', 'friendly, playful, curious, empathetic', 'ACTIVE ROLE', 'EMOTIONAL STATE', 'likes cats', 'talked about pizza', CEFR_GUIDE.A1, '"character_id": "emma"', 'AI character']) assert.ok(p.includes(s), s);
});
test('prompt: scenario role keeps identity and locks the role', () => {
  const emma = char('emma');
  const session = applyRole(newSession(emma), emma, 'interviewer', 'scenario');
  const p = buildSystemPrompt(ctx({ session: { ...session, scenario: 'interview' }, scenario: scenarioById('interview') }));
  assert.ok(p.includes('ACTIVE ROLE: Job interviewer') && p.includes('stay recognisably Emma') && p.includes('ROLE-PLAY IS ON') && p.includes('must stay "interviewer"'));
});
test('prompt: memory off is respected, other characters\' memories are not passed', () => {
  const p = buildSystemPrompt(ctx({ char: char('james'), session: newSession(char('james')), charMemories: [], memoryOn: { learner: false, character: false } }));
  assert.ok(!p.includes('likes cats') && !p.includes('talked about pizza'));
  assert.ok(p.includes('memory is turned off'));
});
test('prompt: C1 guidance differs from A1 and stays a reasonable size', () => {
  const a = buildSystemPrompt(ctx()), c = buildSystemPrompt(ctx({ cefr: 'C1', levelText: 'CEFR C1' }));
  assert.ok(c.includes(CEFR_GUIDE.C1) && !c.includes(CEFR_GUIDE.A1));
  assert.ok(a.length < 12000, `prompt is ${a.length} chars`);
});
test('prompt: custom buddy still works', () => {
  const b = customCharacter({ name: 'Sam', persona: 'kind and funny' });
  assert.ok(buildSystemPrompt(ctx({ char: b, session: newSession(b) })).includes('You are Sam'));
});

test('prompt: Thai particle follows the character', () => {
  assert.ok(buildSystemPrompt(ctx({ char: char('david'), session: newSession(char('david')) })).includes('ครับ'));
  assert.ok(buildSystemPrompt(ctx()).includes('ค่ะ'));
  assert.ok(buildSystemPrompt(ctx()).includes('Never invent shared history'));
});

console.log(`\nall ${passed} engine tests passed`);
