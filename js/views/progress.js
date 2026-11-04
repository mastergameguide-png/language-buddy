// Progress report: the 7-day plan, what to do next (with the evidence), this week against last
// week, mistake types, a 30-day history, and where every number comes from.
import { el, h, num, fmtMinutes, toast } from '../util.js';
import { settings, state, persist, emit, CATEGORIES } from '../store.js';
import { weeklyReport, recommendations, weaknesses, history, METRICS, CONFIDENCE_TH, dayKeyOf } from '../engine/analytics.js';
import { makePlan, taskProgress, changeTarget, removeTask, addTask, planCovers, TASK_KINDS, MAX_TASKS } from '../engine/plan.js';
import { practice } from '../conversation.js';
import { openScenario } from './roleplay.js';
import { openVoice } from './voice.js';

let pickedDay = null;
const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const keyDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

const data = () => ({ days: state.days, mistakes: state.mistakes, vocab: state.vocab, results: state.results, labels: CATEGORIES });
const scenariosOn = (key) => state.results.filter((r) => dayKeyOf(new Date(r.t)) === key).length;

// Runs a recommendation's action.
export function runAction(a) {
  if (a.type === 'practice') practice(a.category, a.label || CATEGORIES[a.category] || a.category);
  else if (a.type === 'review') location.hash = '#review';
  else if (a.type === 'scenario') openScenario(a.id);
  else if (a.type === 'voice') openVoice(a.tab);
  else location.hash = '#chat';
}
const ACTION_TH = { practice: 'ฝึกในแชต', review: 'ไปทบทวน', scenario: 'เล่นอีกครั้ง', voice: 'ไปฝึกเสียง', chat: 'ไปคุย' };

function newPlan() {
  const focus = weaknesses(data()).map((w) => (w.action.type === 'voice' ? `voice:${w.action.tab}` : w.action.type));
  state.plan = makePlan({ goals: { messages: settings.goalMessages, reviews: settings.goalReviews, minutes: settings.goalMinutes }, focus });
  pickedDay = state.plan.days[0].key;
  persist();
  emit('badges');
}

function planSection(root) {
  const today = dayKeyOf(new Date());
  const box = h('div', { class: 'card plan-card' });
  if (!planCovers(state.plan, today)) {
    box.append(el('p', 'small', state.plan ? 'แผน 7 วันก่อนหน้าจบแล้ว — สร้างแผนสัปดาห์ใหม่จากเป้าหมายและจุดที่ควรฝึกตอนนี้' : 'ยังไม่มีแผน — แอปจะจัดงานให้วันละ 3 อย่างจากเป้าหมายรายวันและจุดที่ควรฝึกของคุณ แก้ได้ทุกวัน'));
    const b = h('button', { type: 'button', class: 'btn primary' }, 'สร้างแผน 7 วัน');
    b.addEventListener('click', () => { newPlan(); toast('สร้างแผนแล้ว'); render(root); });
    box.append(b);
    return box;
  }
  const plan = state.plan;
  if (!pickedDay || !planCovers(plan, pickedDay)) pickedDay = today;

  // Day pills: ✓ when every task of that day is done.
  const pills = h('div', { class: 'day-pills', role: 'tablist' });
  for (const d of plan.days) {
    const rec = state.days[d.key] || {};
    const allDone = d.tasks.length && d.tasks.every((t) => taskProgress(t, rec, scenariosOn(d.key)).complete);
    const date = keyDate(d.key);
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(d.key === pickedDay), class: (d.key === today ? 'today ' : '') + (allDone ? 'done' : '') },
      el('small', '', DAY_TH[date.getDay()]), el('b', '', String(date.getDate())), el('span', 'mark', allDone ? '✓' : d.key < today ? '·' : ''));
    b.addEventListener('click', () => { pickedDay = d.key; render(root); });
    pills.append(b);
  }
  box.append(pills);

  const day = plan.days.find((d) => d.key === pickedDay);
  const rec = state.days[day.key] || {};
  const future = day.key > today;
  const list = h('div', { class: 'list' });
  for (const t of day.tasks) {
    const k = TASK_KINDS[t.kind];
    const p = taskProgress(t, rec, scenariosOn(day.key));
    const pct = Math.min(100, Math.round((p.done / p.target) * 100));
    const minus = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `ลดเป้า ${k.th}` }, '−');
    minus.addEventListener('click', () => { state.plan = changeTarget(state.plan, day.key, t.id, -1); persist(); render(root); });
    const plus = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `เพิ่มเป้า ${k.th}` }, '+');
    plus.addEventListener('click', () => { state.plan = changeTarget(state.plan, day.key, t.id, +1); persist(); render(root); });
    const del = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `ลบงาน ${k.th}` }, '✕');
    del.addEventListener('click', () => { state.plan = removeTask(state.plan, day.key, t.id); persist(); render(root); });
    list.append(h('div', { class: 'item task' + (p.complete ? ' complete' : '') },
      el('span', 'ico', p.complete ? '✅' : k.icon),
      h('div', { class: 'grow' },
        h('div', { class: 'row' }, el('span', 'small grow', `${k.th} ${t.target} ${k.unit}`), el('span', 'xs muted', future ? '' : `${num(Math.min(p.done, 9999))}/${t.target}`)),
        future ? null : h('div', { class: 'bar' + (p.complete ? ' good' : ''), style: 'margin-top:6px' }, h('i', { style: `width:${pct}%` })),
        // Edit controls on their own line so the task name has the full width on a phone.
        h('div', { class: 'task-edit' }, el('span', 'xs muted', 'เป้า'), minus, plus, del, el('span', 'grow'),
          day.key === today && !p.complete ? h('a', { class: 'btn sm', href: k.href }, 'ทำ') : null))));
  }
  if (!day.tasks.length) list.append(el('div', 'small muted', 'วันนี้ไม่มีงาน — พักได้ หรือเพิ่มงานด้านล่าง'));
  box.append(list);

  // Add a task the day does not have yet.
  const missing = Object.entries(TASK_KINDS).filter(([id]) => !day.tasks.some((t) => t.kind === id));
  if (missing.length && day.tasks.length < MAX_TASKS) {
    const sel = h('select', { class: 'input', 'aria-label': 'เลือกงานที่จะเพิ่ม' }, ...missing.map(([id, k]) => Object.assign(el('option', '', `${k.icon} ${k.th}`), { value: id })));
    const add = h('button', { type: 'button', class: 'btn sm' }, 'เพิ่มงาน');
    add.addEventListener('click', () => { state.plan = addTask(state.plan, day.key, sel.value); persist(); render(root); });
    box.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('div', { class: 'grow' }, sel), add));
  }
  const again = h('button', { type: 'button', class: 'btn sm ghost' }, 'สร้างแผนใหม่');
  again.addEventListener('click', () => { if (confirm('สร้างแผน 7 วันใหม่ตั้งแต่วันนี้? (แผนเดิมจะถูกแทนที่)')) { newPlan(); render(root); } });
  box.append(h('div', { class: 'row', style: 'margin-top:8px' }, el('span', 'grow xs muted', 'ความคืบหน้านับจากสิ่งที่ทำจริงในวันนั้น'), again));
  return box;
}

