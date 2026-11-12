// Review hub: spaced-repetition session, vocabulary bank, and the Mistake Book.
import { el, h, icon, num, fmtDate, toast } from '../util.js';
import { state, persist, emit, addWord, logActivity, cefrOf, CATEGORIES } from '../store.js';
import { schedule, preview, status, STATUS_TH, isDue } from '../srs.js';
import { dueCards, recordReview, recordWord } from '../stats.js';
import { askIelts } from '../ai.js';
import { isEnglishWord, buildDefinePrompt, defineInput, parseDefine, MANY_BATCH, needsMeaning, buildDefineManyPrompt, defineManyInput, parseDefineMany } from '../engine/define.js';
import { speak } from '../speech.js';
import { quiz } from '../conversation.js';
import { emptyState, sectionHeader } from './ui.js';

let tab = 'review';
let session = null;        // { queue: [{kind,item}], done, again }
let revealed = false;
let mFilter = { q: '', cat: '', st: '' };
let vQuery = '';

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const statusChip = (card) => {
  const s = status(card);
  return el('span', 'chip ' + (s === 'mastered' ? 'good' : s === 'learning' ? 'warn' : ''), STATUS_TH[s]);
};
function nextLabel(card) {
  if (isDue(card)) return 'ถึงเวลาทบทวน';
  const days = Math.ceil((card.due - Date.now()) / 86400000);
  return days <= 1 ? 'ทบทวนพรุ่งนี้' : `ทบทวนอีก ${days} วัน`;
}

export function renderReview(root) {
  root.textContent = '';
  const due = dueCards().length;
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ทบทวน'), el('p', '', 'ระบบทบทวนแบบเว้นระยะ — คำที่จำยากจะกลับมาบ่อยขึ้น')), h('a', { class: 'btn sm', href: '#mywords' }, '📥 คำของฉัน')));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  for (const [id, label] of [['review', `ทบทวน${due ? ` (${due})` : ''}`], ['vocab', `คลังคำ (${state.vocab.length})`], ['mistakes', `สมุดผิด (${state.mistakes.length})`]]) {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id) }, label);
    b.addEventListener('click', () => { tab = id; renderReview(root); });
    tabs.append(b);
  }
  root.append(tabs);
  const body = h('div', {});
  root.append(body);
  if (tab === 'review') renderSession(body, root);
  else if (tab === 'vocab') renderVocab(body, root);
  else renderMistakes(body, root);
}

// ---------- session ----------
function startSession(cards) {
  session = { queue: cards.slice(0, 30), done: 0, again: 0 };
  revealed = false;
}

