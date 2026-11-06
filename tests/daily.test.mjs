// 📘 Daily words: level one step up, the prompt (based on the owner's Gemini prompt), strict
// parsing of the AI reply, skipping known words, saving the day's set, and the page wiring.
// Run: node tests/daily.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const D = await import('../js/engine/daily.js');
const { test, done } = suite('daily');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const item = (word, extra = {}) => ({
  word, part_of_speech: 'v', cefr_level: 'C1', thai_meaning: 'บรรเทา', academic_synonyms: ['alleviate', 'reduce'],
  common_collocations: ['mitigate the risk'], example_sentence: `Governments must ${word} the effects of climate change.`, usage_note: 'ใช้กับปัญหา', ...extra,
});

await test('level: one step above the learner (C2 stays C2); band one half up', async () => {
  assert.deepEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(D.targetCefr), ['A2', 'B1', 'B2', 'C1', 'C2', 'C2']);
  assert.equal(D.targetCefr('??'), 'A2');
  assert.equal(D.targetBandOf('6.5'), '7.0');
  assert.equal(D.targetBandOf('9.0'), '9.0');
  assert.equal(D.targetBandOf(null), null);
});

await test('prompt: owner fields kept, level follows the learner, known words excluded', async () => {
  const p = D.buildDailyPrompt({ cefr: 'B1', exclude: ['mitigate', 'pivotal'] });
  for (const f of ['word', 'part_of_speech', 'cefr_level', 'thai_meaning', 'academic_synonyms', 'common_collocations', 'example_sentence', 'usage_note']) assert.ok(p.includes(`"${f}"`), f);
  assert.match(p, /mostly CEFR B2/);
  assert.match(p, /Do NOT use any of these words the learner already has: mitigate, pivotal/);
  assert.match(p, /Give exactly 7 different words/, '2 spare words, in case the AI repeats a known one');
  assert.equal(D.ASK_COUNT, D.DAILY_COUNT + 2);
  assert.match(p, /Writing Task 2 and Speaking Part 3/);
  const ielts = D.buildDailyPrompt({ cefr: 'B2', band: '6.5' });
  assert.match(ielts, /IELTS band 6\.5/); assert.match(ielts, /towards IELTS band 7\.0/); assert.match(ielts, /mostly CEFR C1/);
  assert.ok(!/Do NOT use/.test(D.buildDailyPrompt({ cefr: 'B1' })), 'no empty exclude line');
  const many = Array.from({ length: 400 }, (_, i) => `w${i}`);
  assert.ok(!D.buildDailyPrompt({ cefr: 'B1', exclude: many }).includes('w0,'), 'only the latest 150 known words are sent');
});

await test('parse: {"words": [...]}, a bare array and a ```json fence all work', async () => {
  const one = D.parseDaily(JSON.stringify({ words: [item('mitigate')] }));
  assert.equal(one.length, 1);
  assert.deepEqual(one[0], { word: 'mitigate', th: 'บรรเทา', pos: 'v', cefr: 'C1', synonyms: ['alleviate', 'reduce'], collocations: ['mitigate the risk'], example: 'Governments must mitigate the effects of climate change.', note: 'ใช้กับปัญหา' });
  assert.equal(D.parseDaily(JSON.stringify([item('mitigate')])).length, 1);
  assert.equal(D.parseDaily('```json\n' + JSON.stringify([item('mitigate')]) + '\n```').length, 1);
  assert.deepEqual(D.parseDaily('not json'), []);
  assert.deepEqual(D.parseDaily(''), []);
});

await test('parse: bad, repeated and already-known words are dropped; at most 5; fields trimmed', async () => {
  const words = [item('mitigate'), item('Mitigate'), item(''), item('pivotal', { thai_meaning: '' }), item('<b>x</b>'), item('exacerbate', { part_of_speech: 'verb!!', cefr_level: 'Z9', academic_synonyms: 'no' }),
    item('prevalent'), item('profound'), item('comply with'), item('ubiquitous'), item('detrimental'), item('known')];
  const out = D.parseDaily(JSON.stringify(words), ['KNOWN', 'ubiquitous']);
  assert.deepEqual(out.map((w) => w.word), ['mitigate', 'exacerbate', 'prevalent', 'profound', 'comply with']);
  const ex = out[1];
  assert.equal(ex.pos, ''); assert.equal(ex.cefr, ''); assert.deepEqual(ex.synonyms, []);
  const long = D.parseDaily(JSON.stringify([item('mitigate', { example_sentence: 'x'.repeat(900), common_collocations: ['a', 'b', 'c', 'd', 'e'] })]))[0];
  assert.equal(long.example.length, 260);
  assert.equal(long.collocations.length, 3);
});

await test('saved day set: kept when valid, dropped when broken', async () => {
  const words = D.parseDaily(JSON.stringify([item('mitigate'), item('prevalent')]));
  const c = D.cleanDaily({ day: '2026-11-06', cefr: 'B2', words, added: ['mitigate', 'other'] });
  assert.equal(c.words.length, 2);
  assert.deepEqual(c.added, ['mitigate']);
  assert.deepEqual(c.words[0], words[0], 'a saved set survives cleaning unchanged');
  assert.equal(D.cleanDaily({ day: 'today', words }), null);
  assert.equal(D.cleanDaily({ day: '2026-11-06', words: [] }), null);
  assert.equal(D.cleanDaily(null), null);
});

await test('wiring: Home card, one AI request a day through askIelts, words go to the word bank', async () => {
  const view = src('js/views/daily.js'), home = src('js/views/home.js'), store = src('js/store.js'), sw = src('sw.js');
  assert.match(home, /dailyCard\(\(\) => renderHome\(root\)\)/);
  assert.match(view, /if \(!isEnglish\(\)\) return null;/);
  assert.match(view, /state\.daily\?\.day === dayKey\(\)/, 'the set is reused for the rest of the day');
  assert.equal((view.match(/askIelts\(/g) || []).length, 1);
  assert.match(view, /addWord\(\{ word: w\.word/);
  assert.match(view, /AI อาจผิดได้/);
  assert.match(store, /s\.daily = cleanDaily\(s\.daily\)/);
  for (const f of ['js/engine/daily.js', 'js/views/daily.js']) assert.ok(sw.includes(`'${f}'`), f);
  // no change to the AI module was needed
  assert.ok(!src('js/ai.js').includes('engine/daily'));
});

done();
