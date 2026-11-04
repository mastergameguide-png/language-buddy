// Dashboard: today's goals, key numbers, a short personal plan, the week, recent activity.
import { el, h, icon, num, fmtMinutes, ago } from '../util.js';
import { settings, state, levelShort, cefrOf, CEFR, CATEGORIES, weakAreas, flag, activeChar, activeCharId } from '../store.js';
import { today, streak, lastDays, totals, accuracy, vocabCounts, dueCards } from '../stats.js';
import { switchCharacter } from './chat.js';
import { practice } from '../conversation.js';
import { suggestScene } from './roleplay.js';
import { CHARACTERS, customCharacter } from '../engine/characters.js';
import { avatarEl } from './avatar.js';

function goal(label, value, target, unit) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const done = target && value >= target;
  return h('div', { class: 'goal' },
    el('span', done ? 'done' : '', done ? '✅' : '◻️'),
    h('div', {}, el('div', 'small', label), h('div', { class: 'bar' + (done ? ' good' : ''), style: 'margin-top:6px' }, h('i', { style: `width:${pct}%` }))),
    el('span', 'small muted', `${num(Math.floor(value))}/${num(target)} ${unit}`));
}

function stat(label, value, sub) {
  return h('div', { class: 'card stat' }, el('div', 'label', label), el('div', 'value', value), sub ? el('div', 'sub', sub) : null);
}

function weekChart() {
  const days = lastDays(7);
  const max = Math.max(5, ...days.map((d) => d.secs / 60));
  const names = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const todayKey = days[days.length - 1].key;
  const chart = h('div', { class: 'week', role: 'img', 'aria-label': 'เวลาเรียน 7 วันล่าสุด' });
  for (const d of days) {
    const mins = Math.round(d.secs / 60);
    chart.append(h('div', { class: 'col', title: `${mins} นาที · ${d.msgs} ข้อความ · ทบทวน ${d.reviews}` },
      h('div', { class: 'b' + (mins ? '' : ' zero') + (d.key === todayKey ? ' today' : ''), style: `height:${Math.max(3, (mins / max) * 100)}%` }),
      el('span', 'd', names[d.date.getDay()])));
  }
  return chart;
}

const ACT_ICON = { chat: '💬', review: '🧠', word: '📘', roleplay: '🎭', import: '💾' };

