// Courses and IELTS practice: short courses built from the app's activities, and IELTS Speaking
// (Parts 1–3, Part 2 timer, typed or spoken answers), Writing (Task 1 and 2 with instant checks)
// and Listening (original scripts read by the device voice). AI feedback gives PRACTICE band
// estimates only; listening shows a raw score, never a band.
import { el, h, icon, toast, fmtDate } from '../util.js';
import { settings, state, persist, emit, isEnglish, ieltsBand } from '../store.js';
import {
  CUE_CARDS, TASK1, TASK2, LISTENING, IELTS_DISCLAIMER, SPEAKING_CRITERIA, WRITING_CRITERIA, MIN_SPEAKING_WORDS,
  analyseWriting, checkListening, buildSpeakingPrompt, buildWritingPrompt, parseIeltsFeedback, pickSpeaking, wordCount,
} from '../engine/ielts.js';
import { COURSES, courseProgress } from '../engine/courses.js';
import { askIelts } from '../ai.js';
import { speak, listen, stopListening, unlockSpeech, stopSpeaking } from '../speech.js';
import { stt } from '../voice/stt.js';
import { openScenario } from './roleplay.js';
import { openVoice } from './voice.js';

let tab = 'courses';
let target = null;
// Speaking
let sp = { part: 1, item: null, answer: '', busy: false, result: null };
let timer = { phase: '', left: 0, id: 0 };
let micOn = false;
// Writing
let wr = { task: 2, idx: 0, answer: '', busy: false, result: null };
// Listening
let ls = { idx: 0, answers: {}, checked: false, showScript: false, counted: new Set() };

const targetBand = () => target ?? Math.min(8, (Number(ieltsBand()) || 6) + 0.5);
const evidence = () => ({ results: state.results, ielts: state.ielts, days: state.days });
const fmtBand = (b) => (b == null ? '—' : `≈ ${b.toFixed(1)}`);
const draftKey = () => `lb_draft_${wr.task}_${(wr.task === 1 ? TASK1 : TASK2)[wr.idx].id}`;
function loadDraft() { try { return localStorage.getItem(draftKey()) || ''; } catch { return ''; } }
function saveDraft(t) { try { localStorage.setItem(draftKey(), t); } catch {} }

// Opens a tab (used by courses and other pages).
export function openLearn(which = 'courses', opts = {}) {
  tab = which;
  if (which === 'speaking' && opts.part) { sp = { ...sp, part: opts.part, item: null, result: null, answer: '' }; }
  if (which === 'writing' && opts.task) { wr = { ...wr, task: opts.task, idx: 0, result: null }; wr.answer = loadDraft(); }
  if (location.hash === '#learn') render(document.getElementById('learnBody')); else location.hash = '#learn';
}

function saveAttempt(a) {
  state.ielts = [...(state.ielts || []), a];
  persist();
  emit('badges');
}

