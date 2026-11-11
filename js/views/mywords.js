// 📥 My words page: add the words you keep forgetting (type, paste, or photograph a highlighted
// list), get a few a day with a Thai meaning, a police-style example, the usual phrase, related
// forms, a look-alike warning and a memory tip, then review them with the word bank and practise
// them as gap-fill questions. One AI request per day's batch; photos are never stored.
import { el, h, icon, toast, dayKey, preparePhoto, loadImageCanvas, canvasPhoto } from '../util.js';
import { settings, state, persist, emit, addWord, logActivity, cefrOf } from '../store.js';
import { recordWord } from '../stats.js';
import { askIelts, askTranscribe } from '../ai.js';
import { speak, unlockSpeech } from '../speech.js';
import {
  COLORS, PER_DAY_CHOICES, PHOTO_MAX, ORDERS, parsePasted, parseImport, addToQueue, releaseOrder, leftToday, nextBatch, buildQuiz,
  EXTRACT_PROMPT, MOSAIC_PROMPT, buildEnrichPrompt, parseExtract, parseMosaic, parseEnrich, cleanMyWords, normWord,
} from '../engine/mywords.js';
import { findHighlights, chunk } from '../engine/highlights.js';

let busy = '';            // '' | 'photo' | 'release'
let color = 'pink';
let quiz = null;          // { qs, answers, checked }
let found = null;         // words read from photos, waiting for the learner to confirm
const my = () => (state.mywords = cleanMyWords(state.mywords));
const save = () => { persist(); emit('state'); };

export function renderMyWords(root) {
  root.textContent = '';
  const m = my();
  const today = dayKey();
  const left = leftToday(m, today);
  const byColor = (c) => m.queue.filter((q) => q.color === c).length;
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', '📥 คำของฉัน'),
    el('p', 'small muted', 'คำที่ท่องแล้วจำไม่ได้ ได้วันละไม่กี่คำ พร้อมประโยคและวิธีจำ แล้วระบบจะเรียกมาทวนก่อนลืม'))));

  root.append(h('div', { class: 'grid cols-4' },
    tile('รอในคิว', String(m.queue.length), `ส้ม ${byColor('orange')} · ชมพู ${byColor('pink')}`),
    tile('ได้แล้ว', String(m.done.length), 'อยู่ในคลังคำ ไปทวนที่ "ทบทวน"'),
    tile('วันนี้', `${m.perDay - left}/${m.perDay}`, left ? `รับได้อีก ${left} คำ` : 'ครบแล้ว พรุ่งนี้รับใหม่'),
    perDayTile(m, root)));
  root.append(orderRow(m, root));

  root.append(todayCard(m, today, left, root));
  root.append(addCard(root));
  if (m.done.length >= 4) root.append(quizCard(m, root));
  if (m.queue.length) root.append(queueCard(m, root));
  root.append(el('p', 'xs muted', 'ความหมาย ประโยค และวิธีจำสร้างโดย AI อาจผิดได้ ถ้าไม่แน่ใจให้เช็คกับพจนานุกรม · รูปที่ถ่ายใช้อ่านคำเท่านั้น ไม่ถูกเก็บไว้'));
}

function tile(label, value, sub) {
  return h('div', { class: 'card stat' }, el('div', 'label', label), el('div', 'value', value), el('div', 'sub', sub));
}
function perDayTile(m, root) {
  const sel = h('select', { class: 'input', 'aria-label': 'จำนวนคำต่อวัน' }, ...PER_DAY_CHOICES.map((n) => Object.assign(el('option', '', `${n} คำ/วัน`), { value: String(n) })));
  sel.value = String(m.perDay);
  sel.addEventListener('change', () => { state.mywords.perDay = Number(sel.value); save(); renderMyWords(root); });
  return h('div', { class: 'card stat' }, el('div', 'label', 'ต่อวัน'), sel, el('div', 'sub', 'แนะนำ 10 คำ'));
}

