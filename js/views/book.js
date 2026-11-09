// 📖 Book page: the learner picks their own PDF once; its text is read on this device with pdf.js
// (vendor/pdfjs, loaded only when a PDF is picked) and kept in IndexedDB (js/bookdb.js). Read a
// page at a time, tap a word for its Thai meaning in that sentence (AI, one short request, saved
// so the same word never asks again), add it to the word bank, mark the page read (counts for XP)
// and, if wanted, answer 3 AI questions about the page. Progress syncs; the book's text does not.
import { el, h, icon, toast, num } from '../util.js';
import { settings, state, persist, emit, addWord, logActivity, cefrOf } from '../store.js';
import { today, recordWord } from '../stats.js';
import { askIelts } from '../ai.js';
import { speak, unlockSpeech, stopSpeaking } from '../speech.js';
import { putBook, getBook, deleteBook, keepStorage } from '../bookdb.js';
import {
  GOAL_CHOICES, MIN_PAGE_CHARS, pageParagraphs, pageChars, bookId, titleFromFile, wordAt, sentenceAround,
  cleanLibrary, addBook, percentRead, daysLeft, nextUnread, buildLookupPrompt, lookupInput, parseLookup,
  buildQuizPrompt, pageForQuiz, parseQuiz,
} from '../engine/book.js';

let busy = '';          // '' | 'import' | 'open' | 'quiz'
let progress = '';      // import progress text
let text = null;        // { id, title, pages } of the open book, from IndexedDB
let reading = false;    // reader on screen (false = the shelf)
let look = null;        // { word, sentence, busy, res, err }
let quiz = null;        // { page, qs, answers, checked }
let missing = '';       // id of a book whose text is not on this device

// Cleaned once per render; handlers change this same object, so no change is lost to a fresh copy.
const lib = () => state.library;
const save = () => { persist(); emit('state'); };
const pagesToday = () => today().pages || 0;

export function renderBook(root) {
  root.textContent = '';
  state.library = cleanLibrary(state.library);
  const l = state.library;
  if (reading && text && l.books[text.id]) { root.append(reader(l, root)); return; }
  reading = false;
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', '📖 อ่านหนังสือ'),
    el('p', 'small muted', 'อ่านหนังสือ PDF ของคุณวันละไม่กี่หน้า แตะคำที่ไม่รู้เพื่อดูความหมาย แล้วเก็บเข้าคลังคำ'))));
  root.append(shelf(l, root));
  root.append(importCard(root));
  root.append(el('p', 'xs muted', 'ไฟล์หนังสืออยู่ในเครื่องนี้เท่านั้น ไม่ถูกอัปโหลดหรือซิงก์ · AI ได้เห็นแค่ประโยคของคำที่แตะ หรือหน้าที่กดขอคำถาม · ความหมายจาก AI อาจผิดได้'));
}

