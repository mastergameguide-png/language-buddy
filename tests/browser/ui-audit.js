// UI audit, run inside the app in a browser (paste into the console, or inject with a test tool).
// It visits every page and reports, per page:
//   - horizontal overflow
//   - interactive controls smaller than 44×44 px (touch target guideline)
//   - controls with no accessible name
//   - number of <h1>
//   - images without alt
//   - text whose contrast against its background is below WCAG AA (4.5:1, or 3:1 for large text)
// Returns a JSON-friendly object. Nothing in the app is changed except the route.
async function uiAudit(routes = ['home', 'chat', 'characters', 'review', 'roleplay', 'voice', 'learn', 'progress', 'me', 'settings']) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  // Effective background: blend translucent layers up the tree onto the page background.
  function bgOf(el) {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) base = blend(l, base);
    return base;
  }
  const visible = (n) => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && n.closest('[hidden]') === null; };
  const label = (n) => (n.getAttribute('aria-label') || n.textContent || n.title || n.placeholder || (n.labels && n.labels[0]?.textContent) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const out = {};
  for (const r of routes) {
    location.hash = '#' + r;
    await wait(700);
    const view = document.querySelector('.view:not([hidden])');
    if (!view) { out[r] = { error: 'no view' }; continue; }
    const controls = [...view.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [tabindex="0"]')].filter(visible);
    const small = controls.filter((n) => { const b = n.getBoundingClientRect(); return (b.width < 44 || b.height < 44) && !n.matches('input[type=checkbox], input[type=radio]') && !n.closest('label'); })
      .map((n) => `${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(' ')[0] : ''} "${label(n)}" ${Math.round(n.getBoundingClientRect().width)}×${Math.round(n.getBoundingClientRect().height)}`);
    const unnamed = controls.filter((n) => !label(n)).map((n) => n.outerHTML.slice(0, 80));
    const lowContrast = [];
    const seen = new Set();
    for (const n of view.querySelectorAll('*')) {
      if (!visible(n) || n.closest('[aria-hidden="true"]') || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const s = getComputedStyle(n);
      const fg = parse(s.color);
      if (!fg) continue;
      const bg = bgOf(n);
      const cr = ratio(blend(fg, bg), bg);
      const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (cr < need && !n.closest('button:disabled, [aria-disabled=true]')) {
        const key = `${s.color}|${n.className}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lowContrast.push(`${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0] || '-'} ${cr.toFixed(2)}:1 "${n.textContent.trim().slice(0, 24)}"`);
      }
    }
    out[r] = {
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      h1: view.querySelectorAll('h1').length,
      controls: controls.length,
      smallTargets: small.length, smallSample: small.slice(0, 6),
      unnamed: unnamed.slice(0, 3),
      imgNoAlt: [...view.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      lowContrast: lowContrast.slice(0, 8), lowContrastCount: lowContrast.length,
    };
  }
  return out;
}
if (typeof window !== 'undefined') window.uiAudit = uiAudit;
