// Role-play: a searchable scenario library (category and level filters), details with goals,
// difficulty and who to practise with, past attempts with progress, and custom scenes.
import { el, h, fmtDate } from '../util.js';
import { settings, state, isEnglish, activeCharId, cefrOf } from '../store.js';
import {
  SCENARIOS, SCENARIO_CATEGORIES, VARIANTS, scoreLabel, resultNote, IELTS_NOTE_TH,
  searchScenarios, fitsLevel, progressOf, attemptsOf, categoryOf,
} from '../engine/scenarios.js';
import { CHARACTERS, getCharacter, ROLES } from '../engine/characters.js';
import { roleForScenario } from '../engine/roles.js';
import { avatarEl } from './avatar.js';
import { startScene } from '../conversation.js';
import { emptyState, sectionHeader } from './ui.js';

let picked = null;                                 // scenario id whose details are open
let filter = { q: '', category: '', myLevel: false };
let variant = 'normal';
let scrollToPicked = false;                        // set when another page opens a scenario

// Opens the scenario library with one scenario's details shown (used by the home page plan).
export function openScenario(id) {
  picked = id;
  filter = { q: '', category: '', myLevel: false };
  scrollToPicked = true;
  location.hash = '#roleplay';
}

// A scene the learner has not done lately and that fits their level (IELTS first if they set a band).
export function suggestScene() {
  const done = new Set(state.results.slice(-6).map((r) => r.id || r.scene));
  if (/^IELTS /.test(settings.level) && isEnglish() && !done.has('ielts')) return SCENARIOS.find((s) => s.id === 'ielts');
  const pool = searchScenarios(SCENARIOS, { cefr: cefrOf(), english: isEnglish() }).filter((s) => !done.has(s.id) && !done.has(s.th));
  return pool.length ? pool[new Date().getDate() % pool.length] : null;
}

function badge(s) {
  const p = progressOf(state.results, s.id);
  if (!p.count) return null;
  const best = p.best == null ? '' : ` · ดีสุด ${scoreLabel({ id: s.id, scene: s.th, score: p.best })}`;
  return el('span', 'scene-badge', `✅ ${p.count} ครั้ง${best}`);
}

function attemptRow(r) {
  const label = scoreLabel(r);
  const crit = (r.criteria || []).map((c) => `${c.name} ${c.score}/5`).join(' · ');
  const steps = r.total ? ` · ทำได้ ${r.step}/${r.total} ขั้น` : '';
  return h('div', { class: 'attempt' },
    h('div', { class: 'row' }, el('span', 'grow small', `${fmtDate(r.t)} · ${getCharacter(r.char || 'buddy', settings).name} · ${(VARIANTS[r.variant] || VARIANTS.normal).th}${steps}`),
      label ? el('span', 'chip ' + (r.score >= 7 ? 'good' : r.score >= 5 ? 'warn' : 'bad'), label) : null),
    crit ? el('div', 'xs muted', crit) : null);
}

