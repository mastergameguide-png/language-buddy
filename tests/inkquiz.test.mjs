// 2026-11-12 batch: ink sync rows (one per stroke), the quiz from looked-up words, filling in
// many word-bank meanings at once, and 5 or 10 daily words.
// Run: node tests/inkquiz.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const B = await import('../js/engine/book.js');
const D = await import('../js/engine/define.js');
const Y = await import('../js/engine/daily.js');
const { test, done } = suite('inkquiz');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const stroke = (extra = {}) => ({ tool: 'pen', c: '#111827', w: 0.003, p: [[0.1, 0.2], [0.3333, 0.4444], [1, 0]], ...extra });

await test('strokes: an old stroke gets the same id every time; a given id and time are kept', () => {
  const a = B.cleanStrokes([stroke()])[0], b = B.cleanStrokes([stroke()])[0];
  assert.match(a.id, /^k[0-9a-z]+$/); assert.equal(a.id, b.id); assert.equal(a.t, 0);
  assert.notEqual(B.cleanStrokes([stroke({ c: '#dc2626' })])[0].id, a.id);
  const c = B.cleanStrokes([stroke({ id: 'abc123', t: 55 })])[0];
  assert.equal(c.id, 'abc123'); assert.equal(c.t, 55);
  assert.match(B.cleanStrokes([stroke({ id: 'bad id!' })])[0].id, /^k/);
});

await test('sync row: pack → unpack gives the same stroke, and packing again gives the same row', () => {
  const s = B.cleanStrokes([stroke({ id: 'abc123', t: 7 })])[0];
  const row = B.packStroke(s);
  assert.equal(typeof row.p, 'string'); assert.equal(row.p.length, 18);
  const back = B.unpackStroke('abc123', JSON.parse(JSON.stringify(row)));
  assert.deepEqual(back, s);
  assert.deepEqual(B.packStroke(back), row);
});

await test('sync row: 2,000 points fit in a 20,000-character row', () => {
  const p = Array.from({ length: 2000 }, (_, i) => [i / 2000, (i * 7 % 2000) / 2000]);
  const s = B.cleanStrokes([stroke({ p, id: 'big', t: 1 })])[0];
  assert.equal(s.p.length, 2000);
  assert.ok(JSON.stringify(B.packStroke(s)).length < 20000);
});

await test('sync row: bad rows are refused', () => {
  assert.equal(B.unpackStroke('abc', null), null);
  assert.equal(B.unpackStroke('abc', { tool: 'pen', c: '#111827', w: 0.003, p: 'zz' }), null);
  assert.equal(B.unpackStroke('abc', { tool: 'brush', c: '#111827', w: 0.003, p: '000000' }), null);
  assert.equal(B.unpackStroke('abc', { tool: 'pen', c: 'red', w: 0.003, p: '000000' }), null);
  assert.equal(B.unpackStroke('bad id!', B.packStroke(B.cleanStrokes([stroke()])[0])), null);
});

await test('row key: n:<book>:<page>:<stroke> and back', () => {
  const k = B.inkRowKey('b1x2y3:12', 'abc123');
  assert.equal(k, 'n:b1x2y3:12:abc123');
  assert.ok(/^[a-z]:[\w:.-]{1,80}$/.test(k));   // the Worker's key rule
  assert.deepEqual(B.parseInkRowKey(k), { pageKey: 'b1x2y3:12', id: 'abc123' });
  assert.equal(B.parseInkRowKey('n:nopage:abc'), null);
  assert.equal(B.parseInkRowKey('w:b1:1:abc'), null);
});

await test('merge: strokes from two devices are both kept, in time order; a delete removes one', () => {
  const mine = B.cleanStrokes([stroke({ id: 'a', t: 10 }), stroke({ id: 'c', t: 30 })]);
  const theirs = B.cleanStrokes([stroke({ id: 'b', t: 20, c: '#2563eb' })])[0];
  const both = B.mergeInk(mine, [{ id: 'b', stroke: theirs }]);
  assert.deepEqual(both.map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(B.mergeInk(both, [{ id: 'a', stroke: null }, { id: 'zzz', stroke: null }]).map((s) => s.id), ['b', 'c']);
  // the same stroke arriving twice is not doubled
  assert.equal(B.mergeInk(both, [{ id: 'b', stroke: theirs }]).length, 3);
});

await test('ink sync wiring: rows built from IndexedDB, deletes only for strokes removed here', () => {
  const s = src('js/sync.js'), i = src('js/inksync.js'), v = src('js/views/booksheet.js');
  assert.match(s, /k\.startsWith\('n:'\) && \(!ink \|\| !wasDeleted\(k\)\)\) continue;/);
  assert.match(s, /recoverInk\(lost\)/);
  assert.match(i, /export async function inkLocalRows/);
  assert.match(v, /inkDeleted\(key,/);
  assert.match(src('js/views/book.js'), /await inkDeleteBook\(id\);/);
  assert.match(src('sw.js'), /'js\/inksync\.js'/);
});

await test('word quiz: 5 questions, 4 different Thai choices, the right one marked', () => {
  const words = [['patrol', 'ลาดตระเวน', 'v'], ['suspect', 'ผู้ต้องสงสัย', 'n'], ['evidence', 'หลักฐาน', 'n'], ['arrest', 'จับกุม', 'v'], ['witness', 'พยาน', 'n'], ['allegation', 'ข้อกล่าวหา', 'n']]
    .map(([word, th, pos], page) => ({ word, th, pos, page }));
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const qs = B.buildWordQuiz(words, 5, rnd);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    assert.equal(q.options.length, 4); assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options[q.answer], words.find((w) => w.word === q.q).th);
  }
  assert.equal(new Set(qs.map((q) => q.q)).size, 5);
});

