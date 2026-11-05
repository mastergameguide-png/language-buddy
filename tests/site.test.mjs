// Static checks on the shell of the site: CSP, fonts, share tags, offline cache and the deploy workflow.
// Run: node tests/site.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, suite } from './helpers.mjs';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), sw = read('sw.js'), css = read('css/app.css'), flow = read('.github/workflows/pages.yml');
const { test, done } = suite('site');
const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) || '').split(/\s+/).slice(1);

await test('CSP connect-src names its hosts: no bare https:', () => {
  const c = directive('connect-src');
  assert.ok(!c.includes('https:') && !c.includes('*'), c.join(' '));
  assert.ok(c.includes('https://language-buddy.mastergameguide.workers.dev'));
  assert.ok(c.includes('https://fonts.googleapis.com') && c.includes('https://fonts.gstatic.com'));
});
await test('CSP allows Google Fonts styles and font files only', () => {
  assert.ok(directive('style-src').includes('https://fonts.googleapis.com'));
  assert.deepEqual(directive('font-src'), ["'self'", 'https://fonts.gstatic.com']);
});
await test('Noto Sans Thai 400/500/700 with display=swap and preconnect', () => {
  assert.match(html, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
  assert.match(html, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(html, /family=Noto\+Sans\+Thai:wght@400;500;700&display=swap/);
  assert.match(css, /--font: "Noto Sans Thai", "Sarabun", system-ui, sans-serif;/);
});
await test('share tags are present and og-image is 1200x630', () => {
  for (const t of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:url"', 'name="twitter:card" content="summary_large_image"']) assert.ok(html.includes(t), t);
  const png = fs.readFileSync(path.join(ROOT, 'og-image.png'));
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
});
await test('every app script is in the offline shell', () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = d + '/' + e.name; e.isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } };
  walk('js');
  const missing = files.filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(missing, []);
});
await test('service worker caches the fonts in a separate cache that survives updates', () => {
  assert.match(sw, /FONT_HOSTS = \['fonts\.googleapis\.com', 'fonts\.gstatic\.com'\]/);
  assert.match(sw, /k !== CACHE && k !== FONT_CACHE/);
});
await test('workflow stamps the cache name and the stamp pattern matches sw.js', () => {
  assert.match(flow, /branches: \[main\]/);
  const m = sw.match(/^const CACHE = '[^']*';/m);
  assert.ok(m, 'sw.js must keep one `const CACHE = \'...\';` line at the start of a line');
  assert.equal(m[0].replace(/^const CACHE = '[^']*';/, "const CACHE = 'buddy-abc1234';"), "const CACHE = 'buddy-abc1234';");
  assert.ok(flow.includes('GITHUB_SHA::7') && flow.includes('og-image.png'));
});
await test('settings: advanced part is a <details> and the Worker field has no fake URL placeholder', () => {
  assert.match(html, /<details class="card set-group set-advanced" id="advanced">/);
  for (const id of ['sWorker', 'sAccess', 'sLimit', 'syncNew']) assert.ok(html.indexOf(`id="${id}"`) > html.indexOf('id="advanced"'), id);
  for (const id of ['sLang', 'sLevel', 'sRate', 'sAutoSend', 'pushOn']) assert.ok(html.indexOf(`id="${id}"`) < html.indexOf('id="advanced"'), id);
  assert.ok(!/placeholder="https:\/\/language-buddy\.xxx/.test(html));
});
await test('no secret is hard-coded in the page or the service worker', () => {
  assert.ok(!/ACCESS_CODE\s*[:=]\s*['"][^'"]+['"]/.test(html + sw));
});
done();
