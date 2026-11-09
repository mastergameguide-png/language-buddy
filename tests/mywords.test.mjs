// 📥 My words: pasted lists, the queue (orange before pink), the daily limit, the AI prompts and
// strict parsing, gap-fill practice, saving and sync. Run: node tests/mywords.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const M = await import('../js/engine/mywords.js');
const { test, done } = suite('mywords');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

await test('pasted lists: Thai meanings keep their commas; POS and level marks are dropped', async () => {
  const r = M.parsePasted('adhere v. C1 ยึดถือ, ปฏิบัติตาม\nallegation n. C1 - ข้อกล่าวหา\naccountable adj. C1\nabolish, absurd\ncomply with = ทำตาม\n123\nwell-being n. B2 สุขภาวะ\nverdict\tคำตัดสิน');
  assert.deepEqual(r, [
    { word: 'adhere', th: 'ยึดถือ, ปฏิบัติตาม' }, { word: 'allegation', th: 'ข้อกล่าวหา' }, { word: 'accountable', th: '' },
    { word: 'abolish', th: '' }, { word: 'absurd', th: '' }, { word: 'comply with', th: 'ทำตาม' }, { word: 'well-being', th: 'สุขภาวะ' }, { word: 'verdict', th: 'คำตัดสิน' },
  ]);
  assert.deepEqual(M.parsePasted(''), []);
});

await test('queue: no repeats (also against the word bank); orange comes before pink', async () => {
  let r = M.addToQueue(null, [{ word: 'adhere' }, { word: 'Adhere' }, { word: 'vessel' }], 'pink', ['Vessel'], 1);
  assert.equal(r.added, 1); assert.equal(r.skipped, 2);
  r = M.addToQueue(r.my, [{ word: 'allegation', color: 'orange' }, { word: 'verdict' }], 'pink', [], 2);
  assert.deepEqual(M.ordered(r.my.queue).map((q) => q.word), ['allegation', 'adhere', 'verdict']);
});

await test('daily limit: only perDay words a day; released words leave the queue for good', async () => {
  let my = M.cleanMyWords({ perDay: 5 });
  my = M.addToQueue(my, 'a1 a2 a3 a4 a5 a6 a7'.split(' ').map((w, i) => ({ word: `word${'abcdefg'[i]}` })), 'pink').my;
  assert.equal(M.nextBatch(my, '2026-11-09').length, 5);
  my.done = M.nextBatch(my, '2026-11-09').map((q) => ({ ...q, day: '2026-11-09' }));
  assert.equal(M.leftToday(my, '2026-11-09'), 0);
  assert.equal(M.nextBatch(my, '2026-11-09').length, 0);
  assert.equal(M.leftToday(my, '2026-11-10'), 5, 'a new day starts again');
  assert.equal(M.cleanMyWords({ perDay: 99 }).perDay, 10, 'only 5, 10 or 15');
});

await test('photo prompt asks only for highlighted words, their colour and the handwritten Thai', async () => {
  for (const must of [/ONLY the words that are covered by a highlighter/, /"orange"/, /"pink"/, /handwritten Thai/, /Do not add words that are not in the photo/]) assert.match(M.EXTRACT_PROMPT, must);
  const r = M.parseExtract('```json\n{"words":[{"word":"allegation n. C1","color":"orange","th":"ข้อกล่าวหา"},{"word":"vessel","color":"red"},{"word":"vessel","color":"pink"},{"word":"<b>x</b>","color":"pink"},{"word":"accountable","color":"yellow"}]}\n```');
  assert.deepEqual(r, [{ word: 'allegation', color: 'orange', th: 'ข้อกล่าวหา' }, { word: 'vessel', color: 'none', th: '' }, { word: 'accountable', color: 'none', th: '' }]);
  assert.deepEqual(M.parseExtract('not json'), []);
});