function renderSession(body, root) {
  if (!session || !session.queue.length) {
    const due = dueCards();
    if (session && session.done) {
      body.append(h('div', { class: 'card empty-state' }, el('div', 'big', '🎉'), el('h3', '', `ทบทวนครบแล้ว ${num(session.done)} ข้อ`),
        el('p', 'small', session.again ? `ลืม ${session.again} ครั้ง — ข้อเหล่านั้นจะกลับมาเร็วขึ้น` : 'เยี่ยมมาก จำได้ทุกข้อ')));
      session = null;
      if (!due.length) return;
    }
    if (!due.length) {
      body.append(h('div', { class: 'card empty-state' }, el('div', 'big', '✨'), el('h3', '', 'ยังไม่มีข้อที่ต้องทบทวนตอนนี้'),
        el('p', 'small', 'คุยกับเพื่อน AI ต่อ คำที่พลาดและคำใหม่จะถูกเพิ่มมาให้ทบทวนเอง'),
        h('a', { class: 'btn primary', href: '#chat', style: 'margin-top:12px' }, 'ไปคุยต่อ')));
      return;
    }
    const nm = due.filter((d) => d.kind === 'mistake').length;
    body.append(h('div', { class: 'card pad-lg', style: 'text-align:center' },
      el('div', 'streak', num(due.length)), el('div', 'small muted', `ข้อที่ถึงเวลาทบทวน · ประโยค ${nm} · คำศัพท์ ${due.length - nm}`),
      h('button', { type: 'button', class: 'btn primary', style: 'margin-top:16px', onclick: () => { startSession(due); renderReview(root); } }, 'เริ่มทบทวน')));
    return;
  }

  const { kind, item } = session.queue[0];
  const card = h('div', { class: 'card pad-lg' });
  card.append(h('div', { class: 'row xs muted' }, el('span', 'grow', `ข้อ ${session.done + 1} · เหลือ ${session.queue.length}`), statusChip(item.srs)));
  const flash = h('div', { class: 'flash' });
  let typed = null;
  if (kind === 'mistake') {
    flash.append(el('div', 'small muted', 'ประโยคนี้ผิด — แก้ให้ถูกต้อง'), el('div', 'prompt', item.wrong));
    if (!revealed) {
      typed = h('input', { class: 'input', type: 'text', placeholder: 'พิมพ์คำตอบ (ไม่บังคับ)', autocomplete: 'off' });
      typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') reveal(); });
      flash.append(typed);
    }
  } else {
    flash.append(el('div', 'small muted', 'คำนี้แปลว่าอะไร?'), h('div', { class: 'row', style: 'justify-content:center' }, el('div', 'prompt', item.word),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ฟังเสียง', onclick: () => speak(item.word) }, icon('speaker'))));
  }
  const reveal = () => { session.typed = typed ? typed.value : ''; revealed = true; renderReview(root); };
  if (revealed) {
    if (kind === 'mistake') {
      const ok = session.typed && norm(session.typed) === norm(item.right);
      if (session.typed) flash.append(el('div', 'small ' + (ok ? '' : 'muted'), ok ? '✅ ถูกต้อง!' : `คุณตอบ: ${session.typed}`));
      flash.append(h('div', { class: 'row', style: 'justify-content:center' }, el('div', 'answer', item.right),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ฟังเสียง', onclick: () => speak(item.natural || item.right) }, icon('speaker'))));
      if (item.why) flash.append(el('div', 'small', '💡 ' + item.why));
      if (item.example) flash.append(el('div', 'small muted', '📝 ' + item.example));
    } else {
      flash.append(el('div', 'answer', item.meaning || '(ไม่มีคำแปล)'));
      if (item.example) flash.append(el('div', 'small muted', '📝 ' + item.example));
    }
  }
  card.append(flash);
  if (!revealed) {
    card.append(h('button', { type: 'button', class: 'btn primary block', onclick: reveal }, 'ดูเฉลย'));
  } else {
    const labels = preview(item.srs);
    const grades = h('div', { class: 'grades' });
    ['ลืม', 'ยาก', 'จำได้', 'ง่าย'].forEach((name, g) => {
      grades.append(h('button', { type: 'button', class: 'btn' + (g === 2 ? ' primary' : ''), onclick: () => grade(g, root) }, name, el('small', '', labels[g])));
    });
    card.append(grades);
  }
  body.append(card);
  if (!revealed && typed) setTimeout(() => typed.focus(), 50);
}

function grade(g, root) {
  const cur = session.queue.shift();
  cur.item.srs = schedule(cur.item.srs, g);
  session.done += 1;
  if (g === 0) { session.again += 1; session.queue.push(cur); }   // once more this session
  recordReview(g);
  revealed = false;
  if (!session.queue.length) logActivity('review', `ทบทวน ${session.done} ข้อ`);
  persist();
  emit('badges');   // not 'state': that would re-render this page and drop the summary
  renderReview(root);
}

// ---------- vocabulary ----------
function renderVocab(body, root) {
  const word = h('input', { class: 'input', type: 'text', placeholder: 'คำ / วลี ภาษาอังกฤษ', maxlength: '80', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
  const meaning = h('input', { class: 'input', type: 'text', placeholder: 'ความหมาย (เว้นว่างได้ AI แปลให้)', maxlength: '200' });
  const add = h('button', { type: 'button', class: 'btn primary' }, 'เพิ่ม');
  const note = el('div', 'xs muted', 'เว้นช่องความหมายไว้ได้ AI จะแปลไทยและให้ประโยคตัวอย่าง (ใช้ AI 1 ครั้ง)');
  let busy = false;
  const exists = (w) => state.vocab.some((v) => v.word.toLowerCase() === w.trim().toLowerCase());
  async function submit() {
    if (busy) return;
    const w = word.value.trim();
    if (!w) { word.focus(); return; }
    if (exists(w)) { toast('มีคำนี้ในคลังแล้ว'); return; }
    let entry = { word: w, meaning: meaning.value.trim(), example: '' };
    if (!entry.meaning) {
      if (!isEnglishWord(w)) { toast('พิมพ์คำภาษาอังกฤษ หรือใส่ความหมายเอง'); word.focus(); return; }
      busy = true; add.disabled = true; add.textContent = 'กำลังแปล…';
      try {
        const d = parseDefine(await askIelts(buildDefinePrompt(cefrOf()), defineInput(w)), w);
        if (!d) throw new Error('bad');
        entry = { word: d.word, meaning: d.meaning, example: d.example };
      } catch {
        toast('แปลไม่สำเร็จ ลองอีกครั้ง หรือพิมพ์ความหมายเอง');
        busy = false; add.disabled = false; add.textContent = 'เพิ่ม';
        return;
      }
    }
    const v = addWord(entry);
    if (!v) { toast('มีคำนี้ในคลังแล้ว'); busy = false; add.disabled = false; add.textContent = 'เพิ่ม'; return; }
    recordWord();
    logActivity('word', `เพิ่มคำ: ${v.word}`);
    toast(`เพิ่ม ${v.word} แล้ว${v.meaning ? ' — ' + v.meaning : ''}`);
    persist(); emit('state'); renderReview(root);
  }
  add.addEventListener('click', submit);
  word.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
  body.append(h('div', { class: 'card' }, el('h3', '', 'เพิ่มคำเอง'), h('div', { class: 'grid md-2', style: 'margin-top:8px' }, word, meaning), note, h('div', { style: 'margin-top:8px' }, add)));

  const bare = state.vocab.filter(needsMeaning);
  if (bare.length || filling) body.append(fillCard(bare, root));

  const search = h('input', { class: 'input', type: 'search', placeholder: 'ค้นหาคำศัพท์', value: vQuery });
  search.addEventListener('input', () => { vQuery = search.value; draw(); });
  body.append(h('div', { class: 'search', style: 'margin-top:16px' }, icon('search'), search));
  const list = h('div', { class: 'list', style: 'margin-top:12px' });
  body.append(list);
  function draw() {
    list.textContent = '';
    const q = norm(vQuery);
    const items = state.vocab.filter((v) => !q || norm(v.word + ' ' + v.meaning).includes(q)).slice().reverse();
    if (!items.length) { list.append(emptyState('📘', state.vocab.length ? 'ไม่พบคำที่ค้นหา' : 'ยังไม่มีคำ — เพื่อน AI จะเก็บคำใหม่ให้ระหว่างคุย หรือเพิ่มเองด้านบน', null, { card: false })); return; }
    for (const v of items) {
      const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `ลบ ${v.word}` }, icon('trash'));
      del.addEventListener('click', () => {
        if (!confirm(`ลบ "${v.word}" ออกจากคลังคำ?`)) return;
        state.vocab = state.vocab.filter((x) => x.id !== v.id);
        persist(); emit('state'); renderReview(root);
      });
      list.append(h('div', { class: 'item' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `ฟัง ${v.word}`, onclick: () => speak(v.word) }, icon('speaker')),
        h('div', { class: 'grow' }, el('div', '', v.word), el('div', 'xs muted', [v.meaning, v.example].filter(Boolean).join(' · '))),
        h('div', { style: 'text-align:right' }, statusChip(v.srs), el('div', 'xs muted', nextLabel(v.srs))), del));
    }
  }
  draw();
}

// Words that came in without a meaning (typed before, or from chat): the AI fills them in, 20 per request.
let filling = null;        // { done, total, failed } while it runs
function fillCard(bare, root) {
  const card = h('div', { class: 'card', style: 'margin-top:12px' });
  if (filling) {
    card.append(el('div', 'small', `กำลังแปล… ${filling.done}/${filling.total} คำ`));
    return card;
  }
  const go = h('button', { type: 'button', class: 'btn' }, `✨ แปลทั้งหมด (${bare.length})`);
  go.addEventListener('click', () => fillAll(root));
  card.append(el('div', 'small', `มี ${bare.length} คำที่ยังไม่มีความหมาย`),
    h('div', { class: 'row wrap-ok', style: 'margin-top:8px' }, go, el('span', 'xs muted', `ใช้ AI ${Math.ceil(bare.length / MANY_BATCH)} ครั้ง`)));
  return card;
}
async function fillAll(root) {
  if (filling) return;
  const todo = state.vocab.filter(needsMeaning).map((v) => v.word);
  filling = { done: 0, total: todo.length, failed: 0 };
  const redraw = () => { if (tab === 'vocab' && location.hash.startsWith('#review')) renderReview(root); };
  redraw();
  let filled = 0;
  for (let i = 0; i < todo.length; i += MANY_BATCH) {
    const part = todo.slice(i, i + MANY_BATCH);
    try {
      const got = parseDefineMany(await askIelts(buildDefineManyPrompt(cefrOf()), defineManyInput(part)), part);
      for (const v of state.vocab) {
        const d = got.get(v.word.toLowerCase());
        if (!d || !needsMeaning(v)) continue;
        v.meaning = d.meaning;
        if (!v.example) v.example = d.example;
        filled += 1;
      }
      persist();
    } catch { filling.failed += 1; break; }   // out of quota or offline: stop, keep what is done
    filling.done = Math.min(todo.length, i + part.length);
    redraw();
  }
  const failed = filling.failed;
  filling = null;
  const left = state.vocab.filter(needsMeaning).length;
  toast(failed ? `แปลได้ ${filled} คำ แล้วหยุด (AI ไม่ตอบ) ลองกดอีกครั้งภายหลัง` : left ? `แปลได้ ${filled} คำ เหลือ ${left} คำที่ AI แปลไม่ได้` : `แปลครบ ${filled} คำแล้ว`, !!failed);
  emit('state'); redraw();
}

// ---------- Mistake Book ----------
function renderMistakes(body, root) {
  body.append(h('div', { class: 'row wrap-ok' },
    h('button', { type: 'button', class: 'btn', onclick: () => quiz() }, '🧩 ให้เพื่อน AI ทดสอบข้อที่พลาด'),
    state.mistakes.some((m) => isDue(m.srs)) ? h('button', { type: 'button', class: 'btn', onclick: () => { startSession(dueCards().filter((d) => d.kind === 'mistake')); tab = 'review'; renderReview(root); } }, 'ทบทวนข้อที่ถึงเวลา') : null));

  const search = h('input', { class: 'input', type: 'search', placeholder: 'ค้นหาประโยคหรือคำอธิบาย', value: mFilter.q });
  search.addEventListener('input', () => { mFilter.q = search.value; draw(); });
  body.append(h('div', { class: 'search', style: 'margin-top:16px' }, icon('search'), search));

  const cats = [...new Set(state.mistakes.map((m) => m.category))];
  const chipRow = (items, key) => {
    const row = h('div', { class: 'chips', style: 'margin-top:10px' });
    for (const [val, label] of items) {
      const c = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(mFilter[key] === val) }, label);
      c.addEventListener('click', () => { mFilter[key] = mFilter[key] === val ? '' : val; renderReview(root); });
      row.append(c);
    }
    return row;
  };
  if (cats.length > 1) body.append(chipRow(cats.map((c) => [c, `${CATEGORIES[c] || c} (${state.mistakes.filter((m) => m.category === c).length})`]), 'cat'));
  body.append(chipRow([['due', 'ถึงเวลาทบทวน'], ['new', 'ใหม่'], ['learning', 'กำลังจำ'], ['mastered', 'จำได้แล้ว']], 'st'));

  const list = h('div', { class: 'list', style: 'margin-top:12px' });
  body.append(list);
  function draw() {
    list.textContent = '';
    const q = norm(mFilter.q);
    const items = state.mistakes.filter((m) =>
      (!q || norm(`${m.wrong} ${m.right} ${m.why} ${m.natural}`).includes(q)) &&
      (!mFilter.cat || m.category === mFilter.cat) &&
      (!mFilter.st || (mFilter.st === 'due' ? isDue(m.srs) : status(m.srs) === mFilter.st))).slice().reverse();
    if (!items.length) { list.append(emptyState('📕', state.mistakes.length ? 'ไม่พบข้อที่ตรงกับตัวกรอง' : 'ยังไม่มี — คุยไปเรื่อยๆ แล้วข้อที่พลาดจะมาอยู่ที่นี่', null, { card: false })); return; }
    for (const m of items) list.append(mistakeCard(m, root));
  }
  draw();
}

function mistakeCard(m, root) {
  const detail = h('div', { class: 'detail' });
  detail.hidden = true;
  const line = (label, text) => (text ? h('div', { style: 'margin-top:6px' }, el('span', 'xs muted', label + ' '), text) : null);
  detail.append(
    line('💡 ทำไม:', m.why), line('🗣️ แบบเจ้าของภาษา:', m.natural), line('📝 ตัวอย่าง:', m.example),
    el('div', 'xs muted', `บันทึกเมื่อ ${fmtDate(m.t)} · ${nextLabel(m.srs)} · ทบทวนแล้ว ${m.srs.reps} ครั้ง`),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { type: 'button', class: 'btn sm', onclick: (e) => { e.stopPropagation(); startSession([{ kind: 'mistake', item: m }]); tab = 'review'; renderReview(root); } }, 'ทบทวนข้อนี้'),
      h('button', { type: 'button', class: 'btn sm ghost', onclick: (e) => { e.stopPropagation(); speak(m.natural || m.right); } }, icon('speaker'), 'ฟัง'),
      h('button', { type: 'button', class: 'btn sm danger ghost', onclick: (e) => {
        e.stopPropagation();
        if (!confirm('ลบข้อนี้ออกจากสมุด?')) return;
        state.mistakes = state.mistakes.filter((x) => x.id !== m.id);
        persist(); emit('state'); renderReview(root);
      } }, 'ลบ')));
  const card = h('div', { class: 'card mistake', tabindex: '0', role: 'button', 'aria-expanded': 'false' },
    h('div', { class: 'row' }, el('span', 'chip', CATEGORIES[m.category] || 'อื่นๆ'), el('span', 'grow'), statusChip(m.srs)),
    h('div', { style: 'margin-top:8px' }, el('div', 'w small', m.wrong), el('div', 'r', m.right)),
    detail);
  const toggle = () => { detail.hidden = !detail.hidden; card.setAttribute('aria-expanded', String(!detail.hidden)); };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  return card;
}
