// Characters: pick who to talk to, see a profile, and manage what each one remembers.
import { el, h, icon, toast, ago } from '../util.js';
import { settings, state, persist, emit, activeCharId, sessionOf, threadOf } from '../store.js';
import { CHARACTERS, customCharacter, ROLES } from '../engine/characters.js';
import { EMOTION_UI } from '../engine/emotion.js';
import { SCENARIOS } from '../engine/scenarios.js';
import { avatarEl } from './avatar.js';
import { switchCharacter, startScene } from './chat.js';

let open = null;   // id of the profile shown expanded

function memoryList(char, root) {
  const box = h('div', { class: 'list' });
  const items = (state.charMemory[char.id] || []).slice().reverse();
  if (settings.memoryCharacter === false) box.append(el('div', 'small muted', 'ปิดความจำของตัวละครอยู่ (เปิดได้ที่ ตั้งค่า → ความจำ)'));
  if (!items.length) box.append(el('div', 'small muted', `${char.name} ยังไม่ได้จำอะไรจากการคุยกับคุณ`));
  for (const m of items) {
    const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ลบความจำนี้' }, icon('trash'));
    del.addEventListener('click', () => {
      state.charMemory[char.id] = (state.charMemory[char.id] || []).filter((x) => x.id !== m.id);
      persist(); emit('state'); render(root);
    });
    box.append(h('div', { class: 'item' }, el('span', 'grow small', m.text), el('span', 'xs muted', ago(m.t)), del));
  }
  if (items.length) {
    const clear = h('button', { type: 'button', class: 'btn sm danger' }, `ลบความจำทั้งหมดของ ${char.name}`);
    clear.addEventListener('click', () => {
      if (!confirm(`ลบทุกอย่างที่ ${char.name} จำจากการคุยกับคุณ?`)) return;
      delete state.charMemory[char.id];
      persist(); emit('state'); render(root); toast('ลบแล้ว');
    });
    box.append(clear);
  }
  return box;
}

function profile(char, root) {
  const p = h('div', { class: 'profile' });
  const row = (label, text) => (text ? h('div', { class: 'prow' }, el('span', 'xs muted', label), el('span', 'small', text)) : null);
  if (char.custom) {
    p.append(row('บุคลิก', char.style), el('p', 'xs muted', 'แก้ชื่อและบุคลิกได้ที่ ตั้งค่า → เพื่อนที่สร้างเอง'));
  } else {
    p.append(
      row('ที่มา', `${char.home} · ${char.occupation}`),
      row('เรื่องราว', char.background),
      row('บุคลิก', char.personality.join(', ')),
      row('สไตล์การพูด', char.style),
      row('สำเนียง', `${char.accentLabel} · ภาษาแม่ ${char.nativeLanguage}`),
      row('อารมณ์ขัน', char.humor),
      row('วิธีช่วยคุณเรียน', char.learning),
    );
    const roles = h('div', { class: 'chips' });
    for (const r of char.roles) roles.append(el('span', 'chip', ROLES[r].th + (r === char.defaultRole ? ' (ปกติ)' : '')));
    p.append(h('div', { class: 'prow' }, el('span', 'xs muted', 'บทบาทที่เล่นได้'), roles));
    const fits = SCENARIOS.filter((s) => s.cast.includes(char.id));
    if (fits.length) {
      const sc = h('div', { class: 'chips' });
      for (const s of fits) {
        const b = h('button', { type: 'button', class: 'chip' }, `${s.icon} ${s.th}`);
        b.addEventListener('click', () => startScene(s, char.id));
        sc.append(b);
      }
      p.append(h('div', { class: 'prow' }, el('span', 'xs muted', 'ฝึกสถานการณ์กับ ' + char.name), sc));
    }
  }
  const s = state.sessions[char.id] ? sessionOf(char.id) : null;
  if (s && threadOf(char.id).length) {
    const ui = EMOTION_UI[s.emotion?.state] || EMOTION_UI.neutral;
    p.append(row('ตอนนี้', `${ROLES[s.role]?.th || ''} · ${ui.emoji} ${ui.th}${s.topic ? ' · คุยเรื่อง ' + s.topic : ''}`));
  }
  p.append(el('h3', 'sub', `สิ่งที่ ${char.name} จำได้`), memoryList(char, root));
  return p;
}

function card(char, root) {
  const active = activeCharId() === char.id;
  const n = threadOf(char.id).length;
  const c = h('div', { class: 'card char-card' + (active ? ' active' : '') });
  const talk = h('button', { type: 'button', class: 'btn sm ' + (active ? '' : 'primary') }, icon('chat'), active ? 'คุยอยู่' : 'คุยเลย');
  talk.addEventListener('click', () => switchCharacter(char.id));
  const more = h('button', { type: 'button', class: 'btn sm ghost', 'aria-expanded': String(open === char.id) }, open === char.id ? 'ซ่อน' : 'โปรไฟล์');
  more.addEventListener('click', () => { open = open === char.id ? null : char.id; render(root); });
  c.append(h('div', { class: 'row' }, avatarEl(char, state.sessions[char.id]?.emotion, 'lg'),
    h('div', { class: 'grow' },
      h('div', { class: 'row' }, el('b', '', char.name), char.age ? el('span', 'xs muted', `${char.age} ปี · ${char.nationality}`) : null),
      el('div', 'small', char.tagline.th),
      el('div', 'xs muted', char.custom ? 'ชื่อและบุคลิกตั้งเองได้' : char.personality.join(' · ')),
      n ? el('div', 'xs muted', `คุยแล้ว ${n} ข้อความ`) : null)),
  h('div', { class: 'row wrap-ok', style: 'margin-top:10px' }, talk, more));
  if (open === char.id) c.append(profile(char, root));
  return c;
}

function render(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ตัวละคร'),
    el('p', '', 'แต่ละคนมีนิสัย สำเนียง และความจำของตัวเอง และเปลี่ยนบทบาทตามสถานการณ์ได้ ทุกคนเป็นตัวละคร AI สมมติ'))));
  const grid = h('div', { class: 'grid md-2' });
  for (const c of [...CHARACTERS, customCharacter(settings)]) grid.append(card(c, root));
  root.append(grid);
}

export const renderCharacters = render;