// ---------- shared: feedback ----------
function bandRows(criteria, names) {
  const box = h('div', { class: 'band-rows' });
  for (const [k, label] of Object.entries(names)) {
    const b = criteria[k];
    box.append(h('div', { class: 'goal' }, el('span', 'xs muted', label),
      h('div', { class: 'bar' }, h('i', { style: `width:${b == null ? 0 : (b / 9) * 100}%` })), el('span', 'small', fmtBand(b))));
  }
  return box;
}
function feedbackCard(f, kind) {
  const card = h('div', { class: 'card ielts-fb' });
  card.append(h('div', { class: 'row' }, el('div', 'grow', ''), el('div', 'band-big', fmtBand(f.overall)), el('span', 'xs muted', 'band (ประมาณการ)')));
  card.append(bandRows(f.criteria, kind === 'writing' ? WRITING_CRITERIA : SPEAKING_CRITERIA));
  card.append(el('p', 'xs warn-text', '⚠️ ' + IELTS_DISCLAIMER));
  if (f.structure) card.append(el('span', 'label', 'โครงสร้าง'), el('p', 'small', f.structure));
  if (f.strengths?.length) card.append(el('span', 'label', 'จุดแข็ง'), h('ul', { class: 'small' }, ...f.strengths.map((s) => el('li', '', s))));
  if (f.improvements?.length) {
    card.append(el('span', 'label', 'ปรับให้ดีขึ้น'));
    for (const x of f.improvements) card.append(h('div', { class: 'fix-item small' }, x.original ? el('div', 'wrong', x.original) : null, el('div', 'fix-right', '→ ' + x.better), x.why ? el('div', 'xs muted', x.why) : null));
  }
  if (f.vocab?.length) card.append(el('span', 'label', 'คำ/วลีที่ใช้ได้'), h('div', { class: 'chips' }, ...f.vocab.map((v) => el('span', 'chip', v.th ? `${v.word} — ${v.th}` : v.word))));
  const model = f.sample || f.improved;
  if (model) {
    const say = h('button', { type: 'button', class: 'btn sm ghost' }, icon('speaker'), 'ฟัง');
    say.addEventListener('click', () => { unlockSpeech(); speak(model, { plain: true }); });
    card.append(el('span', 'label', f.sample ? `ตัวอย่างคำตอบ (ประมาณ band ${targetBand()})` : 'ย่อหน้าที่เขียนใหม่'), el('p', 'small model-text', model), say);
  }
  if (f.note) card.append(el('p', 'small', '💡 ' + f.note));
  return card;
}
function historyList(kind, extra = () => true) {
  const items = (state.ielts || []).filter((a) => a.kind === kind && extra(a)).slice(-5).reverse();
  if (!items.length) return null;
  return h('div', {}, el('h2', 'sec', 'ฝึกล่าสุด'), h('div', { class: 'list' }, ...items.map((a) => h('div', { class: 'item' },
    el('span', 'grow small', `${fmtDate(a.t)} · ${kind === 'speaking' ? `Part ${a.part}` : kind === 'writing' ? `Task ${a.task}` : a.id}${a.words ? ` · ${a.words} คำ` : ''}`),
    el('span', 'chip', kind === 'listening' ? `${a.score}/${a.total}` : `${fmtBand(a.overall)}`)))),
  kind !== 'listening' ? el('p', 'xs muted', 'band ทั้งหมดเป็นการประมาณจากการฝึก') : null);
}
function targetPicker(root) {
  const sel = h('select', { class: 'input', 'aria-label': 'band เป้าหมาย' }, ...[5, 5.5, 6, 6.5, 7, 7.5, 8].map((b) => Object.assign(el('option', '', `เป้า ${b}`), { value: String(b) })));
  sel.value = String(targetBand());
  sel.addEventListener('change', () => { target = Number(sel.value); });
  return sel;
}
async function getFeedback(kind, system, answer) {
  const text = await askIelts(system, answer);
  const f = parseIeltsFeedback(text, kind);
  if (!f) throw new Error('AI ตอบกลับมาไม่ครบ ลองกดอีกครั้ง');
  return f;
}

