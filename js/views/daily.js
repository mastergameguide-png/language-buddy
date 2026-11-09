// 📘 Today's words card (Home, English only). The learner taps to make today's 5 words (one AI
// request a day); the set is kept for the day, so reopening the app does not ask the AI again.
// Each word can go into the word bank, where it is reviewed with the other cards.
import { el, h, icon, toast, dayKey } from '../util.js';
import { settings, state, persist, isEnglish, cefrOf, ieltsBand, addWord, logActivity } from '../store.js';
import { recordWord } from '../stats.js';
import { askIelts } from '../ai.js';
import { speak, unlockSpeech } from '../speech.js';
import { buildDailyPrompt, parseDaily, targetCefr, DAILY_COUNT } from '../engine/daily.js';

let busy = false;
const opened = new Set();   // words the learner opened, kept open when the card redraws
const inBank = (w) => state.vocab.some((v) => v.word.toLowerCase() === w.toLowerCase());

export function dailyCard(rerender) {
  if (!isEnglish()) return null;
  const set = state.daily?.day === dayKey() ? state.daily : null;
  const card = h('div', { class: 'card daily' });
  card.append(h('div', { class: 'row' }, el('h2', 'sec grow', '📘 คำศัพท์วันนี้'), el('span', 'chip', `ระดับ ${set?.cefr || targetCefr(cefrOf())}`)));
  card.append(h('a', { class: 'btn sm ghost', href: '#mywords' }, '📥 คำของฉัน (คำที่ท่องแล้วจำไม่ได้)'));

  if (!set) {
    card.append(el('p', 'small muted', `AI จะเลือกคำ ${DAILY_COUNT} คำที่สูงกว่าระดับของคุณหนึ่งขั้น พร้อมความหมาย คำพ้อง คำที่มักใช้คู่กัน และประโยคตัวอย่างแบบ IELTS`));
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
  const left = set.words.filter((w) => !inBank(w.word));
  if (left.length) {
    const all = h('button', { type: 'button', class: 'btn primary' }, `เพิ่มทั้งหมดเข้าคลังคำ (${left.length})`);
    all.addEventListener('click', () => { addToBank(left); rerender(); });
    card.append(all);
  } else card.append(el('p', 'small', '✅ เพิ่มครบแล้ว คำเหล่านี้จะมาให้ทบทวนในหน้า "ทบทวน"'));
  card.append(el('p', 'xs muted', 'คำและความหมายสร้างโดย AI อาจผิดได้ ถ้าไม่แน่ใจให้เช็คกับพจนานุกรม'));
  return card;
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
    const have = [...state.vocab.map((v) => v.word), ...(state.daily?.words || []).map((w) => w.word)];
    const prompt = buildDailyPrompt({ cefr: cefrOf(), band: ieltsBand(), exclude: have });
    const words = parseDaily(await askIelts(prompt, "Make today's words."), have);
    if (!words.length) throw new Error('AI ส่งคำศัพท์กลับมาไม่ครบ ลองกดใหม่อีกครั้ง');
    state.daily = { day: dayKey(), cefr: targetCefr(cefrOf()), words, added: [] };
    persist();
  } catch (e) { toast(e.message, true); }
  busy = false; rerender();
}