// ---------- shelf ----------
function shelf(l, root) {
  const card = h('div', { class: 'card pad-lg' }, el('h2', 'sec', '📚 ชั้นหนังสือ'));
  const ids = Object.keys(l.books);
  if (!ids.length) { card.append(el('p', 'small muted', 'ยังไม่มีหนังสือ เลือกไฟล์ PDF ด้านล่างได้เลย')); return card; }
  const goal = h('select', { class: 'input', 'aria-label': 'เป้าหมายจำนวนหน้าต่อวัน' }, ...GOAL_CHOICES.map((n) => Object.assign(el('option', '', `${n} หน้า/วัน`), { value: String(n) })));
  goal.value = String(l.goal);
  goal.addEventListener('change', () => { state.library.goal = Number(goal.value); save(); });
  card.append(h('div', { class: 'row wrap-ok' }, el('span', 'small', `วันนี้อ่านแล้ว ${pagesToday()}/${l.goal} หน้า`), h('label', { class: 'small row' }, 'เป้าหมาย', goal)));
  for (const id of ids) {
    const b = l.books[id];
    const pct = percentRead(b);
    const open = h('button', { type: 'button', class: 'btn primary' }, busy === 'open' ? 'กำลังเปิด…' : b.read.length ? `อ่านต่อ หน้า ${b.page + 1}` : 'เริ่มอ่าน');
    open.disabled = !!busy;
    open.addEventListener('click', () => openBook(id, root));
    const del = h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': `ลบ ${b.title} ออกจากชั้น` }, icon('trash'));
    del.addEventListener('click', () => removeBook(id, root));
    const item = h('div', { class: 'book-item' },
      h('div', { class: 'row' }, h('b', { class: 'grow', lang: 'en' }, b.title), del),
      h('div', { class: 'bar', role: 'progressbar', 'aria-label': `อ่านแล้ว ${pct}%`, 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct}%` })),
      el('div', 'xs muted', `อ่านแล้ว ${num(b.read.length)}/${num(b.pages)} หน้า (${pct}%)${b.read.length < b.pages ? ` · อีกราว ${num(daysLeft(b, l.goal))} วันที่ ${l.goal} หน้า/วัน` : ' · อ่านจบแล้ว 🎉'} · ค้นคำไป ${num(b.words.length)} คำ`),
      missing === id ? el('p', 'small warn-text', 'ในเครื่องนี้ยังไม่มีไฟล์ของเล่มนี้ เลือกไฟล์ PDF เล่มเดิมอีกครั้งด้านล่าง ความคืบหน้าจะต่อจากเดิม') : null,
      h('div', { class: 'row wrap-ok' }, open));
    card.append(item);
  }
  return card;
}

function importCard(root) {
  const card = h('div', { class: 'card pad-lg' }, el('h2', 'sec', '➕ เพิ่มหนังสือ (PDF)'));
  const file = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true });
  file.addEventListener('change', () => { const f = file.files[0]; file.value = ''; if (f) importPdf(f, root); });
  const pick = h('button', { type: 'button', class: 'btn' }, busy === 'import' ? 'กำลังอ่านไฟล์…' : '📄 เลือกไฟล์ PDF');
  pick.disabled = !!busy;
  pick.addEventListener('click', () => file.click());
  card.append(el('p', 'small muted', 'ใช้ได้กับ PDF ที่ลากคลุมเลือกข้อความได้ (ไม่ใช่ภาพสแกน) อ่านครั้งเดียวตอนเพิ่ม ไม่ใช้ AI'), h('div', { class: 'row wrap-ok' }, pick), file);
  if (busy === 'import') card.append(h('p', { class: 'small', id: 'bookProgress', role: 'status' }, progress));
  return card;
}

async function importPdf(f, root) {
  if (busy) return;
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast('รองรับเฉพาะไฟล์ PDF', true); return; }
  if (f.size > 80 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 80 MB', true); return; }
  busy = 'import'; progress = 'กำลังเปิดไฟล์…'; renderBook(root);
  let doc = null;
  try {
    const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false, disableFontFace: true }).promise;
    if (doc.numPages > 2000) throw new Error('หนังสือยาวเกิน 2,000 หน้า');
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      pages.push(pageParagraphs((await page.getTextContent()).items));
      page.cleanup();
      if (i % 4 === 0 || i === doc.numPages) { progress = `กำลังอ่านหน้า ${i}/${doc.numPages}…`; const p = root.querySelector('#bookProgress'); if (p) p.textContent = progress; }
    }
    const withText = pages.filter((p) => pageChars(p) >= MIN_PAGE_CHARS).length;
    if (withText < Math.max(1, pages.length * 0.2)) throw new Error('PDF นี้แทบไม่มีข้อความ น่าจะเป็นภาพสแกน ตอนนี้ยังอ่านไม่ได้');
    const info = await doc.getMetadata().catch(() => null);
    const metaTitle = String(info?.info?.Title || '').trim();
    const id = bookId(pages);
    const title = state.library?.books?.[id]?.title || (metaTitle.length >= 3 && !/^untitled|\.(?:docx?|indd)$/i.test(metaTitle) ? metaTitle.slice(0, 80) : titleFromFile(f.name));
    await putBook({ id, title, pages, added: Date.now() });
    keepStorage();
    const had = !!state.library?.books?.[id];
    state.library = addBook(state.library, id, title, pages.length);
    if (!had) logActivity('book', `เพิ่มหนังสือ ${title} (${pages.length} หน้า)`);
    missing = '';
    save();
    text = { id, title, pages };
    reading = true;
    toast(had ? 'เปิดเล่มเดิม ความคืบหน้าต่อจากเดิม' : `เพิ่มแล้ว ${pages.length} หน้า (มีข้อความ ${withText} หน้า)`);
  } catch (e) {
    const name = e?.name || '';
    toast(name === 'PasswordException' ? 'PDF นี้มีรหัสผ่าน เปิดไม่ได้' : name === 'InvalidPDFException' ? 'ไฟล์นี้ไม่ใช่ PDF ที่เปิดได้' : (e?.message || 'อ่านไฟล์ไม่สำเร็จ'), true);
  } finally {
    try { await doc?.destroy(); } catch {}
    busy = ''; progress = '';
    renderBook(root);
  }
}

async function openBook(id, root) {
  if (busy) return;
  if (text?.id === id) { state.library.current = id; reading = true; renderBook(root); return; }
  busy = 'open'; renderBook(root);
  const rec = await getBook(id);
  busy = '';
  if (!rec?.pages?.length) { missing = id; toast('ในเครื่องนี้ยังไม่มีไฟล์ของเล่มนี้', true); renderBook(root); return; }
  text = { id, title: rec.title, pages: rec.pages };
  state.library.current = id;
  reading = true; look = null; quiz = null;
  renderBook(root);
}

async function removeBook(id, root) {
  const b = lib().books[id];
  if (!b || !confirm(`ลบ "${b.title}" ออกจากชั้น? ความคืบหน้าและคำที่ค้นในเล่มนี้จะหายไปด้วย (ไฟล์ PDF ต้นฉบับในเครื่องไม่ถูกลบ)`)) return;
  try { await deleteBook(id); } catch {}
  delete state.library.books[id];
  if (text?.id === id) text = null;
  state.library = cleanLibrary(state.library);
  save();
  renderBook(root);
}

// ---------- reader ----------
function reader(l, root) {
  const b = l.books[text.id];
  const p = b.page;
  const paras = text.pages[p] || [];
  const wrap = h('div', { class: 'book-reader' });
  const back = h('button', { type: 'button', class: 'btn ghost sm' }, icon('back'), 'ชั้นหนังสือ');
  back.addEventListener('click', () => { reading = false; look = null; quiz = null; stopSpeaking(); renderBook(root); });
  const isRead = b.read.includes(p);
  wrap.append(h('div', { class: 'row wrap-ok book-top' }, back, h('b', { class: 'grow small', lang: 'en' }, b.title),
    el('span', 'chip', `วันนี้ ${pagesToday()}/${l.goal} หน้า`)));

  // Page navigation
  const go = (n) => { b.page = Math.max(0, Math.min(b.pages - 1, n)); b.t = Date.now(); look = null; quiz = null; stopSpeaking(); save(); };
  const prev = h('button', { type: 'button', class: 'btn sm', 'aria-label': 'หน้าก่อนหน้า' }, '◀');
  prev.disabled = p === 0;
  prev.addEventListener('click', () => go(p - 1));
  const next = h('button', { type: 'button', class: 'btn sm', 'aria-label': 'หน้าถัดไป' }, '▶');
  next.disabled = p >= b.pages - 1;
  next.addEventListener('click', () => go(p + 1));
  const jump = h('input', { type: 'number', class: 'input book-jump', min: '1', max: String(b.pages), value: String(p + 1), inputmode: 'numeric', 'aria-label': `ไปหน้าที่ (1–${b.pages})` });
  jump.addEventListener('change', () => { const n = Math.floor(Number(jump.value)); if (n >= 1 && n <= b.pages) go(n - 1); else jump.value = String(p + 1); });
  wrap.append(h('div', { class: 'row book-nav' }, prev, h('label', { class: 'small row' }, 'หน้า', jump, `/ ${b.pages}`), next,
    isRead ? el('span', 'chip good', '✓ อ่านแล้ว') : null));

  // The page
  const page = h('div', { class: 'card pad-lg book-page', lang: 'en' });
  if (pageChars(paras) < MIN_PAGE_CHARS) {
    page.append(el('p', 'small muted', 'หน้านี้แทบไม่มีข้อความ (อาจเป็นรูป ปก หรือหน้าว่าง) ข้ามไปหน้าถัดไปได้เลย'));
    if (paras.length) page.append(el('p', 'book-p', paras.join(' ')));
  } else {
    page.append(el('p', 'xs muted book-hint', 'แตะคำไหนก็ได้เพื่อดูความหมาย'));
    for (const t of paras) {
      const para = el('p', 'book-p', t);
      para.addEventListener('click', (e) => tapWord(e, para, t, root));
      const say = h('button', { type: 'button', class: 'icon-btn sm book-say', 'aria-label': 'ฟังย่อหน้านี้' }, icon('speaker'));
      say.addEventListener('click', () => { unlockSpeech(); speak(t, { plain: true }); });
      page.append(h('div', { class: 'book-para' }, para, say));
    }
  }
  wrap.append(page);

  // Look up by typing (keyboard users, or a word that is hard to tap)
  const typed = h('input', { type: 'text', class: 'input', lang: 'en', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'หรือพิมพ์คำที่อยากรู้', 'aria-label': 'พิมพ์คำภาษาอังกฤษที่อยากรู้ความหมาย' });
  const find = h('button', { type: 'button', class: 'btn sm' }, icon('search'), 'ดูความหมาย');
  const doFind = () => {
    const w = typed.value.trim();
    if (!/^[A-Za-z][A-Za-z' -]{1,39}$/.test(w)) { toast('พิมพ์คำภาษาอังกฤษ 1 คำ', true); return; }
    const all = paras.join(' ');
    const at = all.toLowerCase().search(new RegExp(`\\b${w.toLowerCase().replace(/[^a-z' -]/g, '')}`));
    lookUp(w, at >= 0 ? sentenceAround(all, at) : '', root);
  };
  find.addEventListener('click', doFind);
  typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') doFind(); });
  wrap.append(h('div', { class: 'row book-type' }, typed, find));

  if (look) wrap.append(lookPanel(b, root));

  // Finish the page
  const done = h('button', { type: 'button', class: 'btn primary' }, isRead ? (p < b.pages - 1 ? 'ไปหน้าถัดไป ▶' : 'กลับชั้นหนังสือ') : '✅ อ่านหน้านี้จบ');
  done.addEventListener('click', () => finishPage(b, p, root));
  const ask = h('button', { type: 'button', class: 'btn' }, busy === 'quiz' ? 'กำลังสร้างคำถาม…' : '❓ คำถามท้ายหน้า');
  ask.disabled = !!busy || pageChars(paras) < 300;
  ask.addEventListener('click', () => makeQuiz(p, paras, root));
  wrap.append(h('div', { class: 'row wrap-ok book-actions' }, done, ask, el('span', 'xs muted', pageChars(paras) < 300 ? 'หน้านี้สั้นเกินไปสำหรับคำถาม' : 'คำถาม 3 ข้อ ใช้ AI 1 ครั้ง')));
  if (quiz && quiz.page === p) wrap.append(quizCard(root));

  if (b.words.length) wrap.append(wordsCard(b));
  return wrap;
}

function finishPage(b, p, root) {
  if (!b.read.includes(p)) {
    b.read.push(p);
    const d = today();
    d.pages = (d.pages || 0) + 1;
    if (d.pages === state.library.goal) toast(`🎉 ครบเป้าวันนี้ ${d.pages} หน้า`);
    if (b.read.length === b.pages) { logActivity('book', `อ่านจบ ${b.title} 🎉`); toast('🎉 อ่านจบทั้งเล่มแล้ว!'); }
    else logActivity('book', `อ่าน ${b.title} หน้า ${p + 1}`);
  }
  // Next page; after the last page, the first page still unread (or back to the shelf when done).
  const n = p < b.pages - 1 ? p + 1 : nextUnread(b, 0);
  b.t = Date.now();
  look = null; quiz = null;
  stopSpeaking();
  if (n < 0) { reading = false; save(); return; }
  b.page = n;
  save();
  root.closest('.scroll')?.scrollTo?.(0, 0);
}

// The word under the finger: the browser tells where in the text the tap landed.
function tapWord(e, para, t, root) {
  if (window.getSelection && String(window.getSelection()).trim()) return;   // the learner is selecting text
  let node = null, offset = -1;
  if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(e.clientX, e.clientY); node = c?.offsetNode; offset = c?.offset ?? -1; }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); node = r?.startContainer; offset = r?.startOffset ?? -1; }
  if (!node || node.parentNode !== para || offset < 0) return;
  const w = wordAt(t, offset);
  if (w) lookUp(w.word, w.sentence, root);
}

async function lookUp(word, sentence, root) {
  const b = lib().books[text.id];
  const key = word.toLowerCase();
  // Already looked up in this book, or already in the word bank: no AI needed.
  const known = b.words.find((w) => w.word.toLowerCase() === key || (key.length > 3 && key.startsWith(w.word.toLowerCase()) && key.length - w.word.length <= 3));
  if (known) { look = { word, sentence, res: { word, base: known.word, pos: known.pos, th: known.th }, from: 'book' }; renderBook(root); scrollToLook(root); return; }
  const bank = state.vocab.find((v) => v.word.toLowerCase() === key);
  if (bank) { look = { word, sentence, res: { word, base: bank.word, pos: '', th: bank.meaning }, from: 'bank' }; renderBook(root); scrollToLook(root); return; }
  if (!settings.workerUrl || !navigator.onLine) { look = { word, sentence, err: !navigator.onLine ? 'ไม่มีอินเทอร์เน็ต ดูความหมายด้วย AI ไม่ได้ตอนนี้' : 'ยังไม่ได้ใส่ลิงก์ Worker ในการตั้งค่า' }; renderBook(root); scrollToLook(root); return; }
  look = { word, sentence, busy: true };
  renderBook(root); scrollToLook(root);
  try {
    const res = parseLookup(await askIelts(buildLookupPrompt(cefrOf()), lookupInput(word, sentence || word)), word);
    if (!res) throw new Error('AI ตอบกลับมาไม่ครบ ลองแตะใหม่');
    if (look?.word !== word) return;
    look = { word, sentence, res };
    const bk = lib().books[text.id];
    bk.words.push({ word: res.base, th: res.th, pos: res.pos, page: bk.page });
    state.library = cleanLibrary(state.library);
    persist();
  } catch (e) {
    if (look?.word === word) look = { word, sentence, err: e.message };
  }
  renderBook(root);
}
const scrollToLook = (root) => root.querySelector('.book-look')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });

function lookPanel(b, root) {
  const box = h('div', { class: 'card book-look', role: 'region', 'aria-live': 'polite', 'aria-label': `ความหมายของ ${look.word}` });
  const close = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'ปิด' }, icon('x'));
  close.addEventListener('click', () => { look = null; renderBook(root); });
  const say = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': `ฟังคำว่า ${look.word}` }, icon('speaker'));
  say.addEventListener('click', () => { unlockSpeech(); speak(look.res?.base || look.word, { plain: true }); });
  const r = look.res;
  box.append(h('div', { class: 'row' }, h('b', { class: 'grow book-look-word', lang: 'en' }, r && r.base.toLowerCase() !== look.word.toLowerCase() ? `${look.word} → ${r.base}` : look.word), say, close));
  if (look.busy) box.append(el('p', 'small muted', 'กำลังดูความหมาย…'));
  else if (look.err) box.append(el('p', 'small warn-text', look.err));
  else if (r) {
    box.append(h('p', { class: 'small' }, r.pos ? el('span', 'xs muted', `(${r.pos}) `) : null, el('b', '', r.th)));
    if (look.sentence) box.append(h('p', { class: 'xs muted book-look-sent', lang: 'en' }, `“${look.sentence}”`));
    const inBank = state.vocab.some((v) => v.word.toLowerCase() === r.base.toLowerCase());
    const add = h('button', { type: 'button', class: 'btn sm primary' }, inBank ? '✓ อยู่ในคลังคำแล้ว' : '+ คลังคำ (ทบทวน)');
    add.disabled = inBank;
    add.addEventListener('click', () => {
      if (addWord({ word: r.base, meaning: [r.th, r.pos && `(${r.pos})`].filter(Boolean).join(' '), example: look.sentence || '' })) {
        recordWord();
        logActivity('word', `จากหนังสือ: ${r.base}`);
        save();
        toast(`เพิ่ม ${r.base} เข้าคลังคำแล้ว ระบบจะเรียกมาทวน`);
      }
    });
    box.append(h('div', { class: 'row wrap-ok' }, add, look.from === 'bank' ? el('span', 'xs muted', 'ความหมายจากคลังคำของคุณ') : look.from === 'book' ? el('span', 'xs muted', 'เคยค้นในเล่มนี้แล้ว (ไม่ใช้ AI)') : el('span', 'xs muted', 'AI 1 ครั้ง')));
  }
  return box;
}