// ---------- courses ----------
function stepAction(step) {
  if (step.type === 'scenario') openScenario(step.id);
  else if (step.type === 'shadow') openVoice('shadow');
  else if (step.type === 'listen') openVoice('listen');
  else if (step.type === 'review') location.hash = '#review';
  else if (step.type === 'ielts') openLearn(step.kind, { part: step.part, task: step.task });
}
function renderCourses(body, root) {
  body.append(el('p', 'small muted', 'คอร์สสั้นที่เรียงกิจกรรมในแอปให้ทำตามลำดับ ขั้นที่ทำแล้วจะติ๊กเองจากสิ่งที่คุณทำจริงหลังเริ่มคอร์ส'));
  for (const c of COURSES.filter((x) => !x.englishOnly || isEnglish())) {
    const st = state.courses?.[c.id];
    const card = h('div', { class: 'card course' });
    card.append(h('div', { class: 'row' }, el('span', 'em', c.icon), h('div', { class: 'grow' }, el('b', '', c.th), el('div', 'xs muted', `${c.level} · ประมาณ ${c.days} วัน · ${c.steps.length} ขั้น`))));
    card.append(el('p', 'small', c.desc));
    if (!st) {
      const b = h('button', { type: 'button', class: 'btn sm primary' }, 'เริ่มคอร์ส');
      b.addEventListener('click', () => { state.courses = { ...(state.courses || {}), [c.id]: { start: Date.now() } }; persist(); toast(`เริ่มคอร์ส ${c.th}`); render(root); });
      card.append(h('ol', { class: 'small steps' }, ...c.steps.map((s) => el('li', '', s.th))), b);
    } else {
      const p = courseProgress(c, { ...evidence(), start: st.start });
      card.append(h('div', { class: 'goal' }, el('span', 'xs muted', `${p.count}/${p.total}`), h('div', { class: 'bar' + (p.complete ? ' good' : '') }, h('i', { style: `width:${(p.count / p.total) * 100}%` })), el('span', 'small', p.complete ? '🎉 จบคอร์ส' : `เริ่ม ${fmtDate(st.start)}`)));
      const ol = h('ol', { class: 'steps course-steps' });
      c.steps.forEach((s, i) => {
        const go = h('button', { type: 'button', class: 'btn sm' + (i === p.next ? ' primary' : ' ghost') }, p.done[i] ? 'ทำอีก' : 'ไป');
        go.addEventListener('click', () => stepAction(s));
        ol.append(h('li', { class: p.done[i] ? 'done' : i === p.next ? 'next' : '' }, el('span', 'grow small', `${p.done[i] ? '✅ ' : ''}${s.th}`), go));
      });
      const restart = h('button', { type: 'button', class: 'btn sm ghost' }, 'เริ่มใหม่');
      restart.addEventListener('click', () => { if (!confirm('เริ่มคอร์สนี้ใหม่? ความคืบหน้าจะนับใหม่ตั้งแต่ตอนนี้')) return; state.courses = { ...state.courses, [c.id]: { start: Date.now() } }; persist(); render(root); });
      card.append(ol, h('div', { class: 'row' }, el('span', 'grow'), restart));
    }
    body.append(card);
  }
}

// ---------- speaking ----------
function stopTimer() { clearInterval(timer.id); timer = { phase: '', left: 0, id: 0 }; }
function startTimer(phase, secs, root) {
  stopTimer();
  timer = { phase, left: secs, id: setInterval(() => {
    timer.left -= 1;
    const t = document.getElementById('spTimer');
    if (t) t.textContent = clock(timer.left);
    if (timer.left <= 0) {
      const was = timer.phase;
      stopTimer();
      if (was === 'prep') { toast('หมดเวลาเตรียม เริ่มพูดได้เลย'); startTimer('talk', 120, root); }
      else { if (micOn) stopListening(); toast('ครบ 2 นาที'); }
      render(root);
    }
  }, 1000) };
}
const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