// How the day's words are picked from the queue.
function orderRow(m, root) {
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'ลำดับการปล่อยคำ' });
  for (const [k, label] of Object.entries(ORDERS)) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(m.order === k), class: m.order === k ? 'on' : '' }, label);
    b.addEventListener('click', () => { state.mywords.order = k; save(); renderMyWords(root); });
    seg.append(b);
  }
  return h('div', { class: 'row wrap-ok mw-order' }, el('span', 'small', 'คำแต่ละวัน:'), seg,
    el('span', 'xs muted', m.order === 'random' ? 'สุ่มจากคิวทั้งหมด ได้ชุดเดิมตลอดวัน' : 'สีส้มก่อน แล้วค่อยสีชมพู'));
}

// ---------- today's words ----------
function todayCard(m, today, left, root) {
  const card = h('div', { class: 'card pad-lg mw-today' }, el('h2', 'sec', '📅 คำของวันนี้'));
  const got = m.done.filter((d) => d.day === today);
  for (const d of got) card.append(wordView(d));
  const batch = nextBatch(m, today);
  if (batch.length) {
    card.append(el('p', 'small', `คำถัดไป ${batch.length} คำ: ${batch.map((b) => b.word).join(', ')}`));
    const go = h('button', { type: 'button', class: 'btn primary' }, busy === 'release' ? 'กำลังเตรียมคำ…' : `✨ รับคำวันนี้ (${batch.length} คำ)`);
    go.disabled = !!busy;
    go.addEventListener('click', () => release(batch, true, root));
    card.append(h('div', { class: 'row wrap-ok' }, go, el('span', 'xs muted', 'ใช้ AI 1 ครั้ง')));
  } else if (!m.queue.length) card.append(el('p', 'small muted', 'ยังไม่มีคำในคิว เพิ่มคำที่ท่องแล้วจำไม่ได้ด้านล่างได้เลย'));
  else if (!got.length) card.append(el('p', 'small muted', 'วันนี้รับครบแล้ว'));
  if (got.length) card.append(h('a', { class: 'btn', href: '#review' }, icon('review'), 'ไปทวนในหน้า "ทบทวน"'));
  return card;
}

function wordView(d) {
  const say = h('button', { type: 'button', class: 'btn sm ghost', 'aria-label': `ฟังคำว่า ${d.word}` }, icon('speaker'));
  say.addEventListener('click', () => { unlockSpeech(); speak(d.word, { plain: true }); });
  const box = h('details', { class: 'daily-word mw-word' });
  box.append(h('summary', {}, h('b', { lang: 'en' }, d.word), d.pos ? el('span', 'xs muted', ` ${d.pos}`) : null, d.color !== 'none' ? el('span', `chip mw-${d.color}`, COLORS[d.color].short) : null, el('span', 'small daily-th', d.th || '—')));
  const body = h('div', { class: 'daily-body' });
  if (d.example) {
    const ex = h('button', { type: 'button', class: 'linkish small', lang: 'en', 'aria-label': `ฟังประโยค: ${d.example}` }, `“${d.example}”`);
    ex.addEventListener('click', () => { unlockSpeech(); speak(d.example, { plain: true }); });
    body.append(ex);
  }
  const line = (label, text, en) => (text ? h('div', { class: 'xs', ...(en ? { lang: 'en' } : {}) }, el('b', '', label), ' ', text) : null);
  body.append(...[line('ใช้คู่กับ:', d.collocation, true), line('ตระกูลคำ:', d.family, true), line('⚠️ อย่าสับสนกับ:', d.confusable), line('💡 วิธีจำ:', d.tip)].filter(Boolean));
  body.append(h('div', { class: 'row' }, say));
  box.append(body);
  return box;
}

