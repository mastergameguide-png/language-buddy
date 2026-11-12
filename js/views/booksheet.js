// 📖 Book page as a picture (like a note app): the PDF page is drawn on this device straight away,
// no AI and no waiting. Zoom, swipe to turn pages, write and highlight with a finger or Apple Pencil
// (saved per page on this device), and box a word to get its meaning (only the boxed piece goes
// to the AI). Also holds the pdf.js helpers the book page uses.
import { el, h, icon, toast } from '../util.js';
import { getFile, getInk, putInk } from '../bookdb.js';
import { INK, INK_WIDTH, cleanStrokes, simplifyPoints, strokeNear, cropBox, mergeInk } from '../engine/book.js';
import { on } from '../store.js';
import { uid } from '../util.js';
import { inkDeleted } from '../inksync.js';

// ---------- pdf.js ----------
let pdf = null;                 // { id, doc } the open book's PDF
const shown = new Map();        // 'id:page:width' → canvas drawn for the screen (a few kept)
const sharp = new Map();        // 'id:page' → canvas drawn large, for cutting out boxed words
const ratio = new Map();        // 'id:page' → height / width
// 'id:page' → strokes. The page's marks live here first and are written to IndexedDB shortly after,
// so a redraw (new tool, zoom) right after a stroke never reads an older saved copy.
const inkMem = new Map();
const dpr = () => Math.min(2, globalThis.devicePixelRatio || 1);
// Marks that arrived from another device (sync): update the copy in memory and the page on screen.
let live = null;               // { key, set(strokes) } the page being shown
on('ink', ({ pageKey, changes }) => {
  if (!inkMem.has(pageKey)) return;
  const merged = mergeInk(inkMem.get(pageKey), changes);
  inkMem.set(pageKey, merged);
  if (live?.key === pageKey) live.set(merged);
});