function renderSpeaking(body, root) {
  if (!sp.item || sp.item.part !== sp.part) sp.item = pickSpeaking(sp.part);
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Part' });
  for (const p of [1, 2, 3]) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(sp.part === p), class: sp.part === p ? 'on' : '' }, `Part ${p}`);
    b.addEventListener('click', () => { stopTimer(); sp = { part: p, item: null, answer: '', busy: false, result: null }; render(root); });
    seg.append(b);
  }
  body.append(h('div', { class: 'row wrap-ok' }, seg, h('div', { class: 'grow' }, targetPicker(root))));

  const card = h('div', { class: 'card pad-lg shadow-card' });
  const it = sp.item;
  if (it.part === 2) {
    card.append(el('div', 'xs muted', 'Part 2 · การ์ดหัวข้อ เตรียม 1 นาที แล้วพูด 1–2 นาที'), el('div', 'shadow-text', it.card.title), el('div', 'small', 'You should say:'), h('ul', { class: 'small' }, ...it.card.points.map((p) => el('li', '', p))));
    const tbox = h('div', { class: 'row' }, el('span', 'timer', timer.phase ? `${timer.phase === 'prep' ? 'เตรียม' : 'พูด'} ` : ''), h('b', { id: 'spTimer', class: 'timer' }, timer.phase ? clock(timer.left) : ''));
    const tb = h('button', { type: 'button', class: 'btn sm' }, timer.phase === 'prep' ? 'ข้ามไปพูด' : timer.phase === 'talk' ? 'หยุดจับเวลา' : '⏱️ เริ่มเตรียม 1 นาที');
    tb.addEventListener('click', () => { if (timer.phase === 'prep') startTimer('talk', 120, root); else if (timer.phase === 'talk') stopTimer(); else startTimer('prep', 60, root); render(root); });
    card.append(h('div', { class: 'row wrap-ok' }, tb, tbox));
  } else {
    card.append(el('div', 'xs muted', it.part === 1 ? `Part 1 · ${it.topic.topic}` : `Part 3 · ต่อจากการ์ด "${it.card.title}"`), el('div', 'shadow-text', it.question));
  }
  const hear = h('button', { type: 'button', class: 'btn sm ghost' }, icon('speaker'), 'ฟังคำถาม');
  hear.addEventListener('click', () => { unlockSpeech(); speak(it.part === 2 ? `${it.card.title} You should say: ${it.card.points.join(', ')}.` : it.question, { plain: true }); });
  const other = h('button', { type: 'button', class: 'btn sm ghost' }, 'คำถามอื่น');
  other.addEventListener('click', () => { stopTimer(); sp = { ...sp, item: pickSpeaking(sp.part), answer: '', result: null }; render(root); });
  card.append(h('div', { class: 'row wrap-ok' }, hear, other));

  const ta = h('textarea', { class: 'input', id: 'spAnswer', rows: it.part === 2 ? '8' : '4', lang: 'en', placeholder: stt().available() ? 'พิมพ์คำตอบ หรือกด 🎙️ แล้วพูด (ระบบจะถอดเป็นข้อความ)' : 'พิมพ์คำตอบเป็นภาษาอังกฤษ', 'aria-label': 'คำตอบ' });
  ta.value = sp.answer;
  const wc = el('div', 'xs muted', '');
  const updateWc = () => { const n = wordCount(ta.value); wc.textContent = `${n} คำ · ต้องมีอย่างน้อย ${MIN_SPEAKING_WORDS[it.part]} คำเพื่อขอคำติชม`; };
  ta.addEventListener('input', () => { sp.answer = ta.value; updateWc(); });
  updateWc();
  card.append(ta, wc);

  const actions = h('div', { class: 'row wrap-ok' });
  if (stt().available()) {
    const mic = h('button', { type: 'button', class: 'btn' + (micOn ? ' on' : ''), id: 'spMic' }, icon('mic'), micOn ? 'หยุดฟัง' : 'พูดคำตอบ');
    mic.addEventListener('click', () => {
      if (micOn) { micOn = false; stopListening(); render(root); return; }
      stopSpeaking();
      micOn = startMic(root);
      render(root);
    });
    actions.append(mic);
  }
  const ask = h('button', { type: 'button', class: 'btn primary' }, sp.busy ? 'กำลังประเมิน…' : 'ขอคำติชม (AI)');
  ask.disabled = sp.busy;
  ask.addEventListener('click', async () => {
    const n = wordCount(sp.answer);
    if (n < MIN_SPEAKING_WORDS[it.part]) { toast(`ตอบอีกนิด: มี ${n} คำ ต้องมีอย่างน้อย ${MIN_SPEAKING_WORDS[it.part]} คำ`, true); return; }
    if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
    stopTimer(); sp.busy = true; render(root);
    try {
      const f = await getFeedback('speaking', buildSpeakingPrompt({ part: it.part, question: it.question, card: it.card, target: targetBand() }), sp.answer);
      sp.result = f;
      saveAttempt({ t: Date.now(), kind: 'speaking', part: it.part, id: it.card?.id || it.topic?.id, question: it.question, answer: sp.answer, words: n, criteria: f.criteria, overall: f.overall, target: targetBand(), feedback: f });
    } catch (e) { toast(e.message, true); }
    sp.busy = false; render(root);
  });
  actions.append(ask);
  card.append(actions);
  if (it.part === 2) card.append(h('div', { class: 'chips' }, el('span', 'xs muted', 'คำที่ใช้ได้:'), ...it.card.vocab.map((v) => el('span', 'chip', v))));
  body.append(card);
  if (sp.result) body.append(feedbackCard(sp.result, 'speaking'));
  const hist = historyList('speaking');
  if (hist) body.append(hist);
}
// Speech recognition stops after a pause. Each run appends to the answer; during the Part 2 talk
// it starts again until the learner stops it or the 2 minutes are up. The text box is looked up
// by id because the page may have been redrawn since.
function startMic(root) {
  const base = sp.answer.trim();
  return listen({
    onText: (t) => {
      sp.answer = (base + ' ' + t).trim();
      const box = document.getElementById('spAnswer');
      if (box) { box.value = sp.answer; box.dispatchEvent(new Event('input')); }
    },
    onEnd: (t) => {
      if (t) sp.answer = (base + ' ' + t).trim();
      if (micOn && timer.phase === 'talk') { micOn = startMic(root); if (micOn) return; }
      micOn = false;
      render(root);
    },
    onError: (e) => { micOn = false; if (e === 'not-allowed' || e === 'service-not-allowed') toast('ไม่ได้รับอนุญาตให้ใช้ไมค์', true); render(root); },
  });
}

