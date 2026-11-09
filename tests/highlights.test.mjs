// Finding highlighter marks by colour (on the device, no AI): orange and pink word-sized boxes,
// red handwriting ignored, pieces split by a pen line joined, reading order, the mosaic prompt.
// Run: node tests/highlights.test.mjs
import assert from 'node:assert/strict';
import { suite } from './helpers.mjs';

const H = await import('../js/engine/highlights.js');
const M = await import('../js/engine/mywords.js');
const { test, done } = suite('highlights');

// A white "page" with painted rectangles; text strokes are dark pixels inside a highlight.
function page(w, h) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const paint = (x, y, rw, rh, [r, g, b]) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) { const i = (yy * w + xx) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  };
  return { img: { data, width: w, height: h }, paint };
}
const ORANGE = [247, 190, 110], PINK = [247, 196, 205], RED_INK = [200, 30, 20], BLUE_PEN = [90, 110, 240], TEXT = [30, 30, 30];

await test('pixel colours: orange and pink highlighter; ink, text and paper are not', async () => {
  assert.equal(H.colorOfPixel(...ORANGE), 'orange');
  assert.equal(H.colorOfPixel(...PINK), 'pink');
  for (const c of [RED_INK, BLUE_PEN, TEXT, [255, 255, 255], [180, 180, 180]]) assert.equal(H.colorOfPixel(...c), '', c.join(','));
});

await test('word-sized boxes are found with their colour; thin red handwriting is ignored', async () => {
  const { img, paint } = page(600, 300);
  paint(20, 20, 120, 22, ORANGE); paint(30, 26, 80, 2, TEXT);          // a highlighted word with a text stroke
  paint(20, 60, 140, 22, PINK);
  paint(20, 100, 160, 3, RED_INK);                                    // a pen line under a word
  paint(320, 40, 100, 20, PINK);                                      // second column
  paint(20, 200, 300, 90, ORANGE);                                    // a big coloured area, not a word
  const r = H.findHighlights(img);
  assert.equal(r.orange.length, 1);
  const o = r.orange[0];   // boxes snap to 4-pixel cells
  assert.ok(Math.abs(o.x - 20) <= 4 && Math.abs(o.y - 20) <= 4 && Math.abs(o.w - 120) <= 8 && Math.abs(o.h - 22) <= 4, JSON.stringify(o));
  assert.equal(r.pink.length, 2);
  assert.deepEqual(r.pink.map((b) => b.x), [20, 320], 'reading order: first column first');
});

await test('a highlight split by a blue pen line is joined back into one box', async () => {
  const { img, paint } = page(400, 100);
  paint(40, 30, 140, 20, PINK);
  paint(100, 26, 4, 28, BLUE_PEN);                                    // the box line through the word
  const r = H.findHighlights(img);
  assert.equal(r.pink.length, 1);
  assert.ok(r.pink[0].x <= 40 && r.pink[0].x + r.pink[0].w >= 180);
});

await test('chunks keep each mosaic to at most 40 pieces', async () => {
  assert.deepEqual(H.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(H.chunk(Array(95).fill(0)).length, 3);
});

await test('mosaic prompt and reply: the colour comes from the device, not the AI', async () => {
  assert.match(M.MOSAIC_PROMPT, /without the part of speech/);
  assert.match(M.MOSAIC_PROMPT, /Never add a word that is not visible/);
  const r = M.parseMosaic('{"words":["accused n.","adjacent","accused","คำ","acquisition"]}', 'pink');
  assert.deepEqual(r, [{ word: 'accused', color: 'pink', th: '' }, { word: 'adjacent', color: 'pink', th: '' }, { word: 'acquisition', color: 'pink', th: '' }]);
  assert.deepEqual(M.parseMosaic('["absent","accommodate"]', 'orange').map((w) => w.color), ['orange', 'orange']);
});

done();
