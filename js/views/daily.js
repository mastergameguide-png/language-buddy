// 📘 Today's words card (Home, English only). The learner taps to make today's 5 B2–C1 words (one
// AI request a day; words given on earlier days never come back); the set is kept for the day, so
// reopening the app does not ask the AI again. Each word can go into the word bank, where it is
// reviewed with the other cards. Then ✍️ the learner writes a short article using all five; one
// AI request scores it (vocabulary, grammar, order, content) and shows the corrected article.
import { el, h, icon, toast, dayKey, num } from '../util.js';
import { settings, saveSettings, state, persist, isEnglish, cefrOf, ieltsBand, addWord, logActivity } from '../store.js';
import { recordWord, recordMessage } from '../stats.js';
import { askIelts } from '../ai.js';
import { speak, unlockSpeech } from '../speech.js';
import {
  buildDailyPrompt, parseDaily, DAILY_CHOICES, dailyCount, askCount, LEVEL_TEXT, cleanSeen, countWords, wordsUsed, buildEssayPrompt, parseEssay,
  CRITERIA, ESSAY_MIN_WORDS, ESSAY_MAX_WORDS, ESSAY_MAX_CHARS,
} from '../engine/daily.js';

let busy = false;
let grading = false;
let writeOpen = false;      // the writing part stays open when the card redraws
const opened = new Set();   // words the learner opened, kept open when the card redraws
const inBank = (w) => state.vocab.some((v) => v.word.toLowerCase() === w.toLowerCase());