// No eval and no web fonts (the page's security rules forbid both): letters are drawn as shapes.
// A PDF that does not carry its own fonts needs the 14 standard ones, kept in vendor/pdfjs.
export const PDF_OPTS = { isEvalSupported: false, disableFontFace: true, standardFontDataUrl: new URL('../../vendor/pdfjs/standard_fonts/', import.meta.url).href };
export async function loadPdfjs() {
  const pdfjs = await import('../../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
}
export function closePdf() { try { pdf?.doc.destroy(); } catch {} pdf = null; shown.clear(); sharp.clear(); ratio.clear(); inkMem.clear(); }
export async function pdfFor(id) {
  if (pdf?.id === id) return pdf.doc;
  const data = await getFile(id);
  if (!data) throw new Error('ไม่พบไฟล์ PDF ของเล่มนี้ในเครื่อง เลือกไฟล์เดิมอีกครั้ง');
  closePdf();
  const doc = await (await loadPdfjs()).getDocument({ data: new Uint8Array(data), ...PDF_OPTS }).promise;
  pdf = { id, doc };
  return doc;
}
// One page on a white canvas, `width` pixels wide (or at most maxSide on its long side).
export async function drawPage(doc, i, maxSide, width) {
  const page = await doc.getPage(i + 1);
  const one = page.getViewport({ scale: 1 });
  const scale = width ? width / one.width : Math.min(4, maxSide / Math.max(one.width, one.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  // intent 'print' draws straight away; the screen intent waits for animation frames, which stop
  // when the app is in the background, so drawing would hang until the learner came back.
  await page.render({ canvasContext: g, viewport, intent: 'print' }).promise;
  page.cleanup();
  return canvas;
}
const keep = (map, key, val, max) => { map.delete(key); map.set(key, val); while (map.size > max) map.delete(map.keys().next().value); return val; };
async function pageRatio(id, i) {
  const k = `${id}:${i}`;
  if (!ratio.has(k)) { const vp = (await (await pdfFor(id)).getPage(i + 1)).getViewport({ scale: 1 }); ratio.set(k, vp.height / vp.width); }
  return ratio.get(k);
}
async function screenCanvas(id, i, cssW) {
  const w = Math.min(2600, Math.round(cssW * dpr()));
  const k = `${id}:${i}:${w}`;
  if (shown.has(k)) return keep(shown, k, shown.get(k), 4);
  return keep(shown, k, await drawPage(await pdfFor(id), i, 0, w), 4);
}
async function sharpCanvas(id, i) {
  const k = `${id}:${i}`;
  if (sharp.has(k)) return sharp.get(k);
  return keep(sharp, k, await drawPage(await pdfFor(id), i, 2400), 2);
}

// ---------- the page view ----------
// Kept between pages and redraws: the tool in hand, colours and zoom.
const ui = { tool: 'view', pen: INK.pen[0][0], hl: INK.hl[0][0], zoom: 1 };
const TOOLS = [['view', '👆', 'เลื่อน/ปัด'], ['pen', '✏️', 'ปากกา'], ['hl', '🖍️', 'ไฮไลต์'], ['erase', '🧽', 'ยางลบ'], ['look', '🔍', 'วงคำ']];
const ZOOMS = [1, 1.5, 2, 3];

// ctx: { id, page, total, onPage(n), onRegion(canvas), rerender() }
export function sheetView(ctx) {
  const { id, page } = ctx;
  const key = `${id}:${page}`;
  const wrap = h('div', { class: 'book-sheet-wrap' });

  // Tool bar
  const bar = h('div', { class: 'book-tools', role: 'toolbar', 'aria-label': 'เครื่องมือบนหน้า' });
  const tools = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'เครื่องมือ' });
  for (const [k, ic, label] of TOOLS) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(ui.tool === k), class: ui.tool === k ? 'on' : '', 'aria-label': label, title: label }, ic, h('span', { class: 'book-tool-label' }, label));
    b.addEventListener('click', () => { ui.tool = k; ctx.rerender(); });
    tools.append(b);
  }
  bar.append(tools);
  if (ui.tool === 'pen' || ui.tool === 'hl') {
    const sw = h('div', { class: 'book-swatches', role: 'radiogroup', 'aria-label': 'สี' });
    for (const [c, name] of INK[ui.tool]) {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(ui[ui.tool] === c), class: 'book-swatch' + (ui[ui.tool] === c ? ' on' : ''), 'aria-label': name, style: `--sw:${c}` });
      b.addEventListener('click', () => { ui[ui.tool] = c; ctx.rerender(); });
      sw.append(b);
    }
    bar.append(sw);
  }
  const undo = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'ย้อนเส้นล่าสุด', title: 'ย้อนเส้นล่าสุด' }, '↶');
  const clear = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'ลบที่เขียนทั้งหน้า', title: 'ลบที่เขียนทั้งหน้า' }, icon('trash'));
  const zi = ZOOMS.indexOf(ui.zoom);
  const zout = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'ย่อ' }, '−');
  const zin = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'ขยาย' }, '+');
  zout.disabled = zi <= 0; zin.disabled = zi >= ZOOMS.length - 1;
  zout.addEventListener('click', () => { ui.zoom = ZOOMS[Math.max(0, zi - 1)]; ctx.rerender(); });
  zin.addEventListener('click', () => { ui.zoom = ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)]; ctx.rerender(); });
  bar.append(h('div', { class: 'row book-tools-end' }, undo, clear, h('span', { class: 'grow' }), zout, el('span', 'xs book-zoom', `${Math.round(ui.zoom * 100)}%`), zin));
  wrap.append(bar);

  const hint = {
    view: ui.zoom === 1 ? 'ปัดซ้าย/ขวาเพื่อเปลี่ยนหน้า · กด + เพื่อขยาย' : 'ลากเพื่อเลื่อนดู · กด − เพื่อย่อ',
    pen: 'เขียนบนหน้าได้เลย (นิ้วหรือ Apple Pencil) · บันทึกในเครื่องอัตโนมัติ',
    hl: 'ลากทับข้อความเพื่อไฮไลต์',
    erase: 'แตะหรือลากผ่านเส้นที่จะลบ',
    look: 'ลากกรอบครอบคำหรือประโยคที่ไม่รู้ แล้ว AI จะบอกความหมาย',
  }[ui.tool];

  // The page: picture + ink layer + the box being dragged
  const scroller = h('div', { class: 'book-scroll' + (ui.zoom > 1 ? ' zoomed' : '') });
  const sheet = h('div', { class: 'book-sheet', style: `width:${ui.zoom * 100}%; aspect-ratio: 1 / ${ratio.get(key) || 1.414}` });
  const status = el('div', 'book-sheet-status small muted', 'กำลังเปิดหน้า…');
  const ink = h('canvas', { class: 'book-ink', role: 'img', 'aria-label': `หน้า ${page + 1} จาก ${ctx.total}` });
  const box = h('div', { class: 'book-box', hidden: true });
  sheet.append(status, ink, box);
  scroller.append(sheet);
  wrap.append(scroller, el('p', 'xs muted book-sheet-hint', hint));
  ink.style.touchAction = ui.tool === 'view' ? (ui.zoom > 1 ? 'pan-x pan-y' : 'pan-y') : 'none';

  let strokes = inkMem.get(key) || [];
  let known = new Set(strokes.map((s) => s.id));   // ids last saved, to tell which strokes the learner removed
  let cur = null, drag = null, start = null, saveTimer = null;
  const size = () => ({ W: ink.width, H: ink.height });
  const draw = () => {
    const g = ink.getContext('2d');
    const { W, H } = size();
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of cur ? [...strokes, cur] : strokes) {
      g.globalAlpha = s.tool === 'hl' ? 0.35 : 1;
      g.strokeStyle = s.c; g.fillStyle = s.c; g.lineWidth = s.w * W;
      if (s.p.length === 1) { g.beginPath(); g.arc(s.p[0][0] * W, s.p[0][1] * H, (s.w * W) / 2, 0, Math.PI * 2); g.fill(); continue; }
      g.beginPath();
      s.p.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  const store = () => {
    const now = new Set(strokes.map((s) => s.id));
    inkDeleted(key, [...known].filter((x) => !now.has(x)));   // removed here → removed on the other devices too
    known = now;
    inkMem.set(key, strokes);
    clearTimeout(saveTimer);
    const list = strokes.slice();
    saveTimer = setTimeout(() => putInk(key, list).catch(() => toast('บันทึกที่เขียนไม่สำเร็จ', true)), 300);
  };
  const at = (e) => { const r = sheet.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const aspect = () => sheet.clientHeight / Math.max(1, sheet.clientWidth);
  const erase = (pt) => { const before = strokes.length; strokes = strokes.filter((s) => !strokeNear(s, pt[0], pt[1], 0.012, aspect())); if (strokes.length !== before) { draw(); store(); } };
  undo.addEventListener('click', () => { if (strokes.pop()) { draw(); store(); } });
  clear.addEventListener('click', () => { if (strokes.length && confirm('ลบที่เขียนและไฮไลต์ทั้งหน้านี้?')) { strokes = []; draw(); store(); } });

  ink.addEventListener('pointerdown', (e) => {
    const pt = at(e);
    if (ui.tool === 'view') { start = { x: e.clientX, y: e.clientY, t: Date.now() }; return; }
    e.preventDefault();
    try { ink.setPointerCapture(e.pointerId); } catch {}
    if (ui.tool === 'pen' || ui.tool === 'hl') { cur = { id: uid().replace(/-/g, '').slice(0, 16), t: Date.now(), tool: ui.tool, c: ui[ui.tool], w: INK_WIDTH[ui.tool], p: [pt] }; draw(); }
    else if (ui.tool === 'erase') { cur = null; drag = 'erase'; erase(pt); }
    else if (ui.tool === 'look') { drag = { a: pt, b: pt }; showBox(); }
  });
  ink.addEventListener('pointermove', (e) => {
    if (cur) { const evs = e.getCoalescedEvents?.(); for (const ev of evs?.length ? evs : [e]) cur.p.push(at(ev)); draw(); }
    else if (drag === 'erase') erase(at(e));
    else if (drag?.a) { drag.b = at(e); showBox(); }
  });
  const end = (e, cancelled) => {
    if (ui.tool === 'view' && start) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!cancelled && ui.zoom === 1 && Math.abs(dx) > 60 && Math.abs(dy) < 50 && Date.now() - start.t < 800) ctx.onPage(page + (dx < 0 ? 1 : -1));
      start = null; return;
    }
    if (cur) { if (!cancelled) { cur.p = simplifyPoints(cur.p); strokes.push(cur); store(); } cur = null; draw(); }
    if (drag?.a) {
      const c = cancelled ? null : cropBox(drag.a, drag.b);
      drag = null;
      if (!c) { box.hidden = true; if (!cancelled) toast('ลากกรอบให้ครอบคำทั้งคำ', true); return; }
      cutOut(c);
    }
    drag = null;
  };
  ink.addEventListener('pointerup', (e) => end(e, false));
  ink.addEventListener('pointercancel', (e) => end(e, true));
  function showBox() {
    const x0 = Math.min(drag.a[0], drag.b[0]), y0 = Math.min(drag.a[1], drag.b[1]);
    Object.assign(box.style, { left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${Math.abs(drag.b[0] - drag.a[0]) * 100}%`, height: `${Math.abs(drag.b[1] - drag.a[1]) * 100}%` });
    box.hidden = false;
  }
  async function cutOut(c) {
    try {
      const src = await sharpCanvas(id, page);
      const out = document.createElement('canvas');
      const sx = Math.round(c.x * src.width), sy = Math.round(c.y * src.height);
      out.width = Math.max(1, Math.round(c.w * src.width)); out.height = Math.max(1, Math.round(c.h * src.height));
      const g = out.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
      g.drawImage(src, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
      ctx.onRegion(out);
    } catch (e) { toast(e?.message || 'ตัดภาพไม่สำเร็จ', true); }
    setTimeout(() => { box.hidden = true; }, 600);
  }

  // Draw once the sheet is in the page (its width is known), then get the next page ready.
  setTimeout(async () => {
    try {
      const r = await pageRatio(id, page);
      sheet.style.aspectRatio = `1 / ${r}`;
      const cssW = sheet.clientWidth || 360;
      const pic = await screenCanvas(id, page, cssW);
      pic.className = 'book-img';
      sheet.insertBefore(pic, ink);
      status.remove();
      ink.width = Math.round(sheet.clientWidth * dpr()); ink.height = Math.round(sheet.clientHeight * dpr());
      if (!inkMem.has(key)) { strokes = [...cleanStrokes(await getInk(key)), ...strokes]; inkMem.set(key, strokes); known = new Set(strokes.map((s) => s.id)); }
      live = { key, set: (list) => { strokes = list; known = new Set(list.map((s) => s.id)); if (!cur) draw(); } };
      draw();
      if (page + 1 < ctx.total) { pageRatio(id, page + 1).then(() => screenCanvas(id, page + 1, cssW)).catch(() => {}); }
    } catch (e) { status.textContent = e?.message || 'เปิดหน้านี้ไม่ได้'; status.classList.add('warn-text'); }
  }, 0);
  return wrap;
}
