// 📖 Book page: the learner picks their own PDF once; its text is read on this device with pdf.js
// (vendor/pdfjs, loaded only when a PDF is picked) and kept in IndexedDB (js/bookdb.js). Read a
// page at a time, tap a word for its Thai meaning in that sentence (AI, one short request, saved
// so the same word never asks again), add it to the word bank, mark the page read (counts for XP)
// and, if wanted, answer 3 AI questions about the page. Progress syncs; the book's text does not.
// The PDF file is kept on the device too, so a page can be shown as its picture straight away (📄
// page view, js/views/booksheet.js: zoom, swipe, pen, highlighter, box a word). The 📝 text view
// shows the page's text; for scanned books the AI turns a page into text (one request) only when
// that view or the page questions need it.
import { el, h, icon, toast, num, canvasPhoto } from '../util.js';
import { settings, state, persist, emit, addWord, logActivity, cefrOf } from '../store.js';
import { today, recordWord } from '../stats.js';
import { askIelts, askTranscribe } from '../ai.js';
import { speak, unlockSpeech, stopSpeaking } from '../speech.js';
import { putBook, getBook, deleteBook, putFile, fileExists, keepStorage } from '../bookdb.js';
import { sheetView, pdfFor, closePdf, drawPage, loadPdfjs, PDF_OPTS } from './booksheet.js';
import { inkDeleteBook } from '../inksync.js';
import {
  GOAL_CHOICES, MIN_PAGE_CHARS, pageParagraphs, pageChars, bookId, titleFromFile, wordAt, sentenceAround,
  cleanLibrary, addBook, percentRead, daysLeft, nextUnread, buildLookupPrompt, lookupInput, parseLookup,
  buildQuizPrompt, pageForQuiz, parseQuiz, buildWordQuiz, WORD_QUIZ_MIN, isScanned, markForScan, pendingPages, bytesId, OCR_PROMPT, parseOcr, REGION_PROMPT, parseRegion,
} from '../engine/book.js';

let busy = '';          // '' | 'import' | 'open' | 'quiz'
let progress = '';      // import progress text
let text = null;        // { id, title, pages } of the open book, from IndexedDB
let reading = false;    // reader on screen (false = the shelf)
let look = null;        // { word, sentence, busy, res, err }
let quiz = null;        // { page, qs, answers, checked }
let wquiz = null;       // { qs, answers, checked } quiz from the words looked up in this book
let missing = '';       // id of a book whose text is not on this device
let ocr = null;         // { at: page index being read by the AI, left } while scanned pages are converted

// Cleaned once per render; handlers change this same object, so no change is lost to a fresh copy.
const lib = () => state.library;
const save = () => { persist(); emit('state'); };
const pagesToday = () => today().pages || 0;