export function dailyCard(rerender) {
  if (!isEnglish()) return null;
  const set = state.daily?.day === dayKey() ? state.daily : null;
  const card = h('div', { class: 'card daily' });
  card.append(h('div', { class: 'row' }, el('h2', 'sec grow', '📘 คำศัพท์วันนี้'), el('span', 'chip', `ระดับ ${LEVEL_TEXT}`)));
  card.append(h('a', { class: 'btn sm ghost', href: '#mywords' }, '📥 คำของฉัน (คำที่ท่องแล้วจำไม่ได้)'));

  const want = dailyCount(settings.dailyWords);
  // 5 or 10 words a day. Choosing 10 after today's 5 are out offers 5 more.
  const pick = h('div', { class: 'seg', role: 'group', 'aria-label': 'จำนวนคำต่อวัน' });
  for (const n of DAILY_CHOICES) {
    const b = h('button', { type: 'button', class: n === want ? 'on' : '', 'aria-pressed': String(n === want) }, `${n} คำ/วัน`);
    b.addEventListener('click', () => { if (n === want) return; settings.dailyWords = n; saveSettings(); rerender(); });
    pick.append(b);
  }
  card.append(pick);

  if (!set) {
    card.append(el('p', 'small muted', `AI จะเลือกคำระดับ ${LEVEL_TEXT} วันละ ${want} คำ ไม่ซ้ำกับวันก่อนๆ พร้อมความหมาย คำพ้อง คำที่มักใช้คู่กัน และประโยคตัวอย่าง แล้วให้แต่งบทความด้วยคำเหล่านี้ AI ให้คะแนนและแสดงบทความที่ถูกต้อง`));
    const go = h('button', { type: 'button', class: 'btn primary' }, busy ? 'กำลังเลือกคำ…' : '✨ สร้างคำศัพท์วันนี้');
    go.disabled = busy;
    go.addEventListener('click', () => makeToday(rerender));
    card.append(h('div', { class: 'row wrap-ok' }, go, el('span', 'xs muted', 'ใช้ AI 1 ครั้งต่อวัน')));
    return card;
  }

  for (const w of set.words) {
    const have = inBank(w.word);
    const say = h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': `ฟังคำว่า ${w.word}` }, icon('speaker'));
    say.addEventListener('click', () => { unlockSpeech(); speak(w.word, { plain: true }); });
    const add = h('button', { type: 'button', class: 'btn sm' + (have ? ' ghost' : ''), 'aria-label': have ? `${w.word} อยู่ในคลังคำแล้ว` : `เพิ่ม ${w.word} เข้าคลังคำ` }, have ? '✓ อยู่ในคลังคำ' : '+ คลังคำ');
    add.disabled = have;
    add.addEventListener('click', () => { addToBank([w]); rerender(); });
    // Short by default (word + Thai); tap to open the example, synonyms, note and buttons.
    const item = h('details', { class: 'daily-word' });
    item.open = opened.has(w.word);
    item.addEventListener('toggle', () => { if (item.open) opened.add(w.word); else opened.delete(w.word); });
    item.append(h('summary', {}, h('b', { lang: 'en' }, w.word), w.pos ? el('span', 'xs muted', ` ${w.pos}`) : null, have ? el('span', 'xs', ' ✓') : null, el('span', 'small daily-th', w.th)));
    const body = h('div', { class: 'daily-body' });
    if (w.example) {
      const ex = h('button', { type: 'button', class: 'linkish small', lang: 'en', 'aria-label': `ฟังประโยคตัวอย่าง: ${w.example}` }, `“${w.example}”`);
      ex.addEventListener('click', () => { unlockSpeech(); speak(w.example, { plain: true }); });
      body.append(ex);
    }
    const extra = [w.synonyms.length && `คำพ้อง: ${w.synonyms.join(', ')}`, w.collocations.length && `ใช้คู่กับ: ${w.collocations.join(' · ')}`].filter(Boolean);
    if (extra.length) body.append(h('div', { class: 'xs muted', lang: 'en' }, extra.join('  ·  ')));
    if (w.note) body.append(el('div', 'xs', `💡 ${w.note}`));
    body.append(h('div', { class: 'row wrap-ok' }, say, w.cefr ? el('span', 'chip', w.cefr) : null, h('span', { class: 'grow' }), add));
    item.append(body);
    card.append(item);
  }
  if (set.words.length < want) {
    const need = want - set.words.length;
    const more = h('button', { type: 'button', class: 'btn' }, busy ? 'กำลังเลือกคำ…' : `✨ ขออีก ${need} คำ`);
    more.disabled = busy;
    more.addEventListener('click', () => makeToday(rerender));
    card.append(h('div', { class: 'row wrap-ok' }, more, el('span', 'xs muted', 'ใช้ AI 1 ครั้ง')));
  }
  const left = set.words.filter((w) => !inBank(w.word));
  if (left.length) {
    const all = h('button', { type: 'button', class: 'btn primary' }, `เพิ่มทั้งหมดเข้าคลังคำ (${left.length})`);
    all.addEventListener('click', () => { addToBank(left); rerender(); });
    card.append(all);
  } else card.append(el('p', 'small', '✅ เพิ่มครบแล้ว คำเหล่านี้จะมาให้ทบทวนในหน้า "ทบทวน"'));
  card.append(writeBox(set, rerender));
  card.append(el('p', 'xs muted', 'คำ ความหมาย คะแนน และบทความที่แก้แล้วสร้างโดย AI อาจผิดได้ ถ้าไม่แน่ใจให้เช็คกับพจนานุกรม'));
  return card;
}

