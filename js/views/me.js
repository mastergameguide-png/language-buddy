// "Me": learner profile, detailed progress, weak areas, and what the buddy remembers.
import { el, h, icon, num, fmtMinutes, toast } from '../util.js';
import { settings, state, persist, emit, levelShort, cefrOf, CEFR, CATEGORIES, weakAreas, flag, setSettings } from '../store.js';
import { streak, totals, accuracy, lastDays, vocabCounts } from '../stats.js';
import { practice } from '../conversation.js';
import { emptyState, sectionHeader } from './ui.js';

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
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, (settings.learnerName || 'ฉ').trim().charAt(0).toUpperCase()),
      h('div', { class: 'grow' },
        el('h1', 'me-name', settings.learnerName || 'ผู้เรียน'),
        el('div', 'xs muted', `${settings.lang} ${flag()} · ${levelShort()} (${CEFR[cefrOf()] || ''})${settings.goalText ? ' · ' + settings.goalText : ''}`)),
      h('a', { class: 'btn sm', href: '#settings' }, icon('gear'), 'ตั้งค่า'))));

  root.append(sectionHeader('ความก้าวหน้า', h('div', { class: 'row wrap-ok' }, h('a', { class: 'btn sm', href: '#dashboard' }, '📊 Dashboard'), h('a', { class: 'btn sm', href: '#levels' }, '🏅 Lv. ของฉัน'), h('a', { class: 'btn sm', href: '#learn' }, '🎓 คอร์สและ IELTS'), h('a', { class: 'btn sm primary', href: '#progress' }, '📈 รายงานและแผน 7 วัน'))));
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

  root.append(el('h2', 'sec', 'ทักษะ (ประเมินจากข้อความที่คุณพิมพ์)'));
  const sk = h('div', { class: 'card' });
  const labels = { grammar: 'ไวยากรณ์', vocabulary: 'คำศัพท์', fluency: 'ความลื่นไหล', comprehension: 'ความเข้าใจ', naturalness: 'ความเป็นธรรมชาติ' };
  let total = 0, count = 0;
  for (const [k, label] of Object.entries(labels)) {
    const v = (state.skills || {})[k] || [];
    const recent = v.slice(-10);
    const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
    if (avg != null && recent.length >= 3) { total += avg; count++; }
    sk.append(h('div', { class: 'goal' }, el('span', 'xs muted', label),
      h('div', { class: 'bar ' + (avg == null ? '' : avg >= 4 ? 'good' : avg >= 3 ? 'warn' : 'bad') }, h('i', { style: `width:${avg == null ? 0 : (avg / 5) * 100}%` })),
      el('span', 'small', avg == null || recent.length < 3 ? 'ข้อมูลยังไม่พอ' : `${avg.toFixed(1)}/5`)));
  }
  sk.append(h('div', { class: 'goal' }, el('span', 'xs muted', 'การออกเสียง'), h('div', { class: 'bar' }, h('i', { style: 'width:0' })), el('span', 'small muted', 'ยังวัดไม่ได้')));
  sk.append(el('p', 'xs muted', 'ตัวละครให้คะแนน 1–5 จากข้อความที่ยาว 6 คำขึ้นไป (เฉลี่ย 10 ครั้งล่าสุด) · การออกเสียงต้องใช้ระบบวิเคราะห์เสียง ซึ่งยังไม่มี แอปจึงไม่แสดงคะแนนที่วัดไม่ได้จริง · การฟังและการอ่านยังไม่ได้วัด'));
  // Suggest a level change from the scores, but the learner decides.
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const avgAll = count >= 4 ? total / count : null;
  const cur = order.indexOf(cefrOf());
  const sugg = avgAll == null || cur < 0 ? null : avgAll >= 4.3 && cur < 5 ? order[cur + 1] : avgAll <= 2.2 && cur > 0 ? order[cur - 1] : null;
  if (sugg && !/^IELTS /.test(settings.level)) {
    const b = h('button', { type: 'button', class: 'btn sm primary' }, `เปลี่ยนเป็น ${sugg}`);
    b.addEventListener('click', () => { setSettings({ ...settings, level: sugg }); toast(`เปลี่ยนระดับเป็น ${sugg} แล้ว`); renderMe(root); });
    sk.append(h('div', { class: 'row', style: 'margin-top:10px' }, el('span', 'grow small', `คะแนนเฉลี่ย ${avgAll.toFixed(1)}/5 — ลองระดับ ${sugg} ไหม?`), b));
  }
  root.append(sk);

  // Speaking and listening practice, from the voice page.
  root.append(el('h2', 'sec', 'พูดและฟัง'));
  const heard = tot.shadowWords ? Math.round((tot.shadowHeard / tot.shadowWords) * 100) : null;
  root.append(h('div', { class: 'card' },
    el('div', 'small', `พูดตาม ${num(tot.shadow)} ประโยค${heard == null ? '' : ` · ระบบจับคำได้เฉลี่ย ${heard}%`}`),
    el('div', 'small', tot.listen ? `ฝึกฟัง ${num(tot.listen)} ข้อ · ถูก ${num(tot.listenOk)} (${Math.round((tot.listenOk / tot.listen) * 100)}%)` : 'ยังไม่ได้ฝึกฟัง'),
    el('p', 'xs muted', '"จับคำได้" มาจากระบบฟังเสียงในเบราว์เซอร์ บอกได้แค่ว่าได้ยินคำครบไหม ไม่ใช่คะแนนการออกเสียง'),
    h('a', { class: 'btn sm', href: '#voice' }, 'ไปฝึกเสียง')));

  // How much help the learner used, measured from what they tapped (not from the AI).
  root.append(el('h2', 'sec', 'การใช้ตัวช่วย'));
  const help = h('div', { class: 'card' });
  const pct = tot.msgs ? Math.round((tot.hints / tot.msgs) * 100) : 0;
  help.append(
    el('div', 'small', tot.hints ? `ตอบโดยใช้คำใบ้ ${num(tot.hints)} ครั้ง (${pct}% ของข้อความ) · ดูตัวอย่างเต็ม ${num(tot.hintFull)} ครั้ง` : 'ยังไม่ได้ใช้คำใบ้'),
    el('div', 'small', `ใช้ตัวช่วยแปล 🇹🇭→EN ${num(tot.helper)} ครั้ง`),
    el('p', 'xs muted', 'นับจากปุ่มที่คุณแตะจริง — ถ้าใช้น้อยลงเรื่อยๆ แปลว่าตอบเองได้มากขึ้น'));
  root.append(help);

  const q = state.quality || {};
  if (q.replies) {
    const rate = (n) => `${Math.round(((n || 0) / q.replies) * 100)}%`;
    root.append(h('div', { class: 'card xs muted', style: 'margin-top:12px' },
      `ตรวจคำตอบของ AI อัตโนมัติ ${num(q.replies)} ครั้ง: ประโยคยาวเกินระดับ ${rate(q.tooLong)} · อ้างถึงเรื่องที่ไม่เคยคุย ${rate(q.invented)} · ถามหลายคำถาม ${rate(q.manyQuestions)} · รูปแบบเสีย ${rate(q.malformed)}`));
  }

  root.append(sectionHeader('ความจำร่วม: สิ่งที่ตัวละครรู้เกี่ยวกับคุณ', h('a', { class: 'btn sm ghost', href: '#characters' }, 'ความจำของแต่ละตัว')));
  if (settings.memoryLearner === false) root.append(el('p', 'xs muted', 'ปิดความจำร่วมอยู่ (เปิดได้ที่ ตั้งค่า → ความจำ)'));
  const facts = h('div', { class: 'list' });
  if (!state.facts.length) facts.append(h('div', { class: 'card small muted' }, 'ยังไม่มี — เล่าเรื่องตัวเองให้เพื่อน AI ฟังได้เลย'));
  state.facts.forEach((f, i) => {
    const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ลบความจำนี้' }, icon('trash'));
    del.addEventListener('click', () => { state.facts.splice(i, 1); persist(); emit('state'); renderMe(root); });
    facts.append(h('div', { class: 'item' }, el('span', 'grow small', f), del));
  });
  root.append(facts);
}