// ---------- writing ----------
function renderWriting(body, root) {
  const list = wr.task === 1 ? TASK1 : TASK2;
  wr.idx = Math.min(wr.idx, list.length - 1);
  const item = list[wr.idx];
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Task' });
  for (const t of [1, 2]) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(wr.task === t), class: wr.task === t ? 'on' : '' }, `Task ${t}`);
    b.addEventListener('click', () => { wr = { task: t, idx: 0, answer: '', busy: false, result: null }; wr.answer = loadDraft(); render(root); });
    seg.append(b);
  }
  body.append(h('div', { class: 'row wrap-ok' }, seg, h('div', { class: 'grow' }, targetPicker(root))));

  const card = h('div', { class: 'card pad-lg shadow-card' });
  card.append(el('div', 'xs muted', `Task ${wr.task} · ข้อ ${wr.idx + 1}/${list.length} · อย่างน้อย ${wr.task === 1 ? 150 : 250} คำ · ประมาณ ${wr.task === 1 ? 20 : 40} นาที`), el('p', 'small', item.prompt));
  if (item.table) {
    const tbl = h('table', { class: 'data-table' }, h('thead', {}, h('tr', {}, ...item.table.columns.map((c) => el('th', '', c)))), h('tbody', {}, ...item.table.rows.map((r) => h('tr', {}, ...r.map((c) => el('td', '', c))))));
    card.append(h('div', { class: 'table-wrap' }, tbl), el('p', 'xs muted', 'ข้อมูลสมมติสำหรับฝึก'));
  }
  const nav = h('div', { class: 'row' });
  const prev = h('button', { type: 'button', class: 'btn sm ghost' }, '← ข้อก่อน');
  prev.addEventListener('click', () => { wr.idx = (wr.idx - 1 + list.length) % list.length; wr.answer = loadDraft(); wr.result = null; render(root); });
  const next = h('button', { type: 'button', class: 'btn sm ghost' }, 'ข้อถัดไป →');
  next.addEventListener('click', () => { wr.idx = (wr.idx + 1) % list.length; wr.answer = loadDraft(); wr.result = null; render(root); });
  nav.append(prev, el('span', 'grow'), next);
  card.append(nav);

  if (!wr.answer) wr.answer = loadDraft();
  const ta = h('textarea', { class: 'input essay', rows: '14', lang: 'en', placeholder: 'เขียนเป็นภาษาอังกฤษ เว้นบรรทัดว่างระหว่างย่อหน้า (บันทึกร่างไว้ในเครื่องให้อัตโนมัติ)', 'aria-label': 'เรียงความ' });
  ta.value = wr.answer;
  const live = h('div', { class: 'xs muted live-analysis' });
  const draw = () => {
    const a = analyseWriting(ta.value, wr.task);
    live.textContent = '';
    live.append(el('div', '', `${a.words}/${a.min} คำ · ${a.paragraphs} ย่อหน้า · ${a.sentences} ประโยค (เฉลี่ย ${a.avgSentence} คำ/ประโยค) · คำเชื่อม ${a.linkers.length}`));
    for (const n of a.notes.slice(0, 4)) live.append(el('div', '', '• ' + n));
  };
  ta.addEventListener('input', () => { wr.answer = ta.value; saveDraft(ta.value); draw(); });
  draw();
  card.append(ta, live, el('p', 'xs muted', 'ตัวเลขด้านบนคำนวณในเครื่องทันที (ไม่ใช้ AI)'));

  const ask = h('button', { type: 'button', class: 'btn primary' }, wr.busy ? 'กำลังประเมิน…' : 'ขอคำติชม (AI)');
  ask.disabled = wr.busy;
  ask.addEventListener('click', async () => {
    const a = analyseWriting(wr.answer, wr.task);
    if (a.words < Math.round(a.min * 0.5)) { toast(`เขียนอีกหน่อย: มี ${a.words} คำ (ควรมีอย่างน้อย ${a.min})`, true); return; }
    if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
    wr.busy = true; render(root);
    try {
      const f = await getFeedback('writing', buildWritingPrompt({ task: wr.task, item, target: targetBand() }), wr.answer);
      wr.result = f;
      saveAttempt({ t: Date.now(), kind: 'writing', task: wr.task, id: item.id, question: item.prompt.slice(0, 400), answer: wr.answer, words: a.words, criteria: f.criteria, overall: f.overall, target: targetBand(), feedback: f });
    } catch (e) { toast(e.message, true); }
    wr.busy = false; render(root);
  });
  card.append(ask);
  body.append(card);
  if (wr.result) body.append(feedbackCard(wr.result, 'writing'));
  const hist = historyList('writing');
  if (hist) body.append(hist);
}