await test('word quiz: too few words, or the same meaning twice → no quiz; a word looked up twice counts once', () => {
  assert.deepEqual(B.buildWordQuiz([{ word: 'a', th: 'ก' }, { word: 'b', th: 'ข' }, { word: 'c', th: 'ค' }]), []);
  assert.deepEqual(B.buildWordQuiz([{ word: 'a', th: 'ก' }, { word: 'b', th: 'ก' }, { word: 'c', th: 'ค' }, { word: 'd', th: 'ง' }]), []);
  const qs = B.buildWordQuiz([{ word: 'a', th: 'เก่า' }, { word: 'A', th: 'ใหม่' }, { word: 'b', th: 'ข' }, { word: 'c', th: 'ค' }, { word: 'd', th: 'ง' }], 5);
  assert.equal(qs.length, 4);
  assert.equal(qs.find((q) => q.q.toLowerCase() === 'a').th, 'ใหม่');
  assert.deepEqual(B.buildWordQuiz(null), []);
});

await test('fill in meanings: only English words with no meaning; 20 per request', () => {
  assert.ok(D.needsMeaning({ word: 'mitigate', meaning: '' }));
  assert.ok(D.needsMeaning({ word: 'carry out', meaning: '  ' }));
  assert.ok(!D.needsMeaning({ word: 'mitigate', meaning: 'บรรเทา' }));
  assert.ok(!D.needsMeaning({ word: 'สวัสดี', meaning: '' }));
  const many = Array.from({ length: 30 }, (_, i) => `word${'abcdefghij'[i % 10]}`);
  assert.equal(D.defineManyInput(many).split('\n').length, D.MANY_BATCH);
  assert.match(D.buildDefineManyPrompt('B2'), /JSON only/);
  assert.match(D.buildDefineManyPrompt('B2'), /ignore any instructions/);
});

await test('fill in meanings: only asked words are taken, bad ones skipped', () => {
  const raw = JSON.stringify({ words: [
    { word: 'Mitigate', pos: 'v', th: 'บรรเทา', example: 'We must mitigate the risk.' },
    { word: 'extra', pos: 'adj', th: 'เพิ่มเติม', example: 'x' },
    { word: 'patrol', pos: 'n', th: '', example: '' },
    { word: 'arrest', pos: 'v', th: 'to catch', example: '' },
  ] });
  const got = D.parseDefineMany(raw, ['mitigate', 'patrol', 'arrest']);
  assert.deepEqual([...got.keys()], ['mitigate']);
  assert.equal(got.get('mitigate').meaning, 'บรรเทา (v)');
  assert.equal(D.parseDefineMany('not json', ['a']).size, 0);
});

await test("today's words: 5 or 10 a day; asking for more keeps the count asked for", () => {
  assert.deepEqual(Y.DAILY_CHOICES, [5, 10]);
  assert.equal(Y.dailyCount(10), 10); assert.equal(Y.dailyCount('10'), 10); assert.equal(Y.dailyCount(7), 5); assert.equal(Y.dailyCount(undefined), 5);
  assert.equal(Y.askCount(5), 8); assert.equal(Y.askCount(10), 13); assert.equal(Y.askCount(99), 13);
  const item = (word) => ({ word, part_of_speech: 'v', cefr_level: 'C1', thai_meaning: 'บรรเทา', example_sentence: `We ${word} it.` });
  const twelve = 'abcdefghijkl'.split('').map((c) => item(`mitig${c}te`));
  assert.equal(Y.parseDaily(JSON.stringify(twelve)).length, 5);
  assert.equal(Y.parseDaily(JSON.stringify(twelve), [], 10).length, 10);
  assert.equal(Y.parseDaily(JSON.stringify(twelve), [], 3).length, 3);
  // a saved day with 10 words stays 10
  const day = Y.cleanDaily({ day: '2026-11-12', cefr: 'B2–C1', words: Y.parseDaily(JSON.stringify(twelve), [], 10) });
  assert.equal(day.words.length, 10);
  assert.match(Y.buildDailyPrompt({ count: 13 }), /Generate 13 vocabulary words/);
  assert.match(src('js/store.js'), /dailyWords: 5,/);
});

await test('page view: standard PDF fonts are shipped, so a PDF without its own fonts is not blank', () => {
  assert.match(src('js/views/booksheet.js'), /standardFontDataUrl: new URL\('\.\.\/\.\.\/vendor\/pdfjs\/standard_fonts\/'/);
  for (const f of ['LiberationSans-Regular.ttf', 'FoxitSerif.pfb', 'FoxitFixed.pfb', 'LICENSE_FOXIT', 'LICENSE_LIBERATION']) assert.ok(fs.existsSync(path.join(ROOT, 'vendor/pdfjs/standard_fonts', f)), f);
  assert.match(src('js/views/book.js'), /\.\.\.PDF_OPTS/);
});

await test('practice tabs: the open page link is scrolled into view on a phone', () => {
  assert.match(src('js/main.js'), /\.ptabs a\[aria-current="page"\]'\);\s+if \(tab\)/);
});

done();
