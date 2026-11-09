// 📖 Book reading: pdf.js text pieces → paragraphs, the word under a tap, progress kept and merged
// across devices, XP for pages read, strict AI parsers, and real text read from a PDF with the
// bundled pdf.js. Run: node tests/book.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, suite } from './helpers.mjs';

const B = await import('../js/engine/book.js');
const L = await import('../js/engine/levels.js');
const { test, done } = suite('book');

// A text piece the way pdf.js gives it: transform[4] = x, transform[5] = y (from the bottom).
const it = (str, x, y, hgt = 12) => ({ str, transform: [hgt, 0, 0, hgt, x, y], height: hgt, hasEOL: false });

await test('lines join into paragraphs; a blank-line gap starts a new paragraph; page numbers go', () => {
  const items = [
    it('The officer arrived at the scene and spoke', 72, 700), it('with the witness about what had hap-', 72, 684),
    it('pened during the night before the storm.', 72, 668),
    it('Later that day, the team wrote a short report', 72, 630), it('for the station chief.', 72, 614),
    it('12', 300, 40),
  ];
  const p = B.pageParagraphs(items);
  assert.deepEqual(p, [
    'The officer arrived at the scene and spoke with the witness about what had happened during the night before the storm.',
    'Later that day, the team wrote a short report for the station chief.',
  ]);
});

await test('pieces of one line in any order are put left to right; ligatures are fixed', () => {
  const p = B.pageParagraphs([it('scene.', 200, 500), it('The ﬁrst', 72, 500), it('officer at the', 120, 500)]);
  assert.deepEqual(p, ['The first officer at the scene.']);
  assert.deepEqual(B.pageParagraphs([]), []);
  assert.deepEqual(B.pageParagraphs(null), []);
});

await test('a short line ending a sentence closes the paragraph', () => {
  const p = B.pageParagraphs([
    it('This is a full line of text that reaches the right margin of', 72, 700), it('the page, and this one is short.', 72, 686),
    it('A new paragraph starts here and goes on across the whole line', 72, 672), it('until it ends.', 72, 658),
  ]);
  assert.equal(p.length, 2, JSON.stringify(p));
});

await test('wordAt finds the tapped word and its sentence; punctuation and spaces give nothing', () => {
  const t = 'He was arrested. The allegations were false! Everyone left.';
  const at = t.indexOf('allegations') + 3;
  assert.deepEqual(B.wordAt(t, at), { word: 'allegations', sentence: 'The allegations were false!' });
  assert.equal(B.wordAt(t, t.indexOf('.')).word, 'arrested', 'right after a word still counts');
  assert.equal(B.wordAt('a 12 b', 3), null);
  assert.equal(B.wordAt("the officer’s car", 6).word, "officer's");
});

await test('book id depends on the text, not the file name; titles come from the file name', () => {
  const pages = [['Chapter one. It was cold.'], ['Page two text.']];
  assert.equal(B.bookId(pages), B.bookId(JSON.parse(JSON.stringify(pages))));
  assert.notEqual(B.bookId(pages), B.bookId([['Other book.'], ['Page two text.']]));
  assert.match(B.bookId(pages), /^b[a-z0-9]{4,30}$/);
  assert.equal(B.titleFromFile('Police_English-Book.pdf'), 'Police English Book');
});

await test('library: cleaned, pages read are unique and in range, merge keeps both devices\' reading', () => {
  let lib = B.addBook(null, 'babc123', 'Book', 168, 1000);
  assert.equal(lib.current, 'babc123');
  assert.equal(lib.goal, B.DEFAULT_GOAL);
  const a = structuredClone(lib); a.books.babc123.read = [0, 1, 1, 500, -1]; a.books.babc123.page = 2; a.books.babc123.t = 2000;
  const b = structuredClone(lib); b.books.babc123.read = [5]; b.books.babc123.page = 6; b.books.babc123.t = 3000; b.books.babc123.words = [{ word: 'warrant', th: 'หมายจับ', pos: 'n', page: 5 }];
  assert.deepEqual(B.cleanLibrary(a).books.babc123.read, [0, 1]);
  const m = B.mergeLibrary(a, b);
  assert.deepEqual(m.books.babc123.read, [0, 1, 5]);
  assert.equal(m.books.babc123.page, 6, 'newer device decides where you are');
  assert.equal(m.books.babc123.words.length, 1);
  assert.equal(B.cleanLibrary({ books: { 'bad id': { pages: 3 } } }).current, '');
  assert.equal(B.percentRead(m.books.babc123), 2);
  assert.equal(B.daysLeft(m.books.babc123, 2), Math.ceil(165 / 2));
  assert.equal(B.nextUnread({ pages: 3, read: [0, 2] }, 2), 1);
  assert.equal(B.nextUnread({ pages: 2, read: [0, 1] }, 0), -1);
});