// ---------- listening ----------
function renderListening(body, root) {
  const item = LISTENING[ls.idx];
  const pick = h('select', { class: 'input', 'aria-label': 'เลือกชุดฟัง' }, ...LISTENING.map((l, i) => Object.assign(el('option', '', `${l.title} (${l.level})`), { value: String(i) })));
  pick.value = String(ls.idx);
  pick.addEventListener('change', () => { ls = { ...ls, idx: Number(pick.value), answers: {}, checked: false, showScript: false }; render(root); });
  body.append(pick);
  const card = h('div', { class: 'card pad-lg shadow-card' });
  const play = (slow) => { unlockSpeech(); speak(item.script, { plain: true, slow }); };
  const b1 = h('button', { type: 'button', class: 'btn primary' }, icon('speaker'), 'ฟัง');
  b1.addEventListener('click', () => play(false));
  const b2 = h('button', { type: 'button', class: 'btn' }, 'ฟังช้า 🐢');
  b2.addEventListener('click', () => play(true));
  const b3 = h('button', { type: 'button', class: 'btn ghost' }, 'หยุด');
  b3.addEventListener('click', () => stopSpeaking());
  card.append(el('div', 'xs muted', 'ฟังแล้วตอบคำถาม (บทฟังเขียนขึ้นใหม่สำหรับแอปนี้ อ่านด้วยเสียงในเครื่อง)'), h('div', { class: 'row wrap-ok' }, b1, b2, b3));
  item.questions.forEach((q, i) => {
    const ok = ls.checked ? checkListening(q, ls.answers[i]) : null;
    const row = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : '') }, el('div', 'small', `${i + 1}. ${q.q}`));
    if (q.type === 'mc') {
      q.options.forEach((o, j) => {
        const r = h('input', { type: 'radio', name: `lq${i}`, value: String(j) });
        r.checked = ls.answers[i] === String(j);
        r.disabled = ls.checked;
        r.addEventListener('change', () => { ls.answers[i] = String(j); });
        row.append(h('label', { class: 'small opt' }, r, ' ', o));
      });
    } else {
      const inp = h('input', { class: 'input', type: 'text', lang: 'en', autocomplete: 'off', 'aria-label': `คำตอบข้อ ${i + 1}` });
      inp.value = ls.answers[i] || '';
      inp.disabled = ls.checked;
      inp.addEventListener('input', () => { ls.answers[i] = inp.value; });
      row.append(inp);
    }
    if (ls.checked && !ok) row.append(el('div', 'xs', `คำตอบ: ${q.type === 'mc' ? q.options[q.answer] : q.answer}`));
    card.append(row);
  });
  if (!ls.checked) {
    const check = h('button', { type: 'button', class: 'btn primary' }, 'ตรวจคำตอบ');
    check.addEventListener('click', () => {
      ls.checked = true;
      const score = item.questions.filter((q, i) => checkListening(q, ls.answers[i])).length;
      // Only the first check of a set on each visit is saved.
      if (!ls.counted.has(item.id)) { ls.counted.add(item.id); saveAttempt({ t: Date.now(), kind: 'listening', id: item.id, score, total: item.questions.length }); }
      render(root);
    });
    card.append(check);
  } else {
    const score = item.questions.filter((q, i) => checkListening(q, ls.answers[i])).length;
    card.append(el('div', 'small', `ได้ ${score}/${item.questions.length} ข้อ`), el('p', 'xs muted', 'IELTS Listening จริงมี 40 ข้อ แอปจึงไม่แปลงคะแนนชุดสั้นนี้เป็น band'));
    const again = h('button', { type: 'button', class: 'btn sm ghost' }, 'ลองใหม่');
    again.addEventListener('click', () => { ls = { ...ls, answers: {}, checked: false }; render(root); });
    const show = h('button', { type: 'button', class: 'btn sm' }, ls.showScript ? 'ซ่อนบทฟัง' : 'ดูบทฟัง');
    show.addEventListener('click', () => { ls.showScript = !ls.showScript; render(root); });
    card.append(h('div', { class: 'row' }, again, show));
    if (ls.showScript) card.append(el('p', 'small model-text', item.script));
  }
  body.append(card);
  const hist = historyList('listening');
  if (hist) body.append(hist);
}