function details(s, root) {
  const box = h('div', { class: 'card scene-detail' });
  const li = (items) => h('ul', { class: 'small' }, ...items.map((t) => el('li', '', t)));
  const fit = fitsLevel(s, cefrOf());
  box.append(
    h('div', { class: 'row' }, el('span', 'em', s.icon), h('div', { class: 'grow' }, el('b', '', s.th), el('div', 'xs muted', `${s.title_en} · ${categoryOf(s.category).th}`))),
    el('p', 'small', s.environment),
    h('div', { class: 'row wrap-ok' }, el('span', 'chip' + (fit ? ' good' : ''), `ระดับ ${s.cefr[0]}–${s.cefr[1]}${fit ? ' · เหมาะกับคุณ' : ` · คุณอยู่ ${cefrOf()}`}`), el('span', 'chip', `คุณเป็น: ${s.userRole}`)),
    ...(s.id === 'ielts' ? [el('p', 'xs warn-text', '⚠️ ' + IELTS_NOTE_TH)] : []),
    el('span', 'label', 'เป้าหมาย'), li(s.objectives),
    el('span', 'label', `ขั้นตอน (${s.steps.length})`), h('ol', { class: 'small steps' }, ...s.steps.map((x) => el('li', '', x.th))),
    el('span', 'label', 'ประโยคที่ใช้ได้'), h('div', { class: 'chips' }, ...s.expressions.map((v) => el('span', 'chip', v))),
    el('span', 'label', 'คำศัพท์'), h('div', { class: 'chips' }, ...s.vocab.map((v) => el('span', 'chip', v))),
  );

  // Difficulty
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'ความยาก' });
  for (const [id, v] of Object.entries(VARIANTS)) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(variant === id), class: variant === id ? 'on' : '' }, v.th);
    b.addEventListener('click', () => { variant = id; renderRoleplay(root); });
    seg.append(b);
  }
  box.append(el('span', 'label', 'ความยาก'), seg);

  // Who to practise with: recommended characters first; any character can play it.
  box.append(el('span', 'label', 'ฝึกกับใคร (แตะเพื่อเริ่ม)'));
  const order = [...s.cast.filter((id) => id !== 'buddy'), ...CHARACTERS.map((c) => c.id).filter((id) => !s.cast.includes(id))];
  if (s.cast.includes('buddy')) order.push('buddy');
  const who = h('div', { class: 'cast' });
  for (const id of order) {
    const c = getCharacter(id, settings);
    const b = h('button', { type: 'button', class: 'cast-btn' + (s.cast.includes(id) ? ' rec' : '') },
      avatarEl(c, null, 'sm'), h('span', {}, el('b', '', c.name), el('small', '', (ROLES[roleForScenario(s, c)] || ROLES.scene).th)));
    b.addEventListener('click', () => startScene(s, id, variant));
    who.append(b);
  }
  box.append(who, el('p', 'xs muted', '⭐ = เหมาะกับสถานการณ์นี้'));

  // Past attempts and progress
  const tries = attemptsOf(state.results, s.id);
  if (tries.length) {
    const p = progressOf(state.results, s.id);
    const trend = p.delta == null ? '' : p.delta > 0 ? ` · ครั้งล่าสุดดีขึ้น +${p.delta}` : p.delta < 0 ? ` · ครั้งล่าสุดลดลง ${p.delta}` : ' · เท่าครั้งก่อน';
    box.append(el('span', 'label', `ฝึกไปแล้ว ${tries.length} ครั้ง${trend}`), h('div', { class: 'list' }, ...tries.slice(0, 5).map(attemptRow)));
    const last = tries[0];
    const again = h('button', { type: 'button', class: 'btn sm primary' }, `เล่นอีกครั้งกับ ${getCharacter(last.char || 'buddy', settings).name}`);
    again.addEventListener('click', () => startScene(s, last.char || activeCharId(), variant));
    box.append(h('div', { class: 'row' }, again));
  }

  const close = h('button', { type: 'button', class: 'btn sm ghost' }, 'ปิด');
  close.addEventListener('click', () => { picked = null; renderRoleplay(root); });
  box.append(close);
  return box;
}

function filters(root) {
  const wrap = h('div', { class: 'scene-filters' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'ค้นหา เช่น หมอ, hotel, ขอโทษ', value: filter.q, 'aria-label': 'ค้นหาสถานการณ์' });
  search.addEventListener('input', () => { filter.q = search.value; drawList(root); });
  const chips = h('div', { class: 'chips' });
  const chip = (label, pressed, onClick) => { const c = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(pressed) }, label); c.addEventListener('click', onClick); return c; };
  chips.append(chip(`🎯 ระดับฉัน (${cefrOf()})`, filter.myLevel, () => { filter.myLevel = !filter.myLevel; renderRoleplay(root); }));
  chips.append(chip('ทั้งหมด', !filter.category, () => { filter.category = ''; renderRoleplay(root); }));
  for (const c of SCENARIO_CATEGORIES) {
    if (c.englishOnly && !isEnglish()) continue;
    if (!SCENARIOS.some((s) => s.category === c.id)) continue;
    chips.append(chip(`${c.icon} ${c.th}`, filter.category === c.id, () => { filter.category = filter.category === c.id ? '' : c.id; renderRoleplay(root); }));
  }
  wrap.append(search, chips);
  return wrap;
}

