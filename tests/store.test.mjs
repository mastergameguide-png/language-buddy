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
await test('addResult keeps up to the results limit', async () => {
  S.replaceState({});
  for (let i = 0; i < 60; i++) S.addResult({ t: i, scene: 's', score: 5 });
  if (S.state.results.length !== 60) throw new Error('results ' + S.state.results.length);
});

done();