// 📄 page picture or 📝 text, remembered per book on this device (a convenience only).
const VIEW_KEY = 'lb_bookview';
function viewOf() {
  if (!text?.hasFile) return 'text';
  try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '{}')[text.id] === 'text' ? 'text' : 'page'; } catch { return 'page'; }
}
function setView(v) {
  try { const m = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'); m[text.id] = v; localStorage.setItem(VIEW_KEY, JSON.stringify(m)); } catch {}
}

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
      h('div', { class: 'row' }, h('b', { class: 'grow', lang: 'en' }, b.title), b.scan ? el('span', 'chip', '📷 สแกน') : null, del),
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
  card.append(el('p', 'small muted', 'PDF ที่มีตัวอักษร: อ่านทั้งเล่มตอนเพิ่ม ไม่ใช้ AI · PDF ที่เป็นภาพสแกน: AI แปลงเป็นข้อความทีละหน้าตอนที่คุณเปิดอ่าน (1 ครั้งต่อหน้า) แล้วเก็บไว้ในเครื่อง'), h('div', { class: 'row wrap-ok' }, pick), file);
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
    const bytes = new Uint8Array(await f.arrayBuffer());
    // pdf.js takes over the buffer it is given, so it gets a copy; a scanned book keeps the original.
    doc = await (await loadPdfjs()).getDocument({ data: bytes.slice(), ...PDF_OPTS }).promise;
    if (doc.numPages > 2000) throw new Error('หนังสือยาวเกิน 2,000 หน้า');
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      pages.push(pageParagraphs((await page.getTextContent()).items));
      page.cleanup();
      if (i % 4 === 0 || i === doc.numPages) { progress = `กำลังอ่านหน้า ${i}/${doc.numPages}…`; const p = root.querySelector('#bookProgress'); if (p) p.textContent = progress; }
    }
    const withText = pages.filter((p) => pageChars(p) >= MIN_PAGE_CHARS).length;
    const scan = isScanned(pages);
    const info = await doc.getMetadata().catch(() => null);
    const metaTitle = String(info?.info?.Title || '').trim();
    const id = scan ? bytesId(bytes, pages.length) : bookId(pages);
    const title = state.library?.books?.[id]?.title || (metaTitle.length >= 3 && !/^untitled|\.(?:docx?|indd)$/i.test(metaTitle) ? metaTitle.slice(0, 80) : titleFromFile(f.name));
    // Pages the AI already turned into text on this device are kept when the same file is picked again.
    const old = scan ? await getBook(id) : null;
    const stored = scan ? markForScan(pages).map((pg, i) => (pg === null && Array.isArray(old?.pages?.[i]) ? old.pages[i] : pg)) : pages;
    const added = old?.added || Date.now();
    try {
      await putBook({ id, title, pages: stored, scan, added });
      await putFile(id, bytes.buffer);   // every book: the 📄 page view draws from the file
    } catch (e) {
      try { await deleteBook(id); } catch {}
      throw new Error(/quota/i.test(`${e?.name} ${e?.message}`) ? 'พื้นที่ในเครื่องไม่พอเก็บไฟล์นี้' : 'บันทึกหนังสือในเครื่องไม่สำเร็จ');
    }
    keepStorage();
    const had = !!state.library?.books?.[id];
    state.library = addBook(state.library, id, title, pages.length, Date.now(), scan);
    if (!had) logActivity('book', `เพิ่มหนังสือ ${title} (${pages.length} หน้า)`);
    missing = '';
    save();
    closePdf();
    text = { id, title, pages: stored, scan, added, hasFile: true };
    reading = true; look = null; quiz = null;
    toast(had ? 'เปิดเล่มเดิม ความคืบหน้าต่อจากเดิม' : scan ? `เพิ่มแล้ว ${pages.length} หน้า · เปิดอ่านแบบหน้าจริงได้ทันที` : `เพิ่มแล้ว ${pages.length} หน้า (มีข้อความ ${withText} หน้า)`);
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
  closePdf();
  text = { id, title: rec.title, pages: rec.pages, scan: !!rec.scan, added: rec.added, hasFile: await fileExists(id) };
  state.library.current = id;
  reading = true; look = null; quiz = null;
  renderBook(root);
  readCurrent(root);
}

async function removeBook(id, root) {
  const b = lib().books[id];
  if (!b || !confirm(`ลบ "${b.title}" ออกจากชั้น? ความคืบหน้าและคำที่ค้นในเล่มนี้จะหายไปด้วย (ไฟล์ PDF ต้นฉบับในเครื่องไม่ถูกลบ)`)) return;
  await inkDeleteBook(id);
  try { await deleteBook(id); } catch {}
  delete state.library.books[id];
  if (text?.id === id) { text = null; closePdf(); }
  state.library = cleanLibrary(state.library);
  save();
  renderBook(root);
}