function recSection() {
  const recs = recommendations(data());
  const box = h('div', { class: 'list' });
  if (!recs.length) { box.append(h('div', { class: 'card small muted' }, 'ยังไม่พบจุดที่ต้องรีบฝึก — ทำตามแผนต่อได้เลย')); return box; }
  for (const r of recs) {
    const b = h('button', { type: 'button', class: 'btn sm primary' }, ACTION_TH[r.action.type] || 'ไป');
    b.addEventListener('click', () => runAction(r.action));
    box.append(h('div', { class: 'item rec' },
      h('div', { class: 'grow' }, el('div', 'small', r.th), el('div', 'xs muted', `ดูจาก: ${r.evidence}`), r.tip ? el('div', 'xs', '💡 ' + r.tip) : null), b));
  }
  return box;
}

const fmtVal = (m, v) => (v == null ? '—' : m.id === 'time' ? fmtMinutes(v * 60) : `${num(v)}${m.unit === '%' ? '%' : m.unit === '/10' ? '/10' : ''}`);
function weekSection() {
  const r = weeklyReport(data());
  const wrap = h('div', {});
  wrap.append(h('div', { class: 'card' }, ...r.highlights.map((t) => el('p', 'small', '• ' + t))));
  const table = h('div', { class: 'card metric-table' },
    h('div', { class: 'mrow head xs muted' }, el('span', 'grow', 'ตัวชี้วัด'), el('span', 'v', 'สัปดาห์ก่อน'), el('span', 'v', 'สัปดาห์นี้'), el('span', 't', '')));
  for (const m of r.metrics) {
    const arrow = m.trend == null || m.trend === 'same' ? '' : m.trend === 'up' ? '▲' : '▼';
    const cls = m.good == null ? '' : m.good ? 'good-text' : 'bad-text';
    const info = el('div', 'xs muted msrc', `วัดจาก: ${m.source}${m.kind === 'rate' ? ` · ตัวอย่าง ${num(m.n)} · ${CONFIDENCE_TH[m.confidence]}` : ''}`);
    info.hidden = true;
    const row = h('button', { type: 'button', class: 'mrow', 'aria-expanded': 'false' },
      el('span', 'grow small', m.th), el('span', 'v small muted', fmtVal(m, m.prev)),
      el('span', 'v small', m.value == null && m.kind === 'rate' ? 'ข้อมูลยังไม่พอ' : fmtVal(m, m.value)), el('span', 't ' + cls, arrow));
    row.addEventListener('click', () => { info.hidden = !info.hidden; row.setAttribute('aria-expanded', String(!info.hidden)); });
    table.append(row, info);
  }
  table.append(el('p', 'xs muted', 'แตะแต่ละแถวเพื่อดูว่าวัดจากอะไร · ▲▼ สีเขียว = ไปทางที่ดี · ตัวเลขแบบสัดส่วนจะแสดงเมื่อข้อมูลพอเท่านั้น'));
  wrap.append(table);
  if (r.categories.length) {
    const c = h('div', { class: 'card' }, el('h3', '', 'ข้อผิดตามประเภท (7 วัน)'));
    for (const x of r.categories.slice(0, 6)) {
      const d = x.now - x.before;
      c.append(h('div', { class: 'row small', style: 'margin-top:6px' }, el('span', 'grow', CATEGORIES[x.category] || x.category),
        el('span', 'muted', `${x.before} → ${x.now}`), el('span', d < 0 ? 'good-text' : d > 0 ? 'bad-text' : 'muted', d < 0 ? ' ▼' : d > 0 ? ' ▲' : ' =')));
    }
    c.append(el('p', 'xs muted', 'จากคำแก้ในแชต (ไม่นับคำแนะนำแบบทางเลือก) · น้อยลง = ดีขึ้น'));
    wrap.append(c);
  }
  return wrap;
}

