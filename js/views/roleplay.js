// Role-play: scenarios grouped by theme; choosing one shows its goals and who to practise with.
import { el, h, fmtDate } from '../util.js';
import { settings, state, isEnglish, activeCharId } from '../store.js';
import { SCENARIOS, SCENARIO_GROUPS } from '../engine/scenarios.js';
import { CHARACTERS, getCharacter, ROLES } from '../engine/characters.js';
import { roleForScenario } from '../engine/roles.js';
import { avatarEl } from './avatar.js';
import { startScene } from './chat.js';

let picked = null;   // scenario id whose details are open

// A scene the learner has not done lately (IELTS first if they set a band).
export function suggestScene() {
  const done = new Set(state.results.slice(-6).map((r) => r.scene));
  const pool = SCENARIOS.filter((s) => (!s.englishOnly || isEnglish()) && !done.has(s.th));
  if (/^IELTS /.test(settings.level) && isEnglish() && !done.has('สอบพูด IELTS')) return SCENARIOS.find((s) => s.id === 'ielts');
  return pool.length ? pool[new Date().getDate() % pool.length] : null;
}

function details(s, root) {
  const box = h('div', { class: 'card scene-detail' });
  const li = (items) => h('ul', { class: 'small' }, ...items.map((t) => el('li', '', t)));
  box.append(
    h('div', { class: 'row' }, el('span', 'em', s.icon), h('div', { class: 'grow' }, el('b', '', s.th), el('div', 'xs muted', `${s.environment} · ระดับประมาณ ${s.difficulty}`))),
    el('span', 'label', `คุณเป็น: ${s.userRole}`),
    el('span', 'label', 'เป้าหมาย'), li(s.objectives),
    el('span', 'label', 'คำ/วลีที่จะได้ใช้'), h('div', { class: 'chips' }, ...s.vocab.map((v) => el('span', 'chip', v))),
    el('span', 'label', 'ฝึกกับใคร'),
  );
  // Recommended characters first; any character can play it.
  const order = [...s.cast.filter((id) => id !== 'buddy'), ...CHARACTERS.map((c) => c.id).filter((id) => !s.cast.includes(id))];
  if (s.cast.includes('buddy')) order.push('buddy');
  const who = h('div', { class: 'cast' });
  for (const id of order) {
    const c = getCharacter(id, settings);
    const b = h('button', { type: 'button', class: 'cast-btn' + (s.cast.includes(id) ? ' rec' : '') },
      avatarEl(c, null, 'sm'), h('span', {}, el('b', '', c.name), el('small', '', (ROLES[roleForScenario(s, c)] || ROLES.scene).th)));
    b.addEventListener('click', () => startScene(s, id));
    who.append(b);
  }
  box.append(who, el('p', 'xs muted', '⭐ = เหมาะกับสถานการณ์นี้ · แตะชื่อเพื่อเริ่ม'));
  const close = h('button', { type: 'button', class: 'btn sm ghost' }, 'ปิด');
  close.addEventListener('click', () => { picked = null; renderRoleplay(root); });
  box.append(close);
  return box;
}

export function renderRoleplay(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ฝึกสถานการณ์จริง'),
    el('p', '', 'เลือกสถานการณ์และตัวละคร ตัวละครจะเปลี่ยนบทบาทแต่ยังเป็นตัวเอง พอเสร็จกด "จบและขอคำแนะนำ" ในแชต จะได้คะแนนและคำแนะนำเป็นภาษาไทย'))));

  if (state.scene) {
    const c = getCharacter(state.scene.char || 'buddy', settings);
    root.append(h('div', { class: 'card', style: 'border-color: var(--warn)' },
      h('div', { class: 'row' }, el('span', 'grow small', `${state.scene.icon} กำลังฝึกอยู่: ${state.scene.th} กับ ${c.name}`), h('a', { class: 'btn sm', href: '#chat' }, 'กลับไปที่แชต'))));
  }

  for (const g of SCENARIO_GROUPS) {
    if (g.englishOnly && !isEnglish()) continue;
    root.append(el('h2', 'sec', g.th));
    const grid = h('div', { class: 'scenes' });
    for (const s of SCENARIOS.filter((x) => x.group === g.id)) {
      const b = h('button', { type: 'button', class: 'scene' + (picked === s.id ? ' on' : ''), 'aria-expanded': String(picked === s.id) }, el('span', 'em', s.icon), el('b', '', s.th), el('small', '', s.sub));
      b.addEventListener('click', () => { picked = picked === s.id ? null : s.id; renderRoleplay(root); });
      grid.append(b);
    }
    root.append(grid);
    const open = SCENARIOS.find((x) => x.id === picked && x.group === g.id);
    if (open) root.append(details(open, root));
  }

  root.append(el('h2', 'sec', 'สร้างสถานการณ์เอง'));
  const inp = h('input', { class: 'input', type: 'text', maxlength: '120', placeholder: 'เช่น คุยกับเจ้าของห้องเช่าเรื่องแอร์เสีย' });
  const go = h('button', { type: 'button', class: 'btn primary' }, `เริ่มกับ ${getCharacter(activeCharId(), settings).name}`);
  go.addEventListener('click', () => {
    const t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    startScene({ custom: true, icon: '🎭', th: t });
  });
  root.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, inp), go));

  const res = state.results.slice(-8).reverse();
  if (res.length) {
    root.append(el('h2', 'sec', 'ผลการฝึกล่าสุด'));
    const list = h('div', { class: 'list' });
    for (const r of res) {
      const score = r.score == null ? null : el('span', 'chip ' + (r.score >= 7 ? 'good' : r.score >= 5 ? 'warn' : 'bad'), `${r.score}/10`);
      const who = r.char ? ` · ${getCharacter(r.char, settings).name}` : '';
      const item = h('div', { class: 'item', style: 'flex-direction:column; align-items:stretch; cursor:pointer' },
        h('div', { class: 'row' }, el('span', 'ico', r.icon || '🎭'), el('span', 'grow small', r.scene + who), score, el('span', 'xs muted', fmtDate(r.t))));
      const sum = el('div', 'small muted', r.summary);
      sum.hidden = true;
      sum.style.whiteSpace = 'pre-wrap';
      item.append(sum);
      item.addEventListener('click', () => { sum.hidden = !sum.hidden; });
      list.append(item);
    }
    root.append(list);
  }
}
