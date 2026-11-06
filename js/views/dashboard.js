// 📊 Dashboard: long-term progress on one page, from data already on this device (no AI).
// Charts are plain SVG/HTML. Every chart has a hover/tap tooltip and a table view, and series are
// named by a legend and direct labels, so nothing depends on color alone.
import { el, h, num, fmtMinutes, fmtDate } from '../util.js';
import { state, CATEGORIES, isEnglish } from '../store.js';
import { totalXp } from '../engine/levels.js';
import { RANGES, heatmap, xpSeries, vocabGrowth, ieltsSeries, mistakeTrend, rangeTotals, niceMax } from '../engine/dashboard.js';
import { status } from '../srs.js';
import { myLevel } from './levels.js';

let range = 30;
const NS = 'http://www.w3.org/2000/svg';
const W = 340, H = 170, PAD = { l: 34, r: 54, t: 12, b: 24 };

function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const txt = (x, y, s, cls = 'viz-axis', anchor = 'start') => svg('text', { x, y, class: cls, 'text-anchor': anchor }, s);

// One tooltip for the page: hover, keyboard focus and tap all show it.
let tip = null;
function showTip(e, text) {
  if (!tip) { tip = h('div', { class: 'viz-tip', role: 'status' }); document.body.append(tip); }
  tip.textContent = text;
  tip.hidden = false;
  const r = (e.currentTarget || e.target).getBoundingClientRect();
  const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2));
  const y = r.top - tip.offsetHeight - 8 > 8 ? r.top - tip.offsetHeight - 8 : r.bottom + 8;
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
const hideTip = () => { if (tip) tip.hidden = true; };
function hover(node, text) {
  node.addEventListener('pointerenter', (e) => showTip(e, text));
  node.addEventListener('pointerdown', (e) => showTip(e, text));
  node.addEventListener('focus', (e) => showTip(e, text));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('blur', hideTip);
  return node;
}
window.addEventListener('scroll', hideTip, true);
window.addEventListener('hashchange', hideTip);

function tableView(head, rows) {
  return h('details', { class: 'viz-table' }, h('summary', { class: 'xs' }, 'ดูเป็นตาราง'),
    h('table', { class: 'small' }, h('thead', {}, h('tr', {}, ...head.map((x) => el('th', '', x)))),
      h('tbody', {}, ...rows.map((r) => h('tr', {}, ...r.map((x) => el('td', '', String(x))))))));
}
const card = (title, sub, ...kids) => h('div', { class: 'card viz-card' }, el('h2', 'sec', title), sub ? el('p', 'xs muted', sub) : null, ...kids);
const empty = (text) => el('p', 'small muted viz-empty', text);
const span = (p, size) => (size > 1 ? `${fmtDate(p.start)}–${fmtDate(p.end)}` : fmtDate(p.start));

// ---------- charts ----------
function yAxis(g, max, fmt = num) {
  const plotH = H - PAD.t - PAD.b;
  for (const f of [0, 0.5, 1]) {
    const y = PAD.t + plotH * (1 - f);
    g.append(svg('line', { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y, class: f === 0 ? 'viz-base' : 'viz-grid' }));
    g.append(txt(PAD.l - 6, y + 4, fmt(max * f), 'viz-axis', 'end'));
  }
}

// Single-series bars (XP). Bars are thin with a gap; the whole column is the hover target.
function barChart(points, size, label, unit) {
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const step = plotW / points.length;
  const bw = Math.max(3, Math.min(18, step - 2));
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img', 'aria-label': `${label} ${points.length} ช่วง สูงสุด ${num(Math.max(...points.map((p) => p.value)))} ${unit}` });
  yAxis(root, max);
  points.forEach((p, i) => {
    const x = PAD.l + i * step + (step - bw) / 2;
    const bh = p.value ? Math.max(2, (p.value / max) * plotH) : 0;
    if (bh) root.append(svg('path', { d: roundTop(x, PAD.t + plotH - bh, bw, bh), class: 'viz-bar s1' }));
    root.append(hover(svg('rect', { x: PAD.l + i * step, y: PAD.t, width: step, height: plotH, class: 'viz-hit', tabindex: points.length <= 31 ? 0 : -1, 'aria-label': `${span(p, size)}: ${num(p.value)} ${unit}` }), `${span(p, size)} · ${num(p.value)} ${unit}`));
  });
  xLabels(root, points, size);
  return root;
}
// A bar with 4px rounded top corners, square at the baseline.
function roundTop(x, y, w, hgt) {
  const r = Math.min(4, w / 2, hgt);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}