function historySection() {
  const rows = history(data());
  const box = h('div', { class: 'list' });
  if (!rows.length) { box.append(h('div', { class: 'card small muted' }, 'ยังไม่มีประวัติใน 30 วันที่ผ่านมา')); return box; }
  for (const r of rows) {
    const d = keyDate(r.key);
    const parts = [r.mins && `${r.mins} นาที`, r.msgs && `คุย ${r.msgs}`, r.reviews && `ทบทวน ${r.reviews}`, r.words && `คำใหม่ ${r.words}`, r.shadow && `พูดตาม ${r.shadow}`, r.listen && `ฟัง ${r.listen}`, r.scenarios && `สถานการณ์ ${r.scenarios}`].filter(Boolean);
    box.append(h('div', { class: 'item' }, el('span', 'xs muted hdate', `${DAY_TH[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`), el('span', 'grow small', parts.join(' · '))));
  }
  return box;
}

function sourcesSection() {
  const det = h('details', { class: 'card' }, h('summary', { class: 'small' }, 'ตัวเลขแต่ละตัวมาจากไหน'));
  for (const m of METRICS) det.append(h('div', { style: 'margin-top:8px' }, el('div', 'small', m.th), el('div', 'xs muted', m.source + (m.kind === 'rate' ? ` · แสดงเมื่อมีตัวอย่างอย่างน้อย ${m.minN}` : ' · นับจริง'))));
  det.append(el('p', 'xs muted', 'ไม่มีคะแนนการออกเสียง เพราะแอปยังไม่มีระบบวิเคราะห์เสียงที่วัดได้จริง · คะแนนทักษะจาก AI อยู่ที่หน้า ฉัน'));
  return det;
}

function render(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'รายงานและแผนเรียน'),
    el('p', '', 'แผน 7 วัน สิ่งที่ควรทำต่อ และความก้าวหน้าเทียบกับสัปดาห์ก่อน — ทุกตัวเลขบอกที่มา'))));
  root.append(el('h2', 'sec', '🗓️ แผน 7 วัน'), planSection(root));
  root.append(el('h2', 'sec', '🎯 แนะนำให้ทำต่อ'), recSection());
  root.append(el('h2', 'sec', '📈 สัปดาห์นี้เทียบสัปดาห์ก่อน'), weekSection());
  root.append(el('h2', 'sec', '🗂️ ประวัติ 30 วัน'), historySection());
  root.append(h('div', { style: 'margin-top:16px' }, sourcesSection()));
}

export const renderProgress = render;

// Today's plan tasks for the home page: [{ th, done, target, complete, href }] or null without a plan.
export function todayTasks() {
  const key = dayKeyOf(new Date());
  if (!planCovers(state.plan, key)) return null;
  const day = state.plan.days.find((d) => d.key === key);
  return day.tasks.map((t) => ({ ...taskProgress(t, state.days[key] || {}, scenariosOn(key)), th: TASK_KINDS[t.kind].th, unit: TASK_KINDS[t.kind].unit, icon: TASK_KINDS[t.kind].icon, href: TASK_KINDS[t.kind].href }));
}