function wordsCard(b) {
  const list = h('div', { class: 'chips' }, ...b.words.slice().reverse().slice(0, 150).map((w) => h('span', { class: 'chip' }, h('b', { lang: 'en' }, w.word), ` ${w.th}`)));
  return h('details', { class: 'card book-words' }, h('summary', { class: 'small' }, `คำที่ค้นในเล่มนี้ ${b.words.length} คำ`), list);
}

// ---------- questions about the page ----------
async function makeQuiz(p, paras, root) {
  if (busy) return;
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต', true); return; }
  busy = 'quiz'; renderBook(root);
  try {
    const qs = parseQuiz(await askIelts(buildQuizPrompt(cefrOf()), pageForQuiz(paras)));
    if (qs.length < 2) throw new Error('AI ตอบกลับมาไม่ครบ ลองใหม่อีกครั้ง');
    quiz = { page: p, qs, answers: {}, checked: false };
  } catch (e) { toast(e.message, true); }
  busy = '';
  renderBook(root);
}

function quizCard(root) {
  const card = h('div', { class: 'card pad-lg' }, el('h2', 'sec', '❓ คำถามท้ายหน้า'));
  quiz.qs.forEach((q, i) => {
    const pick = quiz.answers[i];
    const ok = quiz.checked ? pick === q.answer : null;
    const box = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : '') }, el('div', 'small', `${i + 1}. ${q.q}`));
    box.setAttribute('lang', 'en');
    q.options.forEach((o, j) => {
      const r = h('input', { type: 'radio', name: `bq${i}`, value: String(j) });
      r.checked = pick === j;
      r.disabled = quiz.checked;
      r.addEventListener('change', () => { quiz.answers[i] = j; });
      box.append(h('label', { class: 'small opt' }, r, ' ', `${'ABCD'[j]}  ${o}`));
    });
    if (quiz.checked) { const why = el('div', 'xs tep-why', `${ok ? '✓' : `✗ คำตอบ: ${'ABCD'[q.answer]}`}${q.why ? ` — ${q.why}` : ''}`); why.setAttribute('lang', 'th'); box.append(why); }
    card.append(box);
  });
  if (quiz.checked) card.append(el('div', 'small', `ได้ ${quiz.qs.filter((q, i) => quiz.answers[i] === q.answer).length}/${quiz.qs.length}`));
  const b = h('button', { type: 'button', class: 'btn primary' }, quiz.checked ? 'ปิดคำถาม' : 'ตรวจคำตอบ');
  b.addEventListener('click', () => { if (quiz.checked) quiz = null; else quiz.checked = true; renderBook(root); });
  card.append(b, el('p', 'xs muted', 'คำถามและเฉลยสร้างโดย AI จากหน้านี้ อาจผิดได้'));
  return card;
}
