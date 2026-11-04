// Phase 3 voice practice: word comparison, phrases, practice/listening items, answer checking,
// progress records, and the speech provider interfaces. Run: node tests/voice.test.mjs
import assert from 'node:assert/strict';
import { suite } from './helpers.mjs';
import {
  tokenKeys, compareWords, splitPhrases, practiceItems, listeningItems, checkAnswer, recordAttempt, itemKey, VOICE_KEEP,
} from '../js/engine/shadowing.js';
import { browserTts, tts, setTtsProvider, pickVoice } from '../js/voice/tts.js';
import { browserStt, stt, setSttProvider } from '../js/voice/stt.js';

const { test, done } = suite('voice');

await test('keys ignore case and punctuation, expand contractions and number words', async () => {
  assert.deepEqual(tokenKeys("I'm"), ['i', 'am']);
  assert.deepEqual(tokenKeys('Five,'), ['5']);
  assert.deepEqual(tokenKeys('“Hello!”'), ['hello']);
  assert.deepEqual(tokenKeys("don't"), ['do', 'not']);
  assert.deepEqual(tokenKeys("Tony's"), ['tony']);
});
await test('compareWords marks heard and missed words in order', async () => {
  const r = compareWords('Could I get a large latte, please?', 'could i get large latte please');
  assert.deepEqual(r.words.map((w) => w.ok), [true, true, true, false, true, true, true]);
  assert.equal(r.matched, 6); assert.equal(r.total, 7);
  assert.equal(compareWords("I'm five years old.", 'I am 5 years old').ratio, 1);
  assert.equal(compareWords('the cat and the dog', 'the dog').matched, 2);   // order-aware, no double counting
  assert.equal(compareWords('Hello there', '').ratio, 0);
  assert.equal(compareWords('Hi — there', 'hi there').total, 2);            // the dash is not a word
});
await test('extra words are counted separately', async () => {
  assert.equal(compareWords('I like tea', 'I really like tea a lot').extra, 3);
});
await test('phrases are short and keep every word', async () => {
  const s = 'I usually go to the gym after work, but today I am too tired because I worked late.';
  const p = splitPhrases(s);
  assert.ok(p.length >= 3 && p.every((x) => x.split(' ').length <= 6), JSON.stringify(p));
  assert.equal(p.join(' ').replace(/\s+/g, ' '), s);
  assert.deepEqual(splitPhrases('Hello there.'), ['Hello there.']);
});
await test('practice items: mistakes first, deduped, placeholders and long lines skipped', async () => {
  const items = practiceItems({
    mistakes: [{ wrong: 'I go', right: 'I went', natural: 'I went to school yesterday.', th: 'ฉันไปโรงเรียนเมื่อวาน' }],
    vocab: [{ word: 'commute', meaning: 'การเดินทาง', example: 'My commute takes an hour.' }, { word: 'x', example: 'I went to school yesterday.' }],
    messages: [{ role: 'model', text: 'Nice! Where did you go after that? I love that place.' }, { role: 'user', text: 'I went home after school today.' }],
    expressions: ['Could I get a…, please?', 'That\'s all, thanks.'],
  });
  assert.equal(items[0].source, 'mistake'); assert.equal(items[0].th, 'ฉันไปโรงเรียนเมื่อวาน');
  assert.equal(items.filter((i) => i.text === 'I went to school yesterday.').length, 1);
  assert.ok(items.some((i) => i.source === 'chat' && i.text === 'Where did you go after that?'));
  assert.ok(!items.some((i) => i.text.includes('…')) && !items.some((i) => i.text.startsWith('I went home')));
  assert.ok(items.some((i) => i.source === 'scenario'));
  // Emoji split chat sentences and are left out.
  const em = practiceItems({ messages: [{ role: 'model', text: "Hey! I'm Sam 😊 What did you do today?" }] });
  assert.deepEqual(em.map((i) => i.text), ['What did you do today?']);
});
await test('listening items: gap-fill from examples, dictation from sentences', async () => {
  const items = listeningItems({
    vocab: [{ word: 'commute', meaning: 'การเดินทาง', example: 'My commute takes an hour.' }, { word: 'cozy', example: 'Nice weather.' }],
    mistakes: [{ right: 'I went', natural: 'I went to school yesterday.' }],
  });
  const gap = items.find((i) => i.kind === 'gap');
  assert.equal(gap.prompt, 'My _____ takes an hour.'); assert.equal(gap.answer, 'commute');
  assert.ok(!items.some((i) => i.text === 'Nice weather.'));            // the word is not in its example
  assert.ok(items.some((i) => i.kind === 'dictation' && i.answer === 'I went to school yesterday.'));
});
await test('answers: case/punctuation ignored, one typo is "close", dictation word by word', async () => {
  const gap = { kind: 'gap', answer: 'commute' };
  assert.deepEqual(checkAnswer(gap, ' Commute. '), { ok: true, close: false });
  assert.deepEqual(checkAnswer(gap, 'comute'), { ok: false, close: true });
  assert.deepEqual(checkAnswer(gap, 'car'), { ok: false, close: false });
  assert.deepEqual(checkAnswer(gap, ''), { ok: false, close: false });
  const d = { kind: 'dictation', answer: "I'm going to the market." };
  assert.equal(checkAnswer(d, 'i am going to the market').ok, true);
  const near = checkAnswer(d, 'I am going to market');
  assert.equal(near.ok, false); assert.equal(near.close, true);
  assert.equal(checkAnswer(d, 'I am going to the big market').ok, false);   // an extra word is not perfect
});
await test('progress records keep the best ratio and stay capped', async () => {
  let v = recordAttempt({}, 'a', 'shadow', 0.5, 1);
  v = recordAttempt(v, 'a', 'shadow', 0.9, 2);
  v = recordAttempt(v, 'a', 'shadow', 0.4, 3);
  v = recordAttempt(v, 'a', 'shadow', null, 4);                              // self-check without speech recognition
  assert.deepEqual(v.a, { kind: 'shadow', best: 0.9, n: 4, t: 4 });
  for (let i = 0; i < VOICE_KEEP + 10; i++) v = recordAttempt(v, 'k' + i, 'listen', 1, 10 + i);
  assert.equal(Object.keys(v).length, VOICE_KEEP); assert.ok(!v.a && v['k' + (VOICE_KEEP + 9)]);
  assert.equal(itemKey('Hello, there!'), itemKey('hello there'));
});
await test('providers declare honest capabilities and can be replaced', async () => {
  assert.equal(browserStt.capabilities.pronunciationScore, false);
  assert.equal(browserTts.capabilities.voiceGender, false);
  assert.equal(browserTts.available(), false);   // no browser in Node: the app falls back quietly
  assert.equal(browserStt.available(), false);
  assert.equal(await browserTts.speak('hi'), undefined);
  const fake = { id: 'fake', available: () => true, capabilities: {}, speak: async () => 'spoken', cancel() {}, speaking: () => false };
  setTtsProvider(fake); assert.equal(tts().id, 'fake'); assert.equal(await tts().speak('x'), 'spoken');
  setTtsProvider({ nope: true }); assert.equal(tts().id, 'fake');            // invalid providers are ignored
  setTtsProvider(browserTts);
  setSttProvider({ id: 'x', start: () => true }); assert.equal(stt().id, 'x'); setSttProvider(browserStt);
  const voices = [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Samantha (Enhanced)', lang: 'en-US' }, { name: 'Karen', lang: 'en_AU' }];
  assert.equal(pickVoice(voices, 'en-GB').name, 'Daniel');
  assert.equal(pickVoice(voices, 'en-US').name, 'Samantha (Enhanced)');
  assert.equal(pickVoice(voices, 'ja-JP'), null);
});

done();
