// Speaking help: the no-accent note, 💡 sentence starters and the 🎲 random drill
// (1 minute to think, up to 5 minutes to talk). Run: node tests/speaking-help.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, ROOT } from './helpers.mjs';

const I = await import('../js/engine/ielts.js');
const { test, done } = suite('speaking-help');
const learn = fs.readFileSync(path.join(ROOT, 'js/views/learn.js'), 'utf8');

await test('note: says accent and pronunciation are not checked', async () => {
  assert.match(I.NO_ACCENT_NOTE, /ไม่ตรวจสำเนียง/);
  assert.match(learn, /NO_ACCENT_NOTE\)/);
  // the feedback prompt still never judges pronunciation
  assert.match(I.buildSpeakingPrompt({ part: 1, question: 'Q?' }), /never judge pronunciation/);
});

await test('hints exist for every question in every part, with a Thai plan and starters', async () => {
  const items = [
    ...I.PART1.flatMap((t) => t.qs.map((q) => ({ part: 1, topic: t, question: q }))),
    ...I.CUE_CARDS.map((c) => ({ part: 2, card: c, question: c.title })),
    ...I.CUE_CARDS.flatMap((c) => c.part3.map((q) => ({ part: 3, card: c, question: q }))),
  ];
  for (const it of items) {
    const h = I.speakingHints(it);
    assert.ok(h.plan.length >= 3 && h.plan.every((p) => /[฀-๿]/.test(p)), it.question);
    assert.ok(h.starters.length >= 4 && h.starters.every((s) => /^[A-Z]/.test(s)), it.question);
    assert.equal(new Set(h.starters).size, h.starters.length, `duplicate starter: ${it.question}`);
  }
});

await test('starters fit the kind of question', async () => {
  const st = (part, question) => I.speakingHints({ part, question }).starters[0];
  assert.match(st(1, 'Do you often cook at home?'), /^Yes, I do/);
  assert.match(st(1, 'How often do you use your phone each day?'), /often/i);
  assert.match(st(1, 'Would you like to study abroad?'), /^I'd love to/);
  assert.match(st(3, 'Why do some people give up learning new things?'), /reason/);
  assert.match(st(3, 'Should parents make important decisions for their children?'), /I think so/);
  assert.match(st(1, 'What kind of food do you enjoy most?'), /I'd say/);
  assert.ok(I.speakingHints({ part: 3, question: 'Why?' }).starters.includes('Compared to the past,…'));
});

await test('tapping a starter adds only its opening words', async () => {
  assert.equal(I.starterText('Yes, I do, mainly because…'), 'Yes, I do, mainly because ');
  assert.equal(I.starterText('My favourite is… because…'), 'My favourite is ');
  assert.equal(I.starterText("It depends. On the one hand,… On the other hand,…"), 'It depends. On the one hand, ');
});

await test('random drill: any part, 1 minute to think, 5 minutes to talk', async () => {
  assert.equal(I.DRILL_THINK, 60);
  assert.equal(I.DRILL_TALK, 300);
  const parts = new Set();
  for (let i = 0; i < 30; i++) {
    const it = I.pickDrill(i / 30, (i * 7 % 30) / 30);
    parts.add(it.part);
    assert.ok(it.question && [1, 2, 3].includes(it.part));
  }
  assert.deepEqual([...parts].sort(), [1, 2, 3]);
  assert.equal(I.pickDrill(0.99, 0.5).part, 3);
});

await test('page wiring: drill uses the 5-minute talk, can stop early, stops the mic; hint box is a toggle', async () => {
  assert.match(learn, /const talkSecs = \(\) => \(sp\.drill \? DRILL_TALK : 120\)/);
  assert.match(learn, /startTimer\('prep', DRILL_THINK, root\)/);
  assert.match(learn, /startTimer\('talk', talkSecs\(\), root\)/);
  assert.ok(!/startTimer\('talk', 120/.test(learn), 'a fixed 2-minute talk is left');
  assert.match(learn, /'พูดเสร็จแล้ว'/);
  assert.match(learn, /else if \(timer\.phase === 'talk'\) \{ stopTimer\(\); if \(micOn\) \{ micOn = false; stopListening\(\); \} \}/);
  assert.match(learn, /'aria-pressed': String\(!!sp\.drill\)/);
  assert.match(learn, /'aria-expanded': String\(!!sp\.hint\)/);
  assert.match(learn, /'aria-label': `เพิ่มประโยคขึ้นต้น: \$\{s\}`/);
});

done();