async function release(batch, withAi, root) {
  if (busy) return;
  let info = {};
  if (withAi) {
    if (!settings.workerUrl || !navigator.onLine) { offerPlain(batch, root, !navigator.onLine ? 'ไม่มีอินเทอร์เน็ต' : 'ยังไม่ได้ใส่ลิงก์ Worker'); return; }
    busy = 'release'; renderMyWords(root);
    try {
      info = parseEnrich(await askIelts(buildEnrichPrompt(batch, cefrOf()), 'Explain these words.'), batch);
      if (!Object.keys(info).length) throw new Error('AI ตอบกลับมาไม่ครบ');
    } catch (e) { busy = ''; offerPlain(batch, root, e.message); return; }
    busy = '';
  }
  const m = my(), today = dayKey();
  let added = 0;
  for (const b of batch) {
    const x = info[normWord(b.word)] || {};
    const th = x.th || b.th;
    if (addWord({ word: b.word, meaning: [th, x.pos && `(${x.pos})`, x.collocation && `· ${x.collocation}`].filter(Boolean).join(' '), example: x.example || '' })) { added += 1; recordWord(); }
    m.done.push({ word: b.word, th, color: b.color, day: today, pos: x.pos || '', example: x.example || '', collocation: x.collocation || '', family: x.family || '', confusable: x.confusable || '', tip: x.tip || '' });
  }
  const keys = new Set(batch.map((b) => normWord(b.word)));
  m.queue = m.queue.filter((q) => !keys.has(normWord(q.word)));
  state.mywords = cleanMyWords(m);
  if (added) logActivity('word', `คำของฉัน: เพิ่ม ${added} คำ`);
  save();
  toast(`ได้คำวันนี้ ${batch.length} คำ อยู่ในคลังคำแล้ว`);
  renderMyWords(root);
}
function offerPlain(batch, root, why) {
  toast(`${why} — เพิ่มแบบไม่มีประโยคตัวอย่างได้`, true);
  renderMyWords(root);
  const card = root.querySelector('.mw-today');
  const b = h('button', { type: 'button', class: 'btn' }, 'เพิ่มแบบไม่ใช้ AI (ใช้คำแปลที่มี)');
  b.addEventListener('click', () => release(batch, false, root));
  card?.append(b);
}

// ---------- adding words ----------
function addCard(root) {
  const card = h('div', { class: 'card pad-lg mw-add' }, el('h2', 'sec', '➕ เพิ่มคำที่ท่องแล้วจำไม่ได้'));
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'ระดับความยาก' });
  for (const c of ['orange', 'pink']) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(color === c), class: color === c ? 'on' : '' }, c === 'orange' ? '🟧 ยากมาก (ส้ม)' : '🌸 ยาก (ชมพู)');
    b.addEventListener('click', () => { color = c; renderMyWords(root); });
    seg.append(b);
  }
  card.append(el('div', 'xs muted', 'คำสีส้มจะได้ก่อนสีชมพู'), seg);

  const ta = h('textarea', { class: 'input', rows: '5', lang: 'en', 'aria-label': 'คำศัพท์ หนึ่งคำต่อบรรทัด', placeholder: 'หนึ่งคำต่อบรรทัด เช่น\nadhere ยึดถือ\nallegation - ข้อกล่าวหา\naccountable' });
  const add = h('button', { type: 'button', class: 'btn primary' }, 'เพิ่มเข้าคิว');
  add.addEventListener('click', () => {
    const items = parsePasted(ta.value);
    if (!items.length) { toast('ไม่พบคำภาษาอังกฤษ', true); return; }
    queueItems(items.map((i) => ({ ...i, color })), root);
  });
  card.append(ta, add);

  // A word-list file (e.g. one made from the highlighted PDF): no AI needed.
  const listFile = h('input', { type: 'file', accept: '.txt,.csv,.tsv,text/plain,text/csv', hidden: true });
  listFile.addEventListener('change', async () => {
    const f = listFile.files[0]; listFile.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('ไฟล์ใหญ่เกินไป', true); return; }
    const items = parseImport(await f.text());
    if (!items.length) { toast('ไม่พบคำในไฟล์นี้', true); return; }
    queueItems(items, root);
  });
  const imp = h('button', { type: 'button', class: 'btn' }, '📄 นำเข้าไฟล์รายการคำ');
  imp.addEventListener('click', () => listFile.click());
  card.append(el('div', 'xs muted', 'หรือนำเข้าไฟล์ .txt/.csv: หนึ่งคำต่อบรรทัด ใส่สีต่อท้ายได้ เช่น "adhere<แท็บ>pink" (ไม่ใช้ AI)'), h('div', { class: 'row wrap-ok' }, imp), listFile);

  // Photo of a highlighted list: the AI lists only the highlighted words and their colour.
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  file.addEventListener('change', () => { const f = [...file.files]; file.value = ''; readPhotos(f, root); });
  const snap = h('button', { type: 'button', class: 'btn', 'aria-label': `ถ่ายรูปรายการคำที่ไฮไลต์ (สูงสุด ${PHOTO_MAX} หน้า)` }, icon('camera'), busy === 'photo' ? 'กำลังอ่านรูป…' : '📷 ถ่ายรูปรายการที่ไฮไลต์');
  snap.disabled = !!busy;
  snap.addEventListener('click', () => file.click());
  card.append(el('div', 'xs muted', 'หรือถ่ายรูป/ส่งออกหน้ารายการที่ไฮไลต์ไว้ แอปหาไฮไลต์สีส้ม/ชมพูในเครื่อง แล้วให้ AI อ่านเฉพาะคำนั้น (ใช้ AI ราว 2–3 ครั้งต่อหน้า)'), h('div', { class: 'row wrap-ok' }, snap), file);

  if (found) {
    const list = h('div', { class: 'mw-found' }, el('b', 'small', `อ่านได้ ${found.length} คำ ตรวจก่อนเพิ่ม (กดคำที่ไม่ใช่เพื่อเอาออก)`));
    const chips = h('div', { class: 'chips' });
    found.forEach((w, i) => {
      const b = h('button', { type: 'button', class: `chip mw-${w.color}`, 'aria-label': `เอา ${w.word} ออก` }, `${w.word}${w.th ? ` · ${w.th}` : ''} ✕`);
      b.addEventListener('click', () => { found.splice(i, 1); renderMyWords(root); });
      chips.append(b);
    });
    const ok = h('button', { type: 'button', class: 'btn primary' }, `เพิ่ม ${found.length} คำเข้าคิว`);
    ok.addEventListener('click', () => { const f = found; found = null; queueItems(f, root); });
    const no = h('button', { type: 'button', class: 'btn ghost' }, 'ยกเลิก');
    no.addEventListener('click', () => { found = null; renderMyWords(root); });
    list.append(chips, h('div', { class: 'row wrap-ok' }, ok, no));
    card.append(list);
  }
  return card;
}