// ---------- reader ----------
function reader(l, root) {
  const b = l.books[text.id];
  const p = b.page;
  const waiting = text.pages[p] === null;   // a scanned page not turned into text yet
  const paras = text.pages[p] || [];
  const wrap = h('div', { class: 'book-reader' });
  const back = h('button', { type: 'button', class: 'btn ghost sm' }, icon('back'), 'ชั้นหนังสือ');
  back.addEventListener('click', () => { reading = false; look = null; quiz = null; wquiz = null; stopSpeaking(); renderBook(root); });
  const isRead = b.read.includes(p);
  wrap.append(h('div', { class: 'row wrap-ok book-top' }, back, h('b', { class: 'grow small', lang: 'en' }, b.title),
    el('span', 'chip', `วันนี้ ${pagesToday()}/${l.goal} หน้า`)));

  // Page navigation
  const go = (n) => { if (n < 0 || n >= b.pages) return; b.page = n; b.t = Date.now(); look = null; quiz = null; stopSpeaking(); save(); };
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

  // 📄 page picture or 📝 text
  const mode = viewOf();
  if (text.hasFile) {
    const seg = h('div', { class: 'seg book-mode', role: 'radiogroup', 'aria-label': 'แบบการอ่าน' });
    for (const [k, label] of [['page', '📄 หน้าจริง'], ['text', '📝 ข้อความ']]) {
      const btn = h('button', { type: 'button', role: 'radio', 'aria-checked': String(mode === k), class: mode === k ? 'on' : '' }, label);
      btn.addEventListener('click', () => { setView(k); look = null; renderBook(root); if (k === 'text') readCurrent(root); });
      seg.append(btn);
    }
    wrap.append(seg);
  } else wrap.append(el('p', 'xs muted', 'อยากอ่านแบบหน้าจริง (เขียน/ไฮไลต์ได้)? เลือกไฟล์ PDF เล่มนี้อีกครั้งที่ชั้นหนังสือ'));

  if (mode === 'page') {
    wrap.append(sheetView({ id: text.id, page: p, total: b.pages, onPage: go, onRegion: (c) => lookUpRegion(c, root), rerender: () => renderBook(root) }));
  }

  // The page as text
  const page = h('div', { class: 'card pad-lg book-page', lang: 'en' });
  if (mode === 'page') { /* the picture above is the page */ } else if (waiting) {
    const doing = ocr?.at === p;
    page.append(el('p', 'small', doing ? 'กำลังให้ AI อ่านหน้านี้… (ราว 3–6 วินาที)' : 'หน้านี้เป็นภาพสแกน ยังไม่ได้แปลงเป็นข้อความ'));
    if (!doing) {
      const conv = h('button', { type: 'button', class: 'btn primary' }, '🪄 แปลงหน้านี้เป็นข้อความ');
      conv.disabled = !!ocr;
      conv.addEventListener('click', () => convertPages([p], root));
      page.append(h('div', { class: 'row wrap-ok' }, conv, el('span', 'xs muted', 'ใช้ AI 1 ครั้ง แปลงแล้วเก็บไว้ ไม่ต้องแปลงซ้ำ')));
    }
  } else if (pageChars(paras) < MIN_PAGE_CHARS) {
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
  if (mode === 'text') wrap.append(page);
  if (mode === 'text' && text.scan) wrap.append(scanTools(b, p, root));

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
  const ask = h('button', { type: 'button', class: 'btn' }, busy === 'quiz' ? 'กำลังสร้างคำถาม…' : ocr?.at === p ? 'กำลังอ่านหน้านี้…' : '❓ คำถามท้ายหน้า');
  const short = !waiting && pageChars(paras) < 300;
  ask.disabled = !!busy || !!ocr || short;
  ask.addEventListener('click', () => makeQuiz(p, root));
  wrap.append(h('div', { class: 'row wrap-ok book-actions' }, done, ask, el('span', 'xs muted', short ? 'หน้านี้สั้นเกินไปสำหรับคำถาม' : waiting ? 'AI อ่านหน้านี้ก่อน แล้วถาม 3 ข้อ (AI 2 ครั้ง)' : 'คำถาม 3 ข้อ ใช้ AI 1 ครั้ง')));
  if (quiz && quiz.page === p) wrap.append(quizCard(root));

  if (b.words.length) wrap.append(wordsCard(b));
  if (b.words.length >= WORD_QUIZ_MIN || wquiz) wrap.append(wordQuizCard(b, root));
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
  readCurrent(root);
}

// ---------- scanned pages ----------
// The page the learner is about to read: convert it if it is a scanned page (online only, quietly).
function readCurrent(root) {
  const b = text && lib().books[text.id];
  if (!b || viewOf() !== 'text' || !text.scan || text.pages[b.page] !== null || ocr || !settings.workerUrl || !navigator.onLine) return;
  convertPages([b.page], root);
}

async function convertPages(list, root) {
  if (ocr || !text) return;
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต — ต่อเน็ตแล้วค่อยแปลงหน้า', true); return; }
  const id = text.id;
  ocr = { at: list[0], left: list.length };
  renderBook(root);
  let done = 0;
  try {
    const doc = await pdfFor(id);
    for (const i of list) {
      if (text?.id !== id) break;
      if (text.pages[i] !== null) continue;
      ocr = { at: i, left: list.length - done };
      renderBook(root);
      const paras = parseOcr(await askTranscribe(OCR_PROMPT, canvasPhoto(await drawPage(doc, i, 2000))));
      if (!paras) throw new Error(`AI อ่านหน้า ${i + 1} ไม่สำเร็จ ลองกดแปลงอีกครั้ง`);
      if (text?.id !== id) break;
      text.pages[i] = paras;
      await putBook({ id, title: text.title, pages: text.pages, scan: true, added: text.added || Date.now() });
      done += 1;
    }
    if (list.length > 1 && done) toast(`แปลงแล้ว ${done} หน้า อ่านได้แม้ไม่มีเน็ต`);
  } catch (e) { toast(e?.message || 'แปลงหน้าไม่สำเร็จ', true); }
  ocr = null;
  renderBook(root);
}

// Scanned books in the text view: get the next pages ready as text while online.
function scanTools(b, p, root) {
  const box = h('div', { class: 'row wrap-ok book-scan' });
  const ahead = pendingPages(text.pages, p + 1, 5);
  if (ahead.length) {
    const prep = h('button', { type: 'button', class: 'btn sm' }, ocr && ocr.at !== p ? `กำลังแปลงหน้า ${ocr.at + 1}… (เหลือ ${ocr.left})` : `⬇️ เตรียม ${ahead.length} หน้าถัดไป`);
    prep.disabled = !!ocr;
    prep.addEventListener('click', () => convertPages(ahead, root));
    box.append(prep, el('span', 'xs muted', `ใช้ AI ${ahead.length} ครั้ง แล้วอ่านตอนไม่มีเน็ตได้`));
  }
  const wrap = h('div', { class: 'book-scan-wrap' }, box);
  return wrap;
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
// A boxed piece of the page picture → its words and meaning (one small AI request with a picture).
async function lookUpRegion(canvas, root) {
  if (!settings.workerUrl || !navigator.onLine) { look = { word: 'วงคำ', sentence: '', err: !navigator.onLine ? 'ไม่มีอินเทอร์เน็ต ดูความหมายด้วย AI ไม่ได้ตอนนี้' : 'ยังไม่ได้ใส่ลิงก์ Worker ในการตั้งค่า' }; renderBook(root); scrollToLook(root); return; }
  const img = canvas.toDataURL('image/jpeg', 0.85);
  const ticket = Symbol('look');
  look = { word: '…', sentence: '', busy: true, img, ticket };
  renderBook(root); scrollToLook(root);
  try {
    const r = parseRegion(await askTranscribe(REGION_PROMPT, canvasPhoto(canvas, 600000)));
    if (look?.ticket !== ticket) return;
    if (!r) throw new Error('อ่านคำในกรอบไม่ได้ ลองวงให้ครอบคำทั้งคำและชัดขึ้น');
    look = { word: r.base, sentence: r.text, textTh: r.textTh, img, res: { word: r.base, base: r.base, pos: r.pos, th: r.th } };
    const bk = lib().books[text.id];
    bk.words.push({ word: r.base, th: r.th, pos: r.pos, page: bk.page });
    state.library = cleanLibrary(state.library);
    persist();
  } catch (e) {
    if (look?.ticket === ticket) look = { word: 'วงคำ', sentence: '', img, err: e.message };
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
  if (look.img) box.append(h('img', { class: 'book-look-img', src: look.img, alt: 'ส่วนที่วงไว้' }));
  if (look.busy) box.append(el('p', 'small muted', 'กำลังดูความหมาย…'));
  else if (look.err) box.append(el('p', 'small warn-text', look.err));
  else if (r) {
    box.append(h('p', { class: 'small' }, r.pos ? el('span', 'xs muted', `(${r.pos}) `) : null, el('b', '', r.th)));
    if (look.sentence) box.append(h('p', { class: 'xs muted book-look-sent', lang: 'en' }, `“${look.sentence}”`));
    if (look.textTh) box.append(el('p', 'xs', `แปล: ${look.textTh}`));
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

// ---------- quiz from the words looked up in this book (made on the device, no AI) ----------
function wordQuizCard(b, root) {
  const card = h('div', { class: 'card pad-lg' }, el('h2', 'sec', '🧠 ทดสอบคำที่ค้นในเล่มนี้'));
  const fresh = () => ({ qs: buildWordQuiz(b.words, 5), answers: {}, checked: false });
  if (!wquiz) {
    const start = h('button', { type: 'button', class: 'btn primary' }, 'เริ่ม 5 ข้อ');
    start.addEventListener('click', () => { wquiz = fresh(); renderBook(root); });
    card.append(el('p', 'small muted', 'เลือกความหมายที่ถูกของคำที่คุณเคยค้นในเล่มนี้ (ไม่ใช้ AI)'), start);
    return card;
  }
  if (!wquiz.qs.length) { card.append(el('p', 'small muted', 'ต้องมีคำที่ค้นไว้อย่างน้อย 4 คำที่ความหมายต่างกัน')); wquiz = null; return card; }
  wquiz.qs.forEach((q, i) => {
    const pick = wquiz.answers[i];
    const ok = wquiz.checked ? pick === q.answer : null;
    const say = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `ฟังคำว่า ${q.q}` }, icon('speaker'));
    say.addEventListener('click', () => { unlockSpeech(); speak(q.q, { plain: true }); });
    const box = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : '') }, h('div', { class: 'row' }, h('b', { class: 'grow', lang: 'en' }, `${i + 1}. ${q.q}`), say));
    q.options.forEach((o, j) => {
      const r = h('input', { type: 'radio', name: `wq${i}`, value: String(j) });
      r.checked = pick === j;
      r.disabled = wquiz.checked;
      r.addEventListener('change', () => { wquiz.answers[i] = j; });
      box.append(h('label', { class: 'small opt' }, r, ' ', `${'ABCD'[j]}  ${o}`));
    });
    if (wquiz.checked) box.append(el('div', 'xs tep-why', `${ok ? '✓' : `✗ คำตอบ: ${'ABCD'[q.answer]}  ${q.th}`}${Number.isInteger(q.page) ? ` · หน้า ${q.page + 1}` : ''}`));
    card.append(box);
  });
  if (wquiz.checked) card.append(el('div', 'small', `ได้ ${wquiz.qs.filter((q, i) => wquiz.answers[i] === q.answer).length}/${wquiz.qs.length}`));
  const again = h('button', { type: 'button', class: 'btn primary' }, wquiz.checked ? 'ทำชุดใหม่' : 'ตรวจคำตอบ');
  again.addEventListener('click', () => { if (wquiz.checked) wquiz = fresh(); else wquiz.checked = true; renderBook(root); });
  const close = h('button', { type: 'button', class: 'btn ghost' }, 'ปิด');
  close.addEventListener('click', () => { wquiz = null; renderBook(root); });
  card.append(h('div', { class: 'row wrap-ok' }, again, close));
  return card;
}

// ---------- questions about the page ----------
async function makeQuiz(p, root) {
  if (busy || ocr) return;
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต', true); return; }
  if (text.pages[p] === null) await convertPages([p], root);   // a scanned page: read it as text first
  const paras = text.pages[p];
  if (!paras) return;
  if (pageChars(paras) < 300) { toast('หน้านี้สั้นเกินไปสำหรับคำถาม', true); return; }
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