function xLabels(root, points, size) {
  const plotW = W - PAD.l - PAD.r, step = plotW / points.length;
  const idx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  for (const i of [...new Set(idx)]) root.append(txt(PAD.l + i * step + step / 2, H - 6, fmtDate(points[i].start), 'viz-axis', i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'));
  void size;
}

// Lines over time on one 0-based axis. series: [{name, cls, points:[{t, value, tip}]}].
function lineChart(series, from, to, max, fmtY, label) {
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const X = (t) => PAD.l + ((t - from) / Math.max(1, to - from)) * plotW;
  const Y = (v) => PAD.t + plotH * (1 - v / max);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img', 'aria-label': label });
  yAxis(root, max, fmtY);
  root.append(txt(PAD.l, H - 6, fmtDate(from)), txt(W - PAD.r, H - 6, fmtDate(to), 'viz-axis', 'end'));
  const ends = [];
  for (const s of series) {
    if (!s.points.length) continue;
    if (s.points.length > 1) root.append(svg('path', { d: s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.value).toFixed(1)}`).join(''), class: `viz-line ${s.cls}` }));
    for (const p of s.points) {
      root.append(svg('circle', { cx: X(p.t), cy: Y(p.value), r: 4, class: `viz-dot ${s.cls}` }));
      root.append(hover(svg('circle', { cx: X(p.t), cy: Y(p.value), r: 12, class: 'viz-hit', tabindex: 0, 'aria-label': `${s.name} ${p.tip}` }), `${s.name} · ${p.tip}`));
    }
    const last = s.points[s.points.length - 1];
    ends.push({ y: Y(last.value), name: s.name, cls: s.cls });
  }
  // Direct labels at the right edge, nudged apart when they would overlap.
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
  for (const e of ends) root.append(txt(W - PAD.r + 6, e.y + 4, e.name, 'viz-label'));
  return root;
}
const legend = (items) => h('div', { class: 'viz-legend xs' }, ...items.map(([name, cls]) => h('span', {}, h('i', { class: `viz-key ${cls}`, 'aria-hidden': 'true' }), name)));

// ---------- page ----------
export function renderDashboard(root) {
  root.textContent = '';
  hideTip();
  const now = Date.now();
  const x = totalXp(state.days, state.ielts);
  const me = myLevel();
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', '📊 Dashboard'), el('p', 'small muted', 'พัฒนาการระยะยาวจากข้อมูลที่บันทึกในเครื่องนี้'))));

  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'ช่วงเวลา' });
  for (const r of RANGES) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(range === r), class: range === r ? 'on' : '' }, `${r} วัน`);
    b.addEventListener('click', () => { range = r; renderDashboard(root); });
    seg.append(b);
  }
  root.append(h('div', { class: 'row wrap-ok viz-filters' }, seg, el('span', 'xs muted', 'ปฏิทินด้านล่างแสดง 12 สัปดาห์เสมอ')));

  // Headline tiles for the range.
  const t = rangeTotals(state.days, x.perDay, range, now);
  root.append(h('div', { class: 'grid cols-4' },
    tile('เวลาเรียน', fmtMinutes(t.secs), `${t.days} วันล่าสุด`),   // 90 → 13 full weeks = 91 days
    tile('วันที่ได้เรียน', `${t.active}/${t.days} วัน`, 'นับวันที่มีการฝึกจริง'),
    tile('XP', num(t.xp), `ตอนนี้ Lv. ${me.lv}`),
    tile('คุย / ทบทวน', `${num(t.msgs)} / ${num(t.reviews)}`, 'ข้อความ / ข้อ')));

  root.append(heatCard(now));
  root.append(xpCard(x.perDay, now));
  if (isEnglish() || state.ielts.length) root.append(...ieltsCards(now));
  root.append(vocabCard(now));
  root.append(mistakeCard(now));
  root.append(el('p', 'xs muted', 'ทุกตัวเลขมาจากข้อมูลที่แอปบันทึกในเครื่องนี้ (และที่ซิงก์มา) ไม่มีการเดา band ของ Speaking/Writing เป็นค่าประมาณจากการฝึกโดย AI ส่วน Reading/Listening เป็น % ที่ตอบถูกของชุดสั้น ไม่ใช่คะแนนสอบจริง'));
}

function tile(label, value, sub) {
  return h('div', { class: 'card stat' }, el('div', 'label', label), el('div', 'value', value), el('div', 'sub', sub));
}

const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
function heatCard(now) {
  const cols = heatmap(state.days, now, 12);
  const days = cols.flat().filter((d) => !d.future);
  const active = days.filter((d) => d.level > 0);
  const grid = h('div', { class: 'heat', role: 'img', 'aria-label': `ได้เรียน ${active.length} จาก ${days.length} วันใน 12 สัปดาห์` },
    h('div', { class: 'heat-dow', 'aria-hidden': 'true' }, ...DOW.map((d, i) => el('span', 'xs muted', i % 2 ? '' : d))));
  for (const col of cols) {
    const c = h('div', { class: 'heat-col' });
    for (const d of col) {
      const cell = h('span', { class: `heat-cell l${d.level}${d.future ? ' future' : ''}` });
      if (!d.future) hover(cell, `${fmtDate(d.t)} · ${d.mins} นาที · คุย ${d.msgs} · ทบทวน ${d.reviews}`);
      c.append(cell);
    }
    grid.append(c);
  }
  const key = h('div', { class: 'viz-legend xs', 'aria-hidden': 'true' }, el('span', 'muted', 'น้อย'), ...[0, 1, 2, 3, 4].map((l) => h('i', { class: `heat-cell l${l}` })), el('span', 'muted', 'มาก'), el('span', 'muted', '(นาทีต่อวัน: 1+, 10+, 20+, 40+)'));
  return card('🔥 ปฏิทินการเรียน', `ได้เรียน ${active.length} จาก ${days.length} วัน ใน 12 สัปดาห์`, grid, key,
    tableView(['วันที่', 'นาที', 'คุย', 'ทบทวน'], active.slice().reverse().map((d) => [fmtDate(d.t), d.mins, d.msgs, d.reviews])));
}

function xpCard(perDay, now) {
  const { size, points } = xpSeries(perDay, range, now);
  const sum = points.reduce((s, p) => s + p.value, 0);
  const body = sum ? barChart(points, size, size > 1 ? 'XP ต่อสัปดาห์' : 'XP ต่อวัน', 'XP') : empty('ยังไม่มี XP ในช่วงนี้');
  return card(size > 1 ? '🏅 XP ต่อสัปดาห์' : '🏅 XP ต่อวัน', `รวม ${num(sum)} XP ใน ${range} วัน`, body,
    tableView(['ช่วง', 'XP'], points.map((p) => [span(p, size), p.value])));
}

function ieltsCards(now) {
  const s = ieltsSeries(state.ielts, range, now);
  const tipBand = (p) => `${fmtDate(p.t)} · band ${p.value.toFixed(1)}`;
  const tipPct = (p) => `${fmtDate(p.t)} · ${p.score}/${p.total} (${p.value}%)`;
  const out = [];
  const bands = [{ name: 'Speaking', cls: 's1', points: s.speaking.map((p) => ({ ...p, tip: tipBand(p) })) }, { name: 'Writing', cls: 's2', points: s.writing.map((p) => ({ ...p, tip: tipBand(p) })) }];
  const nb = s.speaking.length + s.writing.length;
  out.push(card('🎯 IELTS Speaking / Writing', 'band จากการฝึก (ค่าประมาณโดย AI ไม่ใช่คะแนนจริง)',
    nb ? lineChart(bands, s.since, now, 9, (v) => String(v), `band Speaking ${s.speaking.length} ครั้ง Writing ${s.writing.length} ครั้ง`) : empty('ยังไม่มีการฝึก Speaking หรือ Writing ในช่วงนี้'),
    nb ? legend([['Speaking', 's1'], ['Writing', 's2']]) : null,
    nb ? tableView(['วันที่', 'ทักษะ', 'band'], [...s.speaking.map((p) => [p.t, 'Speaking', p.value.toFixed(1)]), ...s.writing.map((p) => [p.t, 'Writing', p.value.toFixed(1)])].sort((a, b) => b[0] - a[0]).map(([t, k, v]) => [fmtDate(t), k, v])) : null));
  const pcts = [{ name: 'Reading', cls: 's1', points: s.reading.map((p) => ({ ...p, tip: tipPct(p) })) }, { name: 'Listening', cls: 's2', points: s.listening.map((p) => ({ ...p, tip: tipPct(p) })) }];
  const np = s.reading.length + s.listening.length;
  out.push(card('🎯 IELTS Reading / Listening', '% ที่ตอบถูกของชุดฝึกสั้น (ไม่แปลงเป็น band)',
    np ? lineChart(pcts, s.since, now, 100, (v) => `${v}%`, `Reading ${s.reading.length} ครั้ง Listening ${s.listening.length} ครั้ง`) : empty('ยังไม่มีการฝึก Reading หรือ Listening ในช่วงนี้'),
    np ? legend([['Reading', 's1'], ['Listening', 's2']]) : null,
    np ? tableView(['วันที่', 'ทักษะ', 'ถูก'], [...s.reading.map((p) => [p.t, 'Reading', `${p.score}/${p.total}`]), ...s.listening.map((p) => [p.t, 'Listening', `${p.score}/${p.total}`])].sort((a, b) => b[0] - a[0]).map(([t, k, v]) => [fmtDate(t), k, v])) : null));
  return out;
}

function vocabCard(now) {
  const { size, points } = vocabGrowth(state.vocab, range, now);
  const mastered = state.vocab.filter((v) => status(v.srs) === 'mastered').length;
  const learning = state.vocab.filter((v) => status(v.srs) === 'learning').length;
  const first = points[0]?.value || 0, last = points[points.length - 1]?.value || 0;
  const body = last ? lineChart([{ name: 'คลังคำ', cls: 's1', points: points.map((p) => ({ t: p.end, value: p.value, tip: `${span(p, size)} · ${num(p.value)} คำ` })) }], points[0].end, points[points.length - 1].end, niceMax(last), num, `คลังคำ ${num(last)} คำ`) : empty('ยังไม่มีคำในคลังคำ');
  return card('📘 คลังคำสะสม', `ตอนนี้ ${num(last)} คำ (+${num(last - first)} ใน ${range} วัน) · จำได้แล้ว ${num(mastered)} · กำลังจำ ${num(learning)}`, body,
    tableView(['ถึงวันที่', 'จำนวนคำ'], points.map((p) => [fmtDate(p.end), p.value])));
}

function mistakeCard(now) {
  const m = mistakeTrend(state.mistakes, range, now);
  if (!m.rows.length) return card('✏️ ข้อผิดพลาดที่พบบ่อย', `${range} วันล่าสุด`, empty('ยังไม่มีข้อผิดที่บันทึกในช่วงนี้'));
  const max = Math.max(...m.rows.map((r) => r.now));
  const list = h('div', { class: 'hbars' });
  for (const r of m.rows) {
    const name = CATEGORIES[r.category] || r.category;
    const diff = r.now - r.before;
    const change = r.before === 0 ? 'ใหม่ในช่วงนี้' : diff === 0 ? 'เท่าช่วงก่อน' : diff < 0 ? `▼ ลดลง ${-diff} จากช่วงก่อน` : `▲ เพิ่มขึ้น ${diff} จากช่วงก่อน`;
    const row = h('div', { class: 'hbar', tabindex: 0, 'aria-label': `${name} ${r.now} ครั้ง ${change}` },
      h('div', { class: 'row' }, el('span', 'small grow', name), el('b', 'small', String(r.now))),
      h('div', { class: 'hbar-track', 'aria-hidden': 'true' }, h('i', { class: 's1', style: `width:${Math.max(4, (r.now / max) * 100)}%` })),
      el('div', 'xs muted', change));
    list.append(hover(row, `${name} · ${r.now} ครั้ง (ช่วงก่อน ${r.before})`));
  }
  const totalChange = m.totalBefore ? (m.total <= m.totalBefore ? `น้อยกว่าช่วงก่อน ${m.totalBefore - m.total} ครั้ง` : `มากกว่าช่วงก่อน ${m.total - m.totalBefore} ครั้ง`) : 'ไม่มีข้อมูลช่วงก่อนให้เทียบ';
  return card('✏️ ข้อผิดพลาดที่พบบ่อย', `${range} วันล่าสุด รวม ${m.total} ครั้ง · ${totalChange} (ขึ้นกับจำนวนที่คุยด้วย)`, list,
    tableView(['หมวด', `${range} วันนี้`, 'ช่วงก่อน'], m.rows.map((r) => [CATEGORIES[r.category] || r.category, r.now, r.before])));
}
