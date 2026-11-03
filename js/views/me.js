// "Me": learner profile, detailed progress, weak areas, and what the buddy remembers.
import { el, h, icon, num, fmtMinutes } from '../util.js';
import { settings, state, persist, emit, levelShort, cefrOf, CEFR, CATEGORIES, weakAreas, flag } from '../store.js';
import { streak, totals, accuracy, lastDays, vocabCounts } from '../stats.js';
import { practice } from './chat.js';

function stat(label, value, sub) {
  return h('div', { class: 'card stat' }, el('div', 'label', label), el('div', 'value', value), sub ? el('div', 'sub', sub) : null);
}

function weeks() {
  const days = lastDays(28);
  const out = [];
  for (let w = 0; w < 4; w++) {
    const chunk = days.slice(w * 7, w * 7 + 7);
    out.push({
      label: w === 3 ? 'สัปดาห์นี้' : `${3 - w} สัปดาห์ก่อน`,
      secs: chunk.reduce((a, d) => a + d.secs, 0),
      msgs: chunk.reduce((a, d) => a + d.msgs, 0),
      reviews: chunk.reduce((a, d) => a + d.reviews, 0),
    });
  }
  return out.reverse();
}

export function renderMe(root) {
  root.textContent = '';
  const tot = totals();
  const vc = vocabCounts();
  const a7 = accuracy(7), a30 = accuracy(30);

  root.append(h('div', { class: 'card hero pad-lg' },
    h('div', { class: 'row' },
      el('div', 'avatar', (settings.learnerName || 'ฉ').trim().charAt(0).toUpperCase()),
      h('div', { class: 'grow' },
        el('div', '', settings.learnerName || 'ผู้เรียน'),
        el('div', 'xs muted', `${settings.lang} ${flag()} · ${levelShort()} (${CEFR[cefrOf()] || ''})${settings.goalText ? ' · ' + settings.goalText : ''}`)),
      h('a', { class: 'btn sm', href: '#settings' }, icon('gear'), 'ตั้งค่า'))));

  root.append(el('h2', 'sec', 'ความก้าวหน้า'));
  root.append(h('div', { class: 'grid cols-4' },
    stat('เรียนต่อเนื่อง', `🔥 ${streak()} วัน`),
    stat('เวลาเรียน', fmtMinutes(tot.secs)),
    stat('ข้อความที่คุย', num(tot.msgs), `พูดด้วยเสียง ${num(tot.voice)}`),
    stat('ทบทวนแล้ว', num(tot.reviews), `คำศัพท์ ${num(vc.all)} · จำได้ ${num(vc.mastered)}`)));

  const accCard = h('div', { class: 'card' }, el('h3', '', 'ความแม่นยำไวยากรณ์'),
    el('p', 'xs muted', 'สัดส่วนข้อความ (3 คำขึ้นไป) ที่เพื่อน AI ไม่ต้องแก้'));
  for (const [label, v] of [['7 วัน', a7], ['30 วัน', a30]]) {
    accCard.append(h('div', { class: 'goal' }, el('span', 'xs muted', label),
      h('div', { class: 'bar ' + (v == null ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad') }, h('i', { style: `width:${v ?? 0}%` })),
      el('span', 'small', v == null ? 'ข้อมูลยังไม่พอ' : `${v}%`)));
  }
  root.append(h('div', { class: 'grid md-2', style: 'margin-top:12px' }, accCard, (() => {
    const c = h('div', { class: 'card' }, el('h3', '', '4 สัปดาห์ล่าสุด'));
    for (const w of weeks()) c.append(h('div', { class: 'row small', style: 'margin-top:8px' }, el('span', 'grow muted', w.label), el('span', '', `${fmtMinutes(w.secs)} · ${num(w.msgs)} ข้อความ · ทบทวน ${num(w.reviews)}`)));
    return c;
  })()));

  root.append(el('h2', 'sec', 'จุดที่ควรฝึก (30 วัน)'));
  const weak = weakAreas().filter((w) => w.category !== 'other').slice(0, 5);
  if (!weak.length) root.append(h('div', { class: 'card small muted' }, 'ยังไม่มีข้อมูล — คุยกับเพื่อน AI สักพัก แล้วแอปจะสรุปจุดอ่อนให้'));
  else {
    const max = weak[0].count;
    const c = h('div', { class: 'card' });
    for (const w of weak) {
      c.append(h('div', { class: 'goal' }, el('span', 'xs muted', String(w.count)),
        h('div', {}, el('div', 'small', CATEGORIES[w.category] || w.category), h('div', { class: 'bar warn', style: 'margin-top:6px' }, h('i', { style: `width:${(w.count / max) * 100}%` }))),
        h('button', { type: 'button', class: 'btn sm', onclick: () => practice(w.category, CATEGORIES[w.category]) }, 'ฝึก')));
    }
    root.append(c);
  }

  root.append(el('h2', 'sec', 'ทักษะที่วัดได้ตอนนี้'));
  root.append(h('div', { class: 'card small' },
    h('div', { class: 'row' }, el('span', 'grow', '✍️ การเขียน / ไวยากรณ์ / คำศัพท์'), el('span', 'chip good', 'วัดจากแชต')),
    h('div', { class: 'row', style: 'margin-top:8px' }, el('span', 'grow', '🎤 การพูด'), el('span', 'chip', `นับข้อความเสียง ${num(tot.voice)}`)),
    h('div', { class: 'row', style: 'margin-top:8px' }, el('span', 'grow', '👂 การฟัง · 📖 การอ่าน · 🗣️ การออกเสียง'), el('span', 'chip', 'ยังวัดไม่ได้')),
    el('p', 'xs muted', 'การออกเสียงต้องใช้ระบบวิเคราะห์เสียงแยก ซึ่งยังไม่มีในเวอร์ชันฟรีนี้ แอปจึงไม่แสดงคะแนนที่วัดไม่ได้จริง')));

  root.append(el('h2', 'sec', `สิ่งที่ ${settings.name} จำเกี่ยวกับคุณ`));
  const facts = h('div', { class: 'list' });
  if (!state.facts.length) facts.append(h('div', { class: 'card small muted' }, 'ยังไม่มี — เล่าเรื่องตัวเองให้เพื่อน AI ฟังได้เลย'));
  state.facts.forEach((f, i) => {
    const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ลบความจำนี้' }, icon('trash'));
    del.addEventListener('click', () => { state.facts.splice(i, 1); persist(); emit('state'); renderMe(root); });
    facts.append(h('div', { class: 'item' }, el('span', 'grow small', f), del));
  });
  root.append(facts);
}