await test('enrich prompt and reply: police-style example that really contains the word', async () => {
  const asked = [{ word: 'adhere', th: 'ยึดถือ' }, { word: 'allege', th: '' }];
  const p = M.buildEnrichPrompt(asked, 'B1');
  assert.match(p, /adhere \(learner's Thai: ยึดถือ\)/); assert.match(p, /police, law or public-safety/); assert.match(p, /confusable/); assert.match(p, /tip_th/);
  const raw = JSON.stringify({ words: [
    { word: 'adhere', pos: 'V', th: 'ยึดถือ ปฏิบัติตาม', example: 'Officers must adhere to the rules.', collocation: 'adhere to the rules', family: 'adherence', confusable: 'adjacent = ติดกัน', tip_th: 'ad + here ติดอยู่ตรงนี้' },
    { word: 'allege', pos: 'v', th: 'กล่าวหา', example: 'He said nothing.' },
    { word: 'other', th: 'x', example: 'other' },
  ] });
  const r = M.parseEnrich(raw, asked);
  assert.deepEqual(Object.keys(r), ['adhere', 'allege'], 'words that were not asked for are dropped');
  assert.equal(r.adhere.pos, 'v');
  assert.equal(r.allege.example, '', 'an example without the word is dropped');
});

await test('gap-fill practice: four options, the answer is the word, the sentence has a gap', async () => {
  const d = (word, pos, example) => ({ word, pos, th: 'ไทย', example });
  const done = [d('adhere', 'v', 'Officers must adhere to the rules.'), d('allege', 'v', 'The man allegedly stole a car.'), d('verdict', 'n', 'The jury reached a verdict.'), d('vessel', 'n', 'The vessel left the port.'), d('vague', 'adj', 'He gave a vague answer.')];
  const qs = M.buildQuiz(done, 5, () => 0.3);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.answer], q.word); assert.ok(q.q.includes('___') && !q.q.toLowerCase().includes(q.word.toLowerCase()));
  }
  assert.deepEqual(M.buildQuiz(done.slice(0, 3)), [], 'needs at least 4 words');
  assert.equal(M.blankOut('He was accused of fraud.', 'accuse'), 'He was ___ of fraud.');
});

await test('saving and merging two devices keeps every released word once', async () => {
  const a = { perDay: 10, queue: [{ word: 'adhere', color: 'pink', t: 1 }, { word: 'vessel', color: 'orange', t: 2 }], done: [{ word: 'verdict', day: '2026-11-08' }] };
  const b = { queue: [{ word: 'vague', t: 3 }], done: [{ word: 'adhere', day: '2026-11-09' }, { word: 'verdict', day: '2026-11-08' }] };
  const m = M.mergeMyWords(a, b);
  assert.deepEqual(m.done.map((d) => d.word), ['verdict', 'adhere']);
  assert.deepEqual(m.queue.map((q) => q.word), ['vessel', 'vague'], 'a word released on the other device leaves the queue');
  assert.deepEqual(M.cleanMyWords(null), { perDay: 10, queue: [], done: [] });
});

await test('wiring: page, links, offline files, saved, synced; photos never stored', async () => {
  const main = src('js/main.js'), html = src('index.html'), sw = src('sw.js'), store = src('js/store.js'), sync = src('js/sync.js'), view = src('js/views/mywords.js');
  assert.match(main, /mywords: \{ el: 'view-mywords', render: \(\) => renderMyWords\(\$\('mywordsBody'\)\)/);
  assert.match(html, /id="view-mywords"[\s\S]*?id="mywordsBody"/);
  for (const f of ['js/engine/mywords.js', 'js/views/mywords.js']) assert.ok(sw.includes(`'${f}'`), f);
  assert.match(store, /s\.mywords = cleanMyWords\(s\.mywords\)/);
  assert.match(sync, /state\.mywords = mergeMyWords\(state\.mywords, v\)/);
  assert.match(src('js/views/review.js'), /href: '#mywords'/);
  assert.match(src('js/views/daily.js'), /href: '#mywords'/);
  assert.ok(!/photoData|state\.\w*photo/i.test(view), 'a photo is kept');
  assert.match(view, /preparePhoto\(f, \{ maxSide: 2000 \}\)/);
  assert.equal((view.match(/askIelts\(/g) || []).length, 1, 'one AI request per batch');
});

done();
