// 👮 RPCA-TEP page: practice one part at a time (about 10 questions), checked offline, with the
// answer and a Thai explanation for every question. Listening is read aloud by the device voice,
// two voices told apart by pitch. Attempts are saved with the IELTS practice (kind 'tep').
import { el, h, icon, fmtDate } from '../util.js';
import { settings, state, persist, emit, speechCode } from '../store.js';
import { tts } from '../voice/tts.js';
import { unlockSpeech, stopSpeaking } from '../speech.js';
import { PARTS, partById, buildSet, setQuestions, scoreSet, errorParts, SET_SIZE, PASS_BACHELOR, PASS_MASTER } from '../engine/tep.js';

let cur = null;          // { part, set, answers, checked, plays: {groupIndex: n} }
let playing = 0;         // id of the dialogue being read; changes to stop it
const MAX_PLAYS = 2;
const PITCH = { M: 0.85, W: 1.2 };

export function openTep(part) {
  if (part && partById(part)) cur = newSet(part);
  location.hash = '#tep';
}
const newSet = (part) => ({ part, set: buildSet(part), answers: {}, checked: false, plays: {} });

export function renderTep(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', '👮 RPCA-TEP'), el('p', 'small muted', 'ฝึกทีละพาร์ท ระดับ B1–B2 · ราว 40% เป็นบริบทงานตำรวจ · ตรวจในเครื่อง ไม่ใช้ AI'))));
  if (cur) { renderSet(root); return; }

  root.append(h('div', { class: 'card' },
    el('b', 'small', 'รูปแบบข้อสอบจริง'),
    el('p', 'small', 'ปรนัย 120 ข้อ: การฟัง 40 · ไวยากรณ์ 20 · คำศัพท์ 20 · การอ่าน 40'),
    el('p', 'small', `เกณฑ์ผ่าน: ป.ตรี ${PASS_BACHELOR}/120 · ป.โท ${PASS_MASTER}/120`),
    el('p', 'xs muted', 'ที่มา: งานวิจัยของภาควิชาภาษาอังกฤษ รร.นรต. (2569) และเว็บ rpca-tep.rpca.ac.th ข้อสอบในแอปเขียนขึ้นใหม่ทั้งหมด ไม่ใช่ข้อสอบจริง ชุดฝึกสั้นจึงไม่แปลงเป็นคะแนนสอบจริง')));

  root.append(el('h2', 'sec', 'เลือกพาร์ทที่จะฝึก'));
  const list = h('div', { class: 'tep-parts' });
  for (const p of PARTS) {
    const done = (state.ielts || []).filter((a) => a.kind === 'tep' && a.part === p.id);
    const last = done[done.length - 1];
    const b = h('button', { type: 'button', class: 'card tep-part', 'aria-label': `ฝึก${p.th} ${SET_SIZE} ข้อ` },
      el('span', 'em', p.icon),
      h('div', { class: 'grow' }, el('b', '', p.th), el('div', 'xs muted', p.desc), el('div', 'xs', `ข้อสอบจริง ${p.real} ข้อ${last ? ` · ล่าสุด ${last.score}/${last.total}` : ''}`)));
    b.addEventListener('click', () => { cur = newSet(p.id); renderTep(root); top(root); });
    list.append(b);
  }
  root.append(list);

  const hist = (state.ielts || []).filter((a) => a.kind === 'tep').slice(-6).reverse();
  if (hist.length) {
    root.append(el('h2', 'sec', 'ผลล่าสุด'));
    root.append(h('div', { class: 'card' }, ...hist.map((a) => h('div', { class: 'row lv-row' }, el('span', 'small grow', `${partById(a.part)?.icon || ''} ${partById(a.part)?.th || a.part}`), el('span', 'xs muted', fmtDate(a.t)), el('b', 'small', `${a.score}/${a.total}`)))));
  }
}
const top = (root) => root.closest('.scroll')?.scrollTo(0, 0);

