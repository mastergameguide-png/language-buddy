// Data model: migration of old shapes, per-character chat caps, nothing dropped silently.
// Runs store.js in Node with a tiny localStorage stand-in. Run: node tests/store.test.mjs
import { suite } from './helpers.mjs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
globalThis.window = { addEventListener() {} };

// An old (v1) state: single buddy chat, the old one-line suggestion, no trimmed counter.
mem.set('lb_state', JSON.stringify({
  messages: [{ role: 'user', text: 'hi', t: 1 }, { role: 'model', text: 'hey', t: 2, suggestion: 'How are you?' }],
  facts: ['likes tea'], mistakes: [{ wrong: 'I go', right: 'I went', why: 'past', t: 3 }], vocab: [{ word: 'cozy', meaning: 'อบอุ่น' }],
  scene: { th: 'คาเฟ่', en: 'cafe' },
}));
const S = await import('../js/store.js');
const { check, test, done } = suite('store');

check('old state loads', S.state.messages.length === 2 && S.state.facts[0] === 'likes tea' && S.state.vocab[0].srs && S.state.mistakes[0].srs);
check('old single suggestion becomes a list', S.state.messages[1].suggestions?.[0]?.text === 'How are you?');
check('old scene is given to the custom buddy', S.state.scene?.char === 'buddy');
check('trimmed counter starts empty', JSON.stringify(S.state.trimmed) === '{}');

