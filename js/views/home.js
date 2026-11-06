// Dashboard: today's goals, key numbers, a short personal plan, the week, recent activity.
import { el, h, icon, num, fmtMinutes, ago } from '../util.js';
import { settings, state, levelShort, cefrOf, CEFR, CATEGORIES, weakAreas, flag, activeChar, activeCharId } from '../store.js';
import { today, streak, lastDays, totals, accuracy, vocabCounts, dueCards } from '../stats.js';
import { switchCharacter } from './chat.js';
import { suggestScene, openScenario } from './roleplay.js';
import { todayTasks, runAction } from './progress.js';
import { recommendations } from '../engine/analytics.js';
import { CHARACTERS, customCharacter } from '../engine/characters.js';
import { avatarEl } from './avatar.js';
import { myLevel } from './levels.js';
import { dailyCard } from './daily.js';
import { emptyState, sectionHeader } from './ui.js';

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
        el('h1', 'hero-title', 'พร้อมฝึกภาษาวันนี้ไหม?'),
        h('div', { class: 'row', style: 'margin-top:6px; gap:8px' },
          el('span', 'chip', `${settings.lang} ${flag()}`),
          el('span', 'chip', `${levelShort()} · ${CEFR[cefrOf()] || ''}`))),
      h('div', { style: 'text-align:right' },
        h('div', { class: 'streak', 'aria-label': `เรียนต่อเนื่อง ${s} วัน` }, `🔥 ${s}`),
        el('div', 'xs muted', 'วันติดต่อกัน'))),
    h('div', { class: 'row wrap-ok', style: 'margin-top:16px; gap:8px' },
      h('a', { class: 'btn primary', href: '#chat' }, icon('chat'), `คุยกับ ${activeChar().name}`),
      due ? h('a', { class: 'btn', href: '#review' }, icon('review'), `ทบทวน ${num(due)} ข้อ`) : null,
      h('a', { class: 'btn', href: '#learn' }, '🎓 คอร์สและ IELTS')));
  // Lv. strip: links to the Lv. page; the bar is XP inside this Lv.
  const me = myLevel();
  const pct = me.ready ? 100 : Math.min(100, Math.round((me.into / me.need) * 100));
  hero.append(h('a', { class: 'lv-strip', href: '#levels', 'aria-label': `เลเวล ${me.lv} ${me.ready ? 'พร้อมสอบด่าน' : `อีก ${me.need - me.into} XP ถึงเลเวลถัดไป`} ดูรายละเอียด` },
    el('b', '', `🏅 Lv. ${me.lv}`),
    h('div', { class: 'bar grow' + (me.ready ? ' good' : '') }, h('i', { style: `width:${pct}%` })),
    el('span', 'xs', me.ready ? '🚪 พร้อมสอบด่าน' : `อีก ${num(me.need - me.into)} XP`)));
  root.append(hero);
  const daily = dailyCard(() => renderHome(root));
  if (daily) root.append(daily);

  // Characters
  root.append(sectionHeader('คุยกับใครดีวันนี้', h('a', { class: 'btn sm ghost', href: '#characters' }, 'ดูทั้งหมด')));
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

  // Today: the 7-day plan's tasks (if any), then what the analytics suggest, each with its evidence.
  root.append(sectionHeader('วันนี้ทำอะไรดี', h('a', { class: 'btn sm ghost', href: '#progress' }, 'รายงานและแผน 7 วัน')));
  const plan = h('div', { class: 'card' });
  let n = 1;
  const step = (text, btnLabel, onClick, href, sub) => {
    const b = btnLabel ? (href ? h('a', { class: 'btn sm', href }, btnLabel) : h('button', { class: 'btn sm', type: 'button', onclick: onClick }, btnLabel)) : null;
    plan.append(h('div', { class: 'plan-step' }, el('span', 'n', String(n++)), h('div', { class: 'grow' }, el('div', 'small', text), sub ? el('div', 'xs muted', sub) : null), b));
  };
  const tasks = todayTasks();
  if (tasks) for (const tk of tasks) step(`${tk.complete ? '✅' : tk.icon} ${tk.th} ${tk.target} ${tk.unit}`, tk.complete ? null : 'ทำ', null, tk.href, `ทำแล้ว ${Math.min(tk.done, tk.target)}/${tk.target} · จากแผน 7 วัน`);
  for (const r of recommendations({ days: state.days, mistakes: state.mistakes, vocab: state.vocab, results: state.results, labels: CATEGORIES }, Date.now(), tasks ? 2 : 3)) {
    step(r.th, 'ไป', () => runAction(r.action), null, `ดูจาก: ${r.evidence}`);
  }
  const sc = suggestScene();
  if (sc && n <= 4) step(`ลองสถานการณ์: ${sc.icon} ${sc.th} (${sc.cefr[0]}–${sc.cefr[1]})`, 'ดู', () => openScenario(sc.id));
  if (!tasks) plan.append(h('div', { class: 'row', style: 'margin-top:10px' }, el('span', 'grow xs muted', 'อยากได้แผนทั้งสัปดาห์?'), h('a', { class: 'btn sm primary', href: '#progress' }, 'สร้างแผน 7 วัน')));
  root.append(plan);

  // Week
  root.append(sectionHeader('สัปดาห์นี้ (นาทีต่อวัน)', h('a', { class: 'btn sm ghost', href: '#dashboard' }, '📊 Dashboard')));
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