function renderSet(root) {
  const p = partById(cur.part);
  const qs = setQuestions(cur.set);
  root.append(h('div', { class: 'row wrap-ok' }, el('b', '', `${p.icon} ${p.th} · ${qs.length} ข้อ`), h('span', { class: 'grow' }),
    btn('เลือกพาร์ทอื่น', 'btn sm ghost', () => { stopDialogue(); cur = null; renderTep(root); top(root); })));
  if (cur.part === 'grammar') root.append(el('p', 'xs muted', 'ข้อที่มีคำขีดเส้นใต้ A–D: เลือกส่วนที่ "ผิด" ไวยากรณ์'));

  let i = -1;
  cur.set.forEach((g, gi) => {
    const u = g.unit;
    const card = h('div', { class: 'card pad-lg tep-group' });
    if (cur.part === 'listening') card.append(listenBox(u, gi, root));
    if (u.type === 'cloze') card.append(h('div', { class: 'reading-text small', lang: 'en' }, el('p', '', u.text)));
    if (cur.part === 'reading') card.append(h('div', { class: 'reading-text small', lang: 'en' }, el('b', '', u.title), ...String(u.text).split('\n\n').map((t) => el('p', '', t))));
    for (const q of g.questions) { i += 1; card.append(questionBox(q, i)); }
    root.append(card);
  });

  if (!cur.checked) {
    root.append(btn('ตรวจคำตอบ', 'btn primary', () => {
      const missing = qs.length - Object.keys(cur.answers).length;
      if (missing && !confirm(`ยังไม่ได้ตอบ ${missing} ข้อ ข้อที่ไม่ตอบนับว่าผิด ตรวจเลยไหม?`)) return;
      stopDialogue();
      cur.checked = true;
      const { score, total } = scoreSet(cur.set, cur.answers);
      state.ielts = [...(state.ielts || []), { t: Date.now(), kind: 'tep', part: cur.part, id: cur.part, score, total }];
      persist(); emit('badges');
      renderTep(root); top(root);
    }));
    return;
  }
  const { score, total } = scoreSet(cur.set, cur.answers);
  root.querySelector('.page-head').after(h('div', { class: 'card pad-lg tep-score' },
    el('div', 'shadow-text', `ได้ ${score}/${total} ข้อ (${Math.round((score / total) * 100)}%)`),
    el('p', 'xs muted', 'ดูคำอธิบายใต้แต่ละข้อ ข้อสอบจริงมี 120 ข้อ ชุดสั้นนี้จึงไม่แปลงเป็นคะแนนเต็ม 120'),
    h('div', { class: 'row wrap-ok' },
      btn('ทำชุดใหม่ (พาร์ทเดิม)', 'btn primary', () => { cur = newSet(cur.part); renderTep(root); top(root); }),
      btn('เลือกพาร์ทอื่น', 'btn ghost', () => { cur = null; renderTep(root); top(root); }))));
}

function btn(text, cls, fn) { const b = h('button', { type: 'button', class: cls }, text); b.addEventListener('click', fn); return b; }

function questionBox(q, i) {
  const ok = cur.checked ? Number(cur.answers[i]) === q.answer && cur.answers[i] !== undefined : null;
  const box = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : ''), lang: 'en' });
  if (q.error) {
    const { pieces, marks } = errorParts(q.q);
    const line = h('div', { class: 'small tep-error' }, `${q.n}. `);
    pieces.forEach((pc, k) => { line.append(pc); if (k < marks.length) line.append(h('u', {}, marks[k]), h('sub', { class: 'xs' }, 'ABCD'[k])); });
    box.append(line);
  } else box.append(el('div', 'small', `${q.n}. ${q.q}`));
  q.options.forEach((o, j) => {
    const r = h('input', { type: 'radio', name: `tq${i}`, value: String(j) });
    r.checked = cur.answers[i] === String(j);
    r.disabled = cur.checked;
    r.addEventListener('change', () => { cur.answers[i] = String(j); });
    box.append(h('label', { class: 'small opt' }, r, ' ', `${'ABCD'[j]}  ${o}`));
  });
  if (cur.checked) {
    box.append(h('div', { class: 'tep-why xs', lang: 'th' },
      el('b', '', `${ok ? '✓ ถูก' : `✗ คำตอบ: ${'ABCD'[q.answer]} ${q.options[q.answer]}`}`), el('div', '', q.why)));
  }
  return box;
}

// Listening: reads each line in turn; M and W differ by pitch. Two plays per dialogue, as in
// many listening tests; after checking, the script is shown and can be played freely.
function listenBox(u, gi, root) {
  const n = cur.plays[gi] || 0;
  const label = { short: 'บทสนทนาสั้น', long: 'บทสนทนายาว', talk: 'การพูดคนเดียว' }[u.type];
  const play = h('button', { type: 'button', class: 'btn sm primary', 'aria-label': `ฟัง${label}` }, icon('speaker'), cur.checked ? 'ฟังอีกครั้ง' : n ? `ฟังอีกครั้ง (เหลือ ${MAX_PLAYS - n})` : 'ฟัง');
  play.disabled = !cur.checked && n >= MAX_PLAYS;
  play.addEventListener('click', () => {
    if (!cur.checked) cur.plays[gi] = n + 1;
    playDialogue(u.script);
    if (!cur.checked) renderTep(root);
  });
  const box = h('div', { class: 'tep-listen' }, h('div', { class: 'row wrap-ok' }, el('span', 'chip', label), play));
  if (cur.checked || !tts().available()) {
    if (!cur.checked) box.append(el('p', 'xs muted', 'เครื่องนี้อ่านออกเสียงไม่ได้ อ่านบทแทน'));
    box.append(h('div', { class: 'reading-text small', lang: 'en' }, ...u.script.map(([who, t]) => el('p', '', `${who === 'M' ? 'Man' : 'Woman'}: ${t}`))));
  }
  return box;
}

async function playDialogue(script) {
  unlockSpeech();
  stopSpeaking();
  const id = ++playing;
  const rate = Math.max(0.6, Math.min(1.2, Number(settings.rate) || 0.95));
  for (const [who, text] of script) {
    if (id !== playing) return;
    await tts().speak(text, { lang: speechCode(), rate, pitch: PITCH[who] || 1 });
    await new Promise((r) => setTimeout(r, 350));
  }
}
function stopDialogue() { playing += 1; stopSpeaking(); }

window.addEventListener('hashchange', () => { if (location.hash !== '#tep') stopDialogue(); });