// ---------- ✍️ article with today's words ----------
function writeBox(set, rerender) {
  const box = h('details', { class: 'daily-write' });
  box.open = writeOpen || !!set.essay;
  box.addEventListener('toggle', () => { writeOpen = box.open; });
  box.append(h('summary', {}, el('b', '', '✍️ แต่งบทความด้วยคำวันนี้'), set.essay ? el('span', 'chip good', `${set.essay.result.overall}/10`) : el('span', 'xs muted', 'ใช้ AI 1 ครั้ง')));
  const body = h('div', { class: 'daily-body' });
  box.append(body);
  if (set.essay) { body.append(resultView(set, rerender)); return box; }

  body.append(el('p', 'small', `เขียนเรื่องอะไรก็ได้ ${ESSAY_MIN_WORDS}–${ESSAY_MAX_WORDS} คำ ให้มีครบทั้ง ${set.words.length} คำ (เปลี่ยนรูปได้ เช่น -s, -ed, -ing) แบ่งย่อหน้า มีเกริ่นนำ เนื้อเรื่อง และสรุป`));
  const chips = h('div', { class: 'chips' });
  const ta = h('textarea', { class: 'input', rows: '9', lang: 'en', spellcheck: 'false', maxlength: String(ESSAY_MAX_CHARS), 'aria-label': 'บทความที่ใช้คำศัพท์วันนี้', placeholder: 'เริ่มเขียนที่นี่…' });
  ta.value = set.draft || '';
  const count = el('span', 'xs muted', '');
  const send = h('button', { type: 'button', class: 'btn primary' }, grading ? 'กำลังให้คะแนน…' : '📝 ส่งให้ AI ให้คะแนน');
  const update = () => {
    const n = countWords(ta.value);
    const used = wordsUsed(ta.value, set.words);
    chips.textContent = '';
    for (const u of used) chips.append(h('span', { class: 'chip' + (u.used ? ' good' : ''), lang: 'en' }, `${u.used ? '✓' : '○'} ${u.word}`));
    count.textContent = `${num(n)} คำ · ใช้คำวันนี้แล้ว ${used.filter((u) => u.used).length}/${used.length}`;
    send.disabled = grading || n < ESSAY_MIN_WORDS || n > ESSAY_MAX_WORDS;
    return { n, used };
  };
  let saveTimer;
  ta.addEventListener('input', () => {
    update();
    state.daily.draft = ta.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 800);
  });
  send.addEventListener('click', () => {
    const { used } = update();
    const missing = used.filter((u) => !u.used).map((u) => u.word);
    if (missing.length && !confirm(`ยังไม่พบคำ: ${missing.join(', ')}\nส่งให้ AI ตรวจเลยไหม? (คะแนนการใช้คำจะลดลง)`)) return;
    grade(set, ta.value, rerender);
  });
  update();
  body.append(chips, ta, h('div', { class: 'row wrap-ok' }, send, count),
    el('p', 'xs muted', `ต้องมีอย่างน้อย ${ESSAY_MIN_WORDS} คำ · ร่างถูกเก็บไว้ในเครื่องอัตโนมัติ`));
  return box;
}

async function grade(set, text, rerender) {
  if (grading) return;
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต — ร่างยังอยู่ ต่อเน็ตแล้วส่งใหม่', true); return; }
  grading = true; writeOpen = true; rerender();
  try {
    const result = parseEssay(await askIelts(buildEssayPrompt(set.words, cefrOf()), text), set.words);
    if (!result) throw new Error('AI ตอบกลับมาไม่ครบ ลองส่งใหม่อีกครั้ง (ร่างยังอยู่)');
    state.daily.essay = { t: Date.now(), text, result };
    state.daily.draft = '';
    recordMessage(text, result.errors.length > 0, false);
    logActivity('chat', `แต่งบทความด้วยคำวันนี้ ได้ ${result.overall}/10`);
    persist();
  } catch (e) { toast(e.message, true); }
  grading = false; rerender();
}