function queueItems(items, root) {
  const r = addToQueue(state.mywords, items, color, state.vocab.map((v) => v.word));
  state.mywords = r.my;
  save();
  toast(`เพิ่มเข้าคิว ${r.added} คำ${r.skipped ? ` (ข้าม ${r.skipped} คำที่มีแล้ว)` : ''}`);
  renderMyWords(root);
}

async function readPhotos(files, root) {
  const imgs = files.filter((f) => /^image\//.test(f.type));
  if (!imgs.length) { if (files.length) toast('รองรับเฉพาะรูปภาพ (PNG/JPG)', true); return; }
  if (imgs.length > PHOTO_MAX) { toast(`ได้สูงสุด ${PHOTO_MAX} รูปต่อครั้ง`, true); return; }
  if (!settings.workerUrl) { toast('ยังไม่ได้ใส่ลิงก์ Worker', true); return; }
  if (!navigator.onLine) { toast('ไม่มีอินเทอร์เน็ต — ต่อเน็ตแล้วลองใหม่', true); return; }
  busy = 'photo'; renderMyWords(root);
  const all = [];
  try {
    for (const f of imgs) all.push(...(await readOnePhoto(f)));
  } catch (e) { toast(e.message, true); }
  busy = '';
  const seen = new Set();
  found = all.filter((w) => { const k = normWord(w.word); if (seen.has(k)) return false; seen.add(k); return true; });
  if (!found.length) { found = null; toast('ไม่พบคำที่ไฮไลต์ในรูป ลองถ่ายให้ชัดและตรงขึ้น', true); }
  renderMyWords(root);
}

// Highlights are found by colour on the device and cut out, so the AI only reads printed words
// and the colour is always right. If no highlight is found (another pen colour, a dark camera
// photo), the whole page goes to the AI instead.
async function readOnePhoto(f) {
  const canvas = await loadImageCanvas(f, 2000);
  const boxes = findHighlights(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
  if (boxes.orange.length + boxes.pink.length < 3) {
    return parseExtract(await askTranscribe(EXTRACT_PROMPT, await preparePhoto(f, { maxSide: 2000 })));
  }
  const words = [];
  for (const c of ['orange', 'pink']) {
    for (const part of chunk(boxes[c], 40)) {
      words.push(...parseMosaic(await askTranscribe(MOSAIC_PROMPT, canvasPhoto(mosaic(canvas, part))), c));
    }
  }
  return words;
}
// One picture of numbered strips, each a highlighted piece of the page.
function mosaic(src, boxes) {
  const pad = 3, gap = 6, left = 44;
  const w = left + Math.max(...boxes.map((b) => b.w)) + pad * 2;
  const hgt = boxes.reduce((s, b) => s + b.h + pad * 2 + gap, 0);
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, hgt);
  g.fillStyle = '#000'; g.font = '16px sans-serif'; g.textBaseline = 'middle';
  let y = 0;
  boxes.forEach((b, i) => {
    const sx = Math.max(0, b.x - pad), sy = Math.max(0, b.y - pad), sw = b.w + pad * 2, sh = b.h + pad * 2;
    g.drawImage(src, sx, sy, sw, sh, left, y, sw, sh);
    g.fillText(String(i + 1), 6, y + sh / 2);
    y += sh + gap;
  });
  return c;
}

// ---------- practice ----------
function quizCard(m, root) {
  const card = h('div', { class: 'card pad-lg' }, el('h2', 'sec', '🧩 ฝึกเติมคำ (แบบข้อสอบ Vocabulary)'));
  if (!quiz) {
    const start = h('button', { type: 'button', class: 'btn primary' }, 'เริ่ม 5 ข้อ');
    start.addEventListener('click', () => { quiz = { qs: buildQuiz(m.done, 5), answers: {}, checked: false }; renderMyWords(root); });
    card.append(el('p', 'small muted', 'ใช้ประโยคตัวอย่างของคำที่ได้แล้ว เลือกคำที่เข้ากับช่องว่าง'), start);
    return card;
  }
  if (!quiz.qs.length) { card.append(el('p', 'small muted', 'ยังมีคำที่มีประโยคตัวอย่างไม่ถึง 4 คำ')); quiz = null; return card; }
  quiz.qs.forEach((q, i) => {
    const ok = quiz.checked ? Number(quiz.answers[i]) === q.answer && quiz.answers[i] !== undefined : null;
    const box = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : ''), lang: 'en' }, el('div', 'small', `${i + 1}. ${q.q}`));
    q.options.forEach((o, j) => {
      const r = h('input', { type: 'radio', name: `mq${i}`, value: String(j) });
      r.checked = quiz.answers[i] === String(j);
      r.disabled = quiz.checked;
      r.addEventListener('change', () => { quiz.answers[i] = String(j); });
      box.append(h('label', { class: 'small opt' }, r, ' ', `${'ABCD'[j]}  ${o}`));
    });
    if (quiz.checked) box.append(el('div', 'xs tep-why', `${ok ? '✓' : `✗ คำตอบ: ${q.word}`} — ${q.th}`));
    card.append(box);
  });
  const score = quiz.qs.filter((q, i) => Number(quiz.answers[i]) === q.answer && quiz.answers[i] !== undefined).length;
  const b = h('button', { type: 'button', class: 'btn primary' }, quiz.checked ? 'ทำชุดใหม่' : 'ตรวจคำตอบ');
  b.addEventListener('click', () => { if (quiz.checked) quiz = { qs: buildQuiz(my().done, 5), answers: {}, checked: false }; else quiz.checked = true; renderMyWords(root); });
  if (quiz.checked) card.append(el('div', 'small', `ได้ ${score}/${quiz.qs.length}`));
  card.append(b);
  return card;
}

function queueCard(m, root) {
  const list = h('div', { class: 'chips' }, ...releaseOrder(m, dayKey()).slice(0, 120).map((q) => {
    const b = h('button', { type: 'button', class: `chip mw-${q.color}`, 'aria-label': `เอา ${q.word} ออกจากคิว` }, `${q.word} ✕`);
    b.addEventListener('click', () => { state.mywords.queue = my().queue.filter((x) => x !== q && normWord(x.word) !== normWord(q.word)); save(); renderMyWords(root); });
    return b;
  }));
  return h('details', { class: 'card mw-queue' }, h('summary', { class: 'small' }, `คิวทั้งหมด ${m.queue.length} คำ (เรียงตามลำดับที่จะได้ · กดเพื่อเอาออก)`), list,
    m.queue.length > 120 ? el('p', 'xs muted', `แสดง 120 คำแรก`) : null);
}
