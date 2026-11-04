// Live scenario test against the real AI (uses about 25 requests of the free quota).
// Run: node tests/live-scenarios.mjs [worker-url] [allowed-origin]
// Plays the opening of each newer scenario, then one full café scene to the end-of-scene scores.
import { getCharacter } from '../js/engine/characters.js';
import { newSession, applyRole, roleForScenario } from '../js/engine/roles.js';
import { scenarioById, matchCriteria } from '../js/engine/scenarios.js';
import { buildSystemPrompt, appNotes } from '../js/engine/prompt.js';
import { parseStructured } from '../js/engine/response.js';

const WORKER = process.argv[2] || 'https://language-buddy.mastergameguide.workers.dev';
const ORIGIN = process.argv[3] || 'https://mastergameguide-png.github.io';

function ctx(char, sc, state, over = {}) {
  const session = sc ? { ...applyRole(newSession(char), char, roleForScenario(sc, char), 'scenario'), scenario: sc.id } : newSession(char);
  return {
    lang: 'English', isEnglish: true, variant: 'American', levelText: 'CEFR B1', cefr: 'B1', feedback: 'gentle',
    char, session, scenario: sc, sceneState: state, facts: [], topics: [], mistakes: [], knownWords: [],
    charMemories: [], memoryOn: { learner: true, character: true }, mode: 'natural', length: 'normal', teaching: 'medium', ...over,
  };
}
async function ask(c, turns) {
  const contents = turns.map((t, i) => ({ role: i % 2 ? 'model' : 'user', parts: [{ text: t }] }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ system: buildSystemPrompt(c), contents, ai: 'auto' }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return parseStructured(data.text, { charId: c.char.id, roles: [] });
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}: ${data.error}`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw new Error('AI did not answer');
}
const results = [];
async function check(name, fn) {
  try { const { ok, note } = await fn(); results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, '|', note); }
  catch (e) { results.push(false); console.log('FAIL', name, '|', e.message); }
  await new Promise((r) => setTimeout(r, 1500));
}
const stepNo = (r) => (r.scenarioStep ? Number(r.scenarioStep.slice(1)) : 0);

// Opening line + one learner turn for each newer scenario.
const OPENERS = {
  support: 'Hi, I ordered a blue jacket but I received a red one.',
  landlord: 'Hello, the air conditioner in my room stopped working yesterday.',
  neighbour: 'Hi, sorry to bother you. The music is a bit loud and I have work tomorrow.',
  apology: 'I am so sorry I missed your birthday dinner last night.',
  visa: 'Good morning. I want to visit for a two-week holiday.',
  teacher: 'Excuse me, do you have a minute? I wanted to ask about the assignment.',
  firstday: 'Hi, I\'m new here. I just joined the marketing team.',
  pharmacy: 'Hello, I have a headache and a runny nose since yesterday.',
};
for (const [id, line] of Object.entries(OPENERS)) {
  const sc = scenarioById(id);
  const char = getCharacter(sc.cast[0], {});
  await check(`${id}: opens in role and reports a valid stage, then moves on`, async () => {
    const c = ctx(char, sc, { variant: 'normal', step: 0 });
    const start = appNotes.sceneStart(sc.th);
    const r1 = await ask(c, [start]);
    const s1 = stepNo(r1);
    const r2 = await ask(ctx(char, sc, { variant: 'normal', step: s1 }), [start, r1.reply, line]);
    const s2 = stepNo(r2);
    const ok = !r1.malformed && !r2.malformed && s1 >= 1 && s1 <= sc.steps.length && s2 >= 1 && s2 <= sc.steps.length && !r2.scenarioDone;
    return { ok, note: `${char.name} · s${s1}→s${s2} · "${r1.reply.slice(0, 90)}" → "${r2.reply.slice(0, 90)}"` };
  });
}

// A full café scene: stages advance, done is reported, then criteria scores at the end.
const cafe = scenarioById('cafe');
const sofia = getCharacter('sofia', {});
await check('café: stages advance and the scene reports done', async () => {
  const lines = ['Hi! Could I get a large latte, please?', 'Oat milk, please. And no sugar.', 'No thanks, that\'s all.', 'Card, please. It\'s for here.', 'My name is Ann. Thank you!'];
  const turns = [appNotes.sceneStart(cafe.th)];
  let step = 0, done = false, path = [];
  let r = await ask(ctx(sofia, cafe, { variant: 'normal', step }), turns);
  step = Math.max(step, stepNo(r)); path.push(stepNo(r)); turns.push(r.reply);
  for (const l of lines) {
    turns.push(l);
    r = await ask(ctx(sofia, cafe, { variant: 'normal', step }), turns);
    step = Math.max(step, stepNo(r)); path.push(stepNo(r)); turns.push(r.reply);
    if (r.scenarioDone) { done = true; break; }
  }
  return { ok: done && step >= 4, note: `stages ${path.join('→')} · done=${done}` };
});
await check('café: end-of-scene criteria scores match the scenario', async () => {
  const end = appNotes.sceneEnd({ title: cafe.th, name: sofia.name, lang: 'English', criteria: cafe.criteria });
  const turns = ['Hi! Could I get a large latte, please?', 'Sure! Any milk preference?', 'Oat milk please, for here.', 'Great, that\'s $5. Card or cash?', 'Card please. Thanks!', 'Here you go. Have a nice day!', end];
  const r = await ask(ctx(sofia, null, null), turns);
  const m = matchCriteria(r.criteriaScores, cafe.criteria);
  return { ok: m.length >= 2 && Number.isFinite(r.score) && /[฀-๿]/.test(r.reply), note: `score=${r.score} · ${m.map((x) => `${x.name}=${x.score}`).join(', ')} · raw=${JSON.stringify(r.criteriaScores)}` };
});

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} live scenario checks passed`);
process.exitCode = passed === results.length ? 0 : 1;
