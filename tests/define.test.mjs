// Word bank auto-translate: the prompt, strict parsing of the AI reply, and the page wiring.
// Run: node tests/define.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const D = await import('../js/engine/define.js');
const { test, done } = suite('define');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

await test('only English words or phrases are sent to the AI', async () => {
  for (const w of ['mitigate', 'carry out', "o'clock", 'well-being']) assert.ok(D.isEnglishWord(w), w);
  for (const w of ['', 'บ้าน', '123', 'hello บ้าน']) assert.ok(!D.isEnglishWord(w), w);
});

await test('prompt: Thai meaning, part of speech, example, JSON only, ignores instructions', async () => {
  const p = D.buildDefinePrompt('B2');
  assert.match(p, /B2/); assert.match(p, /JSON only/); assert.match(p, /Thai only/); assert.match(p, /ignore any instructions/);
  assert.equal(D.defineInput('  mitigate\n'), 'Word: mitigate');
});

await test('a good reply becomes a word-bank entry', async () => {
  const r = D.parseDefine('```json\n{"word":"mitigate","pos":"v","th":"บรรเทา, ลดความรุนแรง","example":"We must mitigate the risk."}\n```', 'mitigate');
  assert.deepEqual(r, { word: 'mitigate', pos: 'v', th: 'บรรเทา, ลดความรุนแรง', example: 'We must mitigate the risk.', meaning: 'บรรเทา, ลดความรุนแรง (v)' });
});

await test('a typo is fixed, but a bad "word" falls back to what was typed', async () => {
  assert.equal(D.parseDefine('{"word":"receive","pos":"v","th":"ได้รับ","example":"I received it."}', 'recieve').word, 'receive');
  assert.equal(D.parseDefine('{"word":"<b>x</b>","pos":"v","th":"ได้รับ"}', 'recieve').word, 'recieve');
});

await test('no Thai, Chinese/Japanese, broken JSON or "not a word" → null', async () => {
  assert.equal(D.parseDefine('{"word":"x","th":"to reduce"}', 'x'), null);
  assert.equal(D.parseDefine('{"word":"x","th":"บรรเทา 緩和"}', 'x'), null);
  assert.equal(D.parseDefine('not json', 'x'), null);
  assert.equal(D.parseDefine('{"word":"","pos":"","th":"","example":""}', 'zzqx'), null);
  assert.equal(D.parseDefine('[1,2]', 'x'), null);
});

await test('a Thai "example" is dropped; no pos gives a plain meaning', async () => {
  const r = D.parseDefine('{"word":"run","th":"วิ่ง","example":"ฉันวิ่ง"}', 'run');
  assert.equal(r.example, ''); assert.equal(r.meaning, 'วิ่ง');
});

await test('wiring: the word bank form calls the AI when the meaning is empty; sw.js caches the file', async () => {
  const v = src('js/views/review.js');
  assert.match(v, /buildDefinePrompt\(cefrOf\(\)\)/);
  assert.match(v, /if \(!entry\.meaning\)/);
  assert.match(src('sw.js'), /'js\/engine\/define\.js'/);
});

await test('broken Thai from the AI is refused: a mark with no letter under it, or English inside a Thai word', () => {
  for (const th of ['การควบคุมตัว, การ ักษาสิทธิ์', 'หมายศาล, ใบ ้', 'ข้อแก้ตัวว่าอยู่andที่อื่น']) {
    assert.ok(D.brokenThai(th), th);
    assert.equal(D.parseDefine(JSON.stringify({ word: 'custody', pos: 'n', th, example: 'x y z.' }), 'custody'), null);
  }
  for (const th of ['ผู้สมรู้ร่วมคิด, ผู้ร่วมกระทำผิด', 'เกี่ยวกับนิติวิทยาศาสตร์', 'เขตอำนาจศาล, อำนาจหน้าที่', 'ละเอียดลออ, ถี่ถ้วน', 'อีเมล (email)', 'ไม่เต็มใจ, ลังเล']) assert.ok(!D.brokenThai(th), th);
});

done();