export function renderHome(root) {
  root.textContent = '';
  const t = today();
  const s = streak();
  const due = dueCards().length;
  const vc = vocabCounts();
  const acc = accuracy(7);
  const tot = totals();
  const weak = weakAreas().find((w) => w.category !== 'other');
  const hi = new Date().getHours();
  const hello = hi < 12 ? 'อรุณสวัสดิ์' : hi < 18 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  // Hero
  const hero = h('div', { class: 'card hero pad-lg' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        el('div', 'small muted', `${hello}${settings.learnerName ? ', ' + settings.learnerName : ''}`),
        h('div', { style: 'font-size:var(--fs-xl); font-weight:750; margin-top:2px' }, 'พร้อมฝึกภาษาวันนี้ไหม?'),
        h('div', { class: 'row', style: 'margin-top:6px; gap:8px' },
          el('span', 'chip', `${settings.lang} ${flag()}`),
          el('span', 'chip', `${levelShort()} · ${CEFR[cefrOf()] || ''}`))),
      h('div', { style: 'text-align:right' },
        h('div', { class: 'streak', 'aria-label': `เรียนต่อเนื่อง ${s} วัน` }, `🔥 ${s}`),
        el('div', 'xs muted', 'วันติดต่อกัน'))),
    h('div', { class: 'row wrap-ok', style: 'margin-top:16px; gap:8px' },
      h('a', { class: 'btn primary', href: '#chat' }, icon('chat'), `คุยกับ ${activeChar().name}`),
      due ? h('a', { class: 'btn', href: '#review' }, icon('review'), `ทบทวน ${num(due)} ข้อ`) : null));
  root.append(hero);

  // Characters
  root.append(h('div', { class: 'sec-row' }, el('h2', 'sec', 'คุยกับใครดีวันนี้'), h('a', { class: 'btn sm ghost', href: '#characters' }, 'ดูทั้งหมด')));
  const strip = h('div', { class: 'char-strip' });
  for (const c of [...CHARACTERS, customCharacter(settings)]) {
    const b = h('button', { type: 'button', class: 'char-pick' + (c.id === activeCharId() ? ' on' : ''), 'aria-label': `คุยกับ ${c.name}` },
      avatarEl(c, state.sessions[c.id]?.emotion, 'md'), el('b', '', c.name), el('small', '', c.tagline.th));
    b.addEventListener('click', () => switchCharacter(c.id));
    strip.append(b);
  }
  root.append(strip);

  // Goals
  root.append(el('h2', 'sec', 'เป้าหมายวันนี้'));
  root.append(h('div', { class: 'card' },
    goal('เวลาเรียน', t.secs / 60, settings.goalMinutes, 'นาที'),
    goal('คุยกับเพื่อน AI', t.msgs, settings.goalMessages, 'ข้อความ'),
    goal('ทบทวน', t.reviews, settings.goalReviews, 'ข้อ')));

  // Key numbers
  root.append(el('h2', 'sec', 'ภาพรวม'));
  root.append(h('div', { class: 'grid cols-4' },
    stat('เวลาเรียนทั้งหมด', fmtMinutes(tot.secs), 'วัดเฉพาะตอนใช้แอปจริง'),
    stat('คำศัพท์', num(vc.all), `จำได้แล้ว ${num(vc.mastered)} คำ`),
    stat('ความแม่นยำไวยากรณ์', acc == null ? '—' : `${acc}%`, acc == null ? 'คุยเพิ่มอีกนิดเพื่อวัดผล' : 'ข้อความที่ไม่ต้องแก้ · 7 วัน'),
    stat('ข้อผิดที่บันทึก', num(state.mistakes.length), weak ? `พลาดบ่อย: ${CATEGORIES[weak.category]}` : 'ยังไม่มี')));

  // Personal plan
  root.append(el('h2', 'sec', 'แผนแนะนำวันนี้'));
  const plan = h('div', { class: 'card' });
  let n = 1;
  const step = (text, btnLabel, onClick, href) => {
    const b = btnLabel ? (href ? h('a', { class: 'btn sm', href }, btnLabel) : h('button', { class: 'btn sm', type: 'button', onclick: onClick }, btnLabel)) : null;
    plan.append(h('div', { class: 'plan-step' }, el('span', 'n', String(n++)), el('span', 'grow small', text), b));
  };
  if (due) step(`ทบทวนคำและประโยคที่ถึงเวลา ${num(due)} ข้อ`, 'เริ่ม', null, '#review');
  if (weak) step(`ฝึกจุดที่พลาดบ่อย: ${CATEGORIES[weak.category]} (${weak.count} ครั้งใน 30 วัน)`, 'ฝึก', () => practice(weak.category, CATEGORIES[weak.category]));
  const sc = suggestScene();
  if (sc) step(`ลองสถานการณ์: ${sc.icon} ${sc.th}`, 'เล่น', null, '#roleplay');
  if (n === 1) step(`เริ่มคุยกับ ${activeChar().name} สัก 10 ข้อความ เพื่อให้แอปรู้จุดแข็งจุดอ่อนของคุณ`, 'คุยเลย', null, '#chat');
  root.append(plan);

  // Week
  root.append(el('h2', 'sec', 'สัปดาห์นี้ (นาทีต่อวัน)'));
  root.append(h('div', { class: 'card' }, weekChart()));

  // Activity
  const acts = state.activity.slice(-5).reverse();
  if (acts.length) {
    root.append(el('h2', 'sec', 'กิจกรรมล่าสุด'));
    const list = h('div', { class: 'list' });
    for (const a of acts) list.append(h('div', { class: 'item' }, el('span', 'ico', ACT_ICON[a.type] || '•'), el('span', 'grow small', a.text), el('span', 'xs muted', ago(a.t))));
    root.append(list);
  }
}