await test('chat is capped per character, not in total', async () => {
  const msgs = [];
  for (let i = 0; i < 600; i++) msgs.push({ role: 'user', text: 'e' + i, t: i, char: 'emma' });
  for (let i = 0; i < 100; i++) msgs.push({ role: 'user', text: 'j' + i, t: 1000 + i, char: 'james' });
  const s = S.normalizeState({ messages: msgs });
  const emma = s.messages.filter((m) => m.char === 'emma'), james = s.messages.filter((m) => m.char === 'james');
  if (emma.length !== S.LIMITS.messagesPerChar) throw new Error('emma ' + emma.length);
  if (james.length !== 100) throw new Error('james lost messages: ' + james.length);
  if (emma[0].text !== 'e100') throw new Error('kept the wrong end: ' + emma[0].text);
  if (s.trimmed.messages !== 100) throw new Error('trimmed not counted: ' + JSON.stringify(s.trimmed));
});
await test('old 120-day chat limit is gone', async () => {
  const s = S.normalizeState({ messages: [{ role: 'user', text: 'old', t: Date.now() - 400 * 86400000 }] });
  S.replaceState(s);
  if (S.state.messages.length !== 1) throw new Error('old message dropped');
});
await test('2000 words and 1000 mistakes are all kept', async () => {
  const vocab = Array.from({ length: 2000 }, (_, i) => ({ word: 'w' + i, meaning: 'm' }));
  const mistakes = Array.from({ length: 1000 }, (_, i) => ({ wrong: 'a' + i, right: 'b' + i }));
  const s = S.normalizeState({ vocab, mistakes });
  if (s.vocab.length !== 2000 || s.mistakes.length !== 1000) throw new Error(`${s.vocab.length} / ${s.mistakes.length}`);
  if (Object.keys(s.trimmed).length) throw new Error('trimmed something');
});
await test('addWord past the safety cap counts what was trimmed', async () => {
  S.replaceState({ vocab: Array.from({ length: S.LIMITS.vocab }, (_, i) => ({ word: 'w' + i })) });
  S.addWord({ word: 'brand-new' });
  if (S.state.vocab.length !== S.LIMITS.vocab || S.state.trimmed.vocab !== 1) throw new Error(JSON.stringify(S.state.trimmed));
});
await test('trimmed counts survive a reload and bad values are cleaned', async () => {
  const s = S.normalizeState({ trimmed: { vocab: 3, messages: 'x', evil: 9 } });
  if (JSON.stringify(s.trimmed) !== '{"vocab":3}') throw new Error(JSON.stringify(s.trimmed));
});
await test('storage report adds up the app keys', async () => {
  S.replaceState({ vocab: [{ word: 'hello' }] });
  const r = S.storageReport();
  if (!(r.kb >= 0) || r.counts.vocab !== 1 || r.limitKb !== 5000) throw new Error(JSON.stringify(r));
});
await test('Phase 1 message fields survive validation; bad ones are dropped', async () => {
  const s = S.normalizeState({ messages: [
    { role: 'model', text: 'What did you eat?', t: 1, hints: { clue: 'บอกเมนู', vocab: [{ word: 'pasta', th: 'พาสต้า' }], structure: 'I had ___.', example: 'I had pasta.', example_th: 'กินพาสต้า' } },
    { role: 'user', text: 'I eat pasta', t: 2, hint: 3, helper: true, correction: { wrong: 'eat', right: 'ate', category: 'tense', type: 'error', th: 'กินแล้ว', seen: false } },
    { role: 'user', text: 'x', t: 3, hint: 9, correction: { wrong: 'a', right: 'b', category: 'naturalness' } },
    { role: 'model', text: 'y', t: 4, hints: 'not an object', hint: 2 },
  ] });
  const [bot, u1, u2, bot2] = s.messages;
  if (bot.hints?.vocab[0].word !== 'pasta' || bot.hints.example !== 'I had pasta.') throw new Error('hints lost');
  if (u1.hint !== 3 || !u1.helper || u1.correction.type !== 'error' || u1.correction.th !== 'กินแล้ว' || u1.correction.seen !== false) throw new Error('user fields lost ' + JSON.stringify(u1));
  if ('hint' in u2 || u2.correction.type !== 'unnatural' || 'seen' in u2.correction) throw new Error('bad values kept ' + JSON.stringify(u2));
  if ('hints' in bot2 || 'hint' in bot2) throw new Error('model message kept bad hint fields');
});
await test('new settings have defaults and quality counters are cleaned', async () => {
  for (const [k, v] of Object.entries({ mode: 'natural', length: 'normal', teaching: 'medium', correctionTiming: 'after_turn' })) {
    if (S.DEFAULT_SETTINGS[k] !== v) throw new Error(k);
  }
  const s = S.normalizeState({ quality: { replies: 5, tooLong: '2', evil: 9, invented: -1 } });
  if (JSON.stringify(s.quality) !== '{"replies":5,"tooLong":2}') throw new Error(JSON.stringify(s.quality));
});
await test('running scene: progress fields are cleaned, old scenes get defaults', async () => {
  let s = S.normalizeState({ scene: { id: 'cafe', th: 'คาเฟ่', char: 'emma', total: 5, step: 9, done: 'yes', variant: 'brutal' } });
  if (s.scene.step !== 5 || s.scene.done !== false || s.scene.variant !== 'normal' || s.scene.total !== 5) throw new Error(JSON.stringify(s.scene));
  s = S.normalizeState({ scene: { id: 'hotel', th: 'โรงแรม' } });   // saved before Phase 2
  if (s.scene.total !== 0 || s.scene.step !== 0 || s.scene.char !== 'buddy') throw new Error(JSON.stringify(s.scene));
});
await test('voice practice records are validated', async () => {
  const s = S.normalizeState({ voice: { abc1: { kind: 'shadow', best: 1.7, n: 2, t: 5 }, zz: { kind: 'listen', best: null, n: 1, t: 6 }, 'bad key!': { kind: 'shadow' }, x9: { kind: 'other' } } });
  if (JSON.stringify(s.voice) !== '{"zz":{"kind":"listen","best":null,"n":1,"t":6},"abc1":{"kind":"shadow","best":1,"n":2,"t":5}}') throw new Error(JSON.stringify(s.voice));
});
await test('addResult keeps up to the results limit', async () => {
  S.replaceState({});
  for (let i = 0; i < 60; i++) S.addResult({ t: i, scene: 's', score: 5 });
  if (S.state.results.length !== 60) throw new Error('results ' + S.state.results.length);
});

done();