function render(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'คอร์สและ IELTS'),
    el('p', '', 'คอร์สสั้นจากกิจกรรมในแอป และฝึก IELTS Speaking, Writing, Listening ด้วยโจทย์ที่เขียนขึ้นใหม่ — band ทั้งหมดเป็นการประมาณจากการฝึก'))));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  for (const [id, label] of [['courses', '📚 คอร์ส'], ['speaking', '🎤 Speaking'], ['writing', '✍️ Writing'], ['listening', '👂 Listening']]) {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id) }, label);
    b.addEventListener('click', () => { if (micOn) { micOn = false; stopListening(); } tab = id; render(root); });
    tabs.append(b);
  }
  root.append(tabs);
  const body = h('div', { class: 'learn-body' });
  root.append(body);
  if (tab !== 'courses' && !isEnglish()) { body.append(h('div', { class: 'card small muted' }, 'IELTS ใช้ได้เมื่อเลือกเรียนภาษาอังกฤษ (ตั้งค่า → ภาษา)')); return; }
  if (tab === 'courses') renderCourses(body, root);
  else if (tab === 'speaking') renderSpeaking(body, root);
  else if (tab === 'writing') renderWriting(body, root);
  else renderListening(body, root);
}

export const renderLearn = render;

// Leaving the page stops the timer, the microphone and the voice.
window.addEventListener('hashchange', () => {
  if (location.hash === '#learn') return;
  stopTimer();
  if (micOn) { micOn = false; stopListening(); }
});
