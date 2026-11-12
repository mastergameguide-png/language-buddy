// Finds highlighter marks in a photo of a word list by colour, on the device (no AI): orange and
// pink boxes the size of one printed word. The app then cuts those boxes out and sends only them
// to the AI to read, so the colour never depends on the AI. Pure: works on {data, width, height}
// (an ImageData or the same shape), so it can be tested without a browser.
//
// Tuned on the owner's Good Notes export of the Oxford 5000 list: orange ≈ hue 20–50°, strong
// colour, light; pink ≈ hue 315–12°, soft colour, light. Handwriting in red pen is thin, so it
// does not fill the 4×4-pixel cells a highlight fills.

const CELL = 4;
const MAX_H = 45;   // one highlighted line is at most this tall (px, page scaled to 2000 px)
export const COLOR_NAMES = ['orange', 'pink'];

// Highlights on two lines next to each other touch and come out as one tall group. Cut it where
// fewer cells are coloured (the rounded ends of the strokes meet there), so each line is its own
// box. A solid block of colour has no such narrow row and is left whole (then dropped as too tall).
function splitRows(cells, cw, y0, y1) {
  const rows = y1 - y0 + 1;
  if (rows * CELL <= MAX_H) return [cells];
  const count = new Array(rows).fill(0);
  for (const k of cells) count[Math.floor(k / cw) - y0]++;
  const cuts = [];
  let from = 0;
  for (let r = 2; r < rows - 2; r++) {
    if (r - from < 3) continue;
    const above = Math.max(...count.slice(from, r)), below = Math.max(...count.slice(r + 1));
    if (count[r] <= count[r - 1] && count[r] <= count[r + 1] && count[r] < 0.7 * Math.min(above, below)) { cuts.push(r); from = r + 1; }
  }
  if (!cuts.length) return [cells];
  const parts = Array.from({ length: cuts.length + 1 }, () => []);
  for (const k of cells) {
    const r = Math.floor(k / cw) - y0;
    let i = 0; while (i < cuts.length && r > cuts[i]) i++;
    if (r !== cuts[i]) parts[i].push(k);   // the thin row itself belongs to neither line
  }
  return parts.filter((p) => p.length);
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1e-6;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, mx ? (mx - mn) / mx : 0, mx];
}
export function colorOfPixel(r, g, b) {
  const [h, s, v] = hsv(r / 255, g / 255, b / 255);
  if (h >= 20 && h <= 50 && s >= 0.35 && v >= 0.8) return 'orange';
  if ((h >= 315 || h <= 12) && s >= 0.12 && s <= 0.55 && v >= 0.82) return 'pink';
  return '';
}

// Returns { orange: [{x, y, w, h}], pink: [...] } sorted by column then line.
export function findHighlights({ data, width, height }) {
  const cw = Math.floor(width / CELL), ch = Math.floor(height / CELL);
  const out = {};
  for (const name of COLOR_NAMES) {
    // 1. cells at least half covered by this colour
    const cells = new Uint8Array(cw * ch);
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        let n = 0;
        for (let y = cy * CELL; y < cy * CELL + CELL; y++) {
          for (let x = cx * CELL; x < cx * CELL + CELL; x++) {
            const i = (y * width + x) * 4;
            if (colorOfPixel(data[i], data[i + 1], data[i + 2]) === name) n++;
          }
        }
        if (n >= (CELL * CELL) / 2) cells[cy * cw + cx] = 1;
      }
    }
    // 2. connected groups of cells
    const seen = new Uint8Array(cw * ch);
    const boxes = [];
    for (let start = 0; start < cells.length; start++) {
      if (!cells[start] || seen[start]) continue;
      const stack = [start]; seen[start] = 1;
      const group = [];
      let gy0 = Infinity, gy1 = -1;
      while (stack.length) {
        const k = stack.pop(), x = k % cw, y = (k - x) / cw;
        group.push(k); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * cw + nx;
          if (nx >= 0 && nx < cw && ny >= 0 && ny < ch && cells[nk] && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
        }
      }
      for (const part of splitRows(group, cw, gy0, gy1)) {
        let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
        for (const k of part) { const x = k % cw, y = (k - x) / cw; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const b = { x: x0 * CELL, y: y0 * CELL, w: (x1 - x0 + 1) * CELL, h: (y1 - y0 + 1) * CELL, area: part.length * CELL * CELL };
        if (b.w >= 8 && b.h >= 8 && b.h <= MAX_H) boxes.push(b);
      }
    }
    // 3. join pieces of one highlight split by a pen line (same line, gap up to 16 px)
    boxes.sort((a, b) => a.x - b.x);
    const merged = [];
    for (const b of boxes) {
      const m = merged.find((o) => {
        const ov = Math.min(o.y + o.h, b.y + b.h) - Math.max(o.y, b.y);
        const gap = b.x - (o.x + o.w);
        return ov >= 0.6 * Math.min(o.h, b.h) && gap >= -4 && gap <= 16;
      });
      if (m) {
        const x = Math.min(m.x, b.x), y = Math.min(m.y, b.y);
        m.w = Math.max(m.x + m.w, b.x + b.w) - x; m.h = Math.max(m.y + m.h, b.y + b.h) - y; m.x = x; m.y = y; m.area += b.area;
      } else merged.push({ ...b });
    }
    // 4. keep word-sized, mostly filled boxes; reading order: column by column, top to bottom
    const col = Math.max(1, Math.round(width / 6));
    out[name] = merged.filter((b) => b.w >= 30 && b.h >= 10 && b.h <= MAX_H && b.area >= 0.45 * b.w * b.h)
      .sort((a, b) => Math.floor(a.x / col) - Math.floor(b.x / col) || a.y - b.y)
      .map(({ x, y, w, h }) => ({ x, y, w, h }));
  }
  return out;
}

// Splits boxes into groups small enough for one mosaic image each.
export const chunk = (list, n = 40) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