function resultView(set, rerender) {
  const { text, result: r } = set.essay;
  const wrap = h('div', { class: 'daily-result' });
  const bars = h('div', { class: 'daily-scores' });
  for (const [k, label] of CRITERIA) {
    const v = r.scores[k];
    bars.append(h('div', { class: 'daily-score' }, h('div', { class: 'row' }, el('span', 'small grow', label), el('b', '', `${v}/10`)),
      h('div', { class: 'bar' + (v >= 7 ? ' good' : v < 5 ? ' bad' : ' warn'), role: 'img', 'aria-label': `${label} ${v} จาก 10` }, h('i', { style: `width:${v * 10}%` }))));
  }
  wrap.append(h('div', { class: 'row' }, el('b', 'grow', 'คะแนนรวม'), el('b', 'daily-overall', `${r.overall}/10`)), bars);
  if (r.good) wrap.append(el('p', 'small', `👍 ${r.good}`));
  if (r.improve) wrap.append(el('p', 'small', `🎯 ${r.improve}`));
  if (r.words.length) {
    const list = h('div', { class: 'daily-wnotes' });
    for (const w of r.words) list.append(h('div', { class: 'xs' }, h('b', { lang: 'en' }, `${!w.used ? '○' : w.correct ? '✓' : '✗'} ${w.word}`), w.note ? ` — ${w.note}` : ''));
    wrap.append(el('div', 'small', 'การใช้คำวันนี้'), list);
  }
  if (r.errors.length) {
    const list = h('div', { class: 'daily-errors' });
    for (const e of r.errors) list.append(h('div', { class: 'xs' }, h('s', { lang: 'en' }, e.wrong), ' → ', h('b', { lang: 'en' }, e.right), e.why ? el('div', 'muted', e.why) : null));
    wrap.append(el('div', 'small', `จุดที่ต้องแก้ (${r.errors.length})`), list);
  } else wrap.append(el('p', 'small', '✅ AI ไม่พบข้อผิดพลาดสำคัญ'));

  // The corrected, complete article, with today's words in bold.
  const fixed = h('div', { class: 'daily-corrected', lang: 'en' });
  const re = new RegExp(`\\b(${set.words.map((w) => w.word.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/(e|y)$/i, '')).join('|')})[a-z]*`, 'gi');
  for (const para of r.corrected.split(/\n\s*\n/)) {
    const p = el('p', '');
    let last = 0;
    for (const m of para.matchAll(re)) { p.append(para.slice(last, m.index), el('b', '', m[0])); last = m.index + m[0].length; }
    p.append(para.slice(last));
    fixed.append(p);
  }
  const say = h('button', { type: 'button', class: 'btn sm ghost' }, icon('speaker'), 'ฟังบทความ');
  say.addEventListener('click', () => { unlockSpeech(); speak(r.corrected.replace(/\n+/g, ' '), { plain: true }); });
  const copy = h('button', { type: 'button', class: 'btn sm ghost' }, 'คัดลอก');
  copy.addEventListener('click', () => navigator.clipboard?.writeText(r.corrected).then(() => toast('คัดลอกแล้ว'), () => toast('คัดลอกไม่ได้', true)));
  wrap.append(el('div', 'small', '📄 บทความที่ถูกต้องและสมบูรณ์'), fixed, h('div', { class: 'row wrap-ok' }, say, copy));

  const mine = h('details', { class: 'daily-mine' }, h('summary', { class: 'xs' }, 'ดูบทความที่ฉันเขียน'), h('div', { class: 'xs', lang: 'en', style: 'white-space:pre-wrap' }, text));
  const again = h('button', { type: 'button', class: 'btn sm' }, 'เขียนใหม่');
  again.addEventListener('click', () => {
    if (!confirm('เขียนบทความใหม่? ผลคะแนนครั้งนี้จะถูกแทนที่เมื่อส่งครั้งใหม่')) return;
    state.daily.draft = text; state.daily.essay = null; writeOpen = true; persist(); rerender();
  });
  wrap.append(mine, again);
  return wrap;
}

function addToBank(words) {
  let n = 0;
  for (const w of words) {
    if (addWord({ word: w.word, meaning: w.pos ? `${w.th} (${w.pos})` : w.th, example: w.example })) {
      n += 1;
      recordWord();
      state.daily.added = [...new Set([...(state.daily.added || []), w.word])];
    }
  }
  if (n) { logActivity('word', `คำศัพท์วันนี้: เพิ่ม ${n} คำ`); persist(); toast(`เพิ่ม ${n} คำเข้าคลังคำแล้ว`); }
}

async function makeToday(rerender) {
  if (busy) return;
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต — ต่อเน็ตแล้วลองใหม่', true); return; }
  busy = true; rerender();
  try {
    // Never again: words in the word bank, and every word given on any earlier day.
    const have = [...state.vocab.map((v) => v.word), ...(state.dailySeen || []), ...(state.daily?.words || []).map((w) => w.word)];
    // Today's set is kept when the learner asks for more (5 → 10); only the missing words are asked for.
    const today = state.daily?.day === dayKey() ? state.daily : null;
    const need = dailyCount(settings.dailyWords) - (today?.words.length || 0);
    if (need <= 0) { busy = false; rerender(); return; }
    const prompt = buildDailyPrompt({ cefr: cefrOf(), band: ieltsBand(), exclude: have, count: askCount(need) });
    const words = parseDaily(await askIelts(prompt, "Make today's words."), have, need);
    if (!words.length) throw new Error('AI ส่งคำศัพท์กลับมาไม่ครบ ลองกดใหม่อีกครั้ง');
    state.daily = today ? { ...today, words: [...today.words, ...words] } : { day: dayKey(), cefr: LEVEL_TEXT, words, added: [], draft: '', essay: null };
    state.dailySeen = cleanSeen([...(state.dailySeen || []), ...words.map((w) => w.word)]);
    persist();
  } catch (e) { toast(e.message, true); }
  busy = false; rerender();
}