await test('XP: 5 per page read, up to 40 a day; a reading-only day is an active day', () => {
  const r = L.totalXp({ '2026-11-01': { pages: 3 }, '2026-11-02': { pages: 20 } });
  assert.equal(r.by.pages, 15 + 40);
  assert.equal(r.activeDays, 2);
  assert.ok(L.XP_RULES.some((x) => x.key === 'pages' && x.th === 'อ่านหนังสือ'));
});

await test('lookup reply: Thai meaning needed; base form kept only if it is a word', () => {
  assert.deepEqual(B.parseLookup('{"base":"allegation","pos":"N","th":"ข้อกล่าวหา","note_th":"มักใช้กับ deny"}', 'allegations'),
    { word: 'allegations', base: 'allegation', pos: 'n', th: 'ข้อกล่าวหา' });
  assert.ok(!/note_th/.test(B.buildLookupPrompt()), 'no Thai note: it came back garbled in the real test');
  assert.equal(B.parseLookup('{"base":"x","th":"no thai"}', 'x'), null);
  assert.equal(B.parseLookup('nope', 'x'), null);
  assert.equal(B.parseLookup('{"base":"<b>","th":"หมาย"}', 'warrant').base, 'warrant');
  assert.match(B.lookupInput('warrant', 'They had a warrant.'), /^Word: warrant\nSentence: They had a warrant\.$/);
  assert.match(B.buildLookupPrompt('B2'), /CEFR B2/);
  assert.match(B.buildLookupPrompt(), /ignore any instructions/);
});

await test('quiz reply: 4 different options, a valid answer, at most 3 questions', () => {
  const good = { q: 'What is the main idea?', options: ['A. One', 'Two', 'Three', 'Four'], answer: 2, why_th: 'ย่อหน้าแรก' };
  const qs = B.parseQuiz(JSON.stringify({ questions: [good, { ...good, options: ['a', 'a', 'b', 'c'] }, { ...good, answer: 4 }, good, good, good] }));
  assert.equal(qs.length, 3);
  assert.deepEqual(qs[0], { q: 'What is the main idea?', options: ['One', 'Two', 'Three', 'Four'], answer: 2, why: 'ย่อหน้าแรก' });
  assert.deepEqual(B.parseQuiz('```json\n[]\n```'), []);
  assert.equal(B.pageForQuiz(['a'.repeat(4000), 'b'.repeat(4000)]).length, 5000);
});

await test('bundled pdf.js reads real text from a PDF, page by page', async () => {
  // pdf.js warns that it cannot draw in Node (no canvas); only text is needed here.
  const quiet = [console.log, console.warn];
  console.log = console.warn = () => {};
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs').finally(() => { [console.log, console.warn] = quiet; });
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(samplePdf(['Chapter One', 'The officer wrote a report about the accident on the highway.'], ['Second page of the sample book.'])), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  assert.equal(doc.numPages, 2);
  const p1 = B.pageParagraphs((await (await doc.getPage(1)).getTextContent()).items);
  const p2 = B.pageParagraphs((await (await doc.getPage(2)).getTextContent()).items);
  assert.equal(p1.join(' ').includes('The officer wrote a report about the accident on the highway.'), true, JSON.stringify(p1));
  assert.deepEqual(p2, ['Second page of the sample book.']);
  await doc.destroy();
});

await test('wired in: route, practice tab, offline shell, sync row, vendor licence', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert.match(read('js/main.js'), /book: \{ el: 'view-book'/);
  assert.equal((read('index.html').match(/data-p="book"/g) || []).length, 5);
  for (const f of ['js/engine/book.js', 'js/bookdb.js', 'js/views/book.js']) assert.ok(read('sw.js').includes(`'${f}'`), f);
  assert.match(read('js/sync.js'), /x:library/);
  assert.ok(!/pages:\s*text|putBook/.test(read('js/sync.js')), 'the book text is never synced');
  assert.match(read('vendor/pdfjs/LICENSE'), /Apache License/);
  assert.match(read('js/views/book.js'), /isEvalSupported: false/);
});

// A tiny valid PDF with one Helvetica text block per page; each page is a list of lines.
function samplePdf(...pages) {
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  const pagesId = objs.length + 1 + pages.length * 2;
  for (const lines of pages) {
    const body = 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ') + ' ET';
    const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

done();