// The scenario cards, grouped by category; only this part redraws while typing a search.
function drawList(root) {
  const list = root.querySelector('#sceneList');
  if (!list) return;
  list.textContent = '';
  const found = searchScenarios(SCENARIOS, { q: filter.q, category: filter.category, cefr: filter.myLevel ? cefrOf() : '', english: isEnglish() });
  if (!found.length) { list.append(emptyState('🔍', 'ไม่พบสถานการณ์ที่ตรงกับตัวกรอง — ลองคำอื่น หรือสร้างสถานการณ์เองด้านล่าง')); return; }
  for (const cat of SCENARIO_CATEGORIES) {
    const items = found.filter((s) => s.category === cat.id);
    if (!items.length) continue;
    list.append(el('h2', 'sec', `${cat.icon} ${cat.th}`));
    const grid = h('div', { class: 'scenes' });
    for (const s of items) {
      const b = h('button', { type: 'button', class: 'scene' + (picked === s.id ? ' on' : ''), 'aria-expanded': String(picked === s.id) },
        el('span', 'em', s.icon), el('b', '', s.th), el('small', '', s.sub), el('small', 'lvl', `${s.cefr[0]}–${s.cefr[1]}`), badge(s));
      b.addEventListener('click', () => { picked = picked === s.id ? null : s.id; renderRoleplay(root); });
      grid.append(b);
    }
    list.append(grid);
    const open = items.find((x) => x.id === picked);
    if (open) list.append(details(open, root));
  }
}

export function renderRoleplay(root) {
  root.textContent = '';
  root.append(h('a', { class: 'btn sm ghost', href: '#learn', style: 'float:right' }, '🎓 คอร์สและ IELTS'));
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ฝึกสถานการณ์จริง'),
    el('p', '', `${SCENARIOS.filter((s) => !s.englishOnly || isEnglish()).length} สถานการณ์ เลือกความยากและตัวละครได้ ระหว่างฝึกจะเห็นว่าถึงขั้นไหนแล้ว พอเสร็จกด "จบและขอคำแนะนำ" จะได้คะแนนแยกตามเกณฑ์และเทียบกับครั้งก่อน`))));

  if (state.scene) {
    const c = getCharacter(state.scene.char || 'buddy', settings);
    const prog = state.scene.total ? ` · ขั้น ${state.scene.step}/${state.scene.total}` : '';
    root.append(h('div', { class: 'card', style: 'border-color: var(--warn)' },
      h('div', { class: 'row' }, el('span', 'grow small', `${state.scene.icon} กำลังฝึกอยู่: ${state.scene.th} กับ ${c.name}${prog}`), h('a', { class: 'btn sm', href: '#chat' }, 'กลับไปที่แชต'))));
  }

  root.append(filters(root), h('div', { id: 'sceneList' }));
  drawList(root);
  if (scrollToPicked) { scrollToPicked = false; requestAnimationFrame(() => root.querySelector('.scene-detail')?.scrollIntoView({ block: 'start' })); }

  root.append(el('h2', 'sec', 'สร้างสถานการณ์เอง'));
  const inp = h('input', { class: 'input', type: 'text', maxlength: '120', placeholder: 'เช่น คุยกับเจ้าของห้องเช่าเรื่องค่าไฟ' });
  const go = h('button', { type: 'button', class: 'btn primary' }, `เริ่มกับ ${getCharacter(activeCharId(), settings).name}`);
  go.addEventListener('click', () => {
    const t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    startScene({ custom: true, icon: '🎭', th: t }, null, variant);
  });
  root.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, inp), go));

  const res = state.results.slice(-8).reverse();
  if (res.length) {
    root.append(el('h2', 'sec', 'ผลการฝึกล่าสุด'));
    const list = h('div', { class: 'list' });
    for (const r of res) {
      const label = scoreLabel(r);
      const score = label == null ? null : el('span', 'chip ' + (r.score >= 7 ? 'good' : r.score >= 5 ? 'warn' : 'bad'), label);
      const who = r.char ? ` · ${getCharacter(r.char, settings).name}` : '';
      const item = h('div', { class: 'item', style: 'flex-direction:column; align-items:stretch; cursor:pointer', tabindex: '0', role: 'button', 'aria-expanded': 'false' },
        h('div', { class: 'row' }, el('span', 'ico', r.icon || '🎭'), el('span', 'grow small', r.scene + who), score, el('span', 'xs muted', fmtDate(r.t))));
      const crit = (r.criteria || []).map((c) => `${c.name} ${c.score}/5`).join(' · ');
      const sum = el('div', 'small muted', (r.summary || '') + (crit ? `\n\n📊 ${crit}` : '') + (resultNote(r) ? `\n\n⚠️ ${resultNote(r)}` : ''));
      sum.hidden = true;
      sum.style.whiteSpace = 'pre-wrap';
      item.append(sum);
      const toggle = () => { sum.hidden = !sum.hidden; item.setAttribute('aria-expanded', String(!sum.hidden)); };
      item.addEventListener('click', toggle);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      list.append(item);
    }
    root.append(list);
  }
}
