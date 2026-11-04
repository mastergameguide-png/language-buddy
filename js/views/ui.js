// Small shared building blocks, so every page shows titles, sections, empty and error states the
// same way. Text is always set with textContent (see util.js).
import { el, h } from '../util.js';

// Page title + one-line description. The h1 is the page's main heading.
export const pageHead = (title, desc) => h('div', { class: 'page-head' }, h('div', {}, el('h1', '', title), desc ? el('p', '', desc) : null));

// Section heading with an optional link or button on the right.
export function sectionHeader(title, action) {
  const t = el('h2', 'sec', title);
  return action ? h('div', { class: 'sec-row' }, t, action) : t;
}

// "Nothing here yet" box: icon, text, and an optional action { label, href } or { label, onClick }.
export function emptyState(icon, text, action, { card = true } = {}) {
  const box = h('div', { class: (card ? 'card ' : '') + 'empty-state', role: 'status' }, el('div', 'big', icon), el('p', 'small', text));
  if (action) {
    const b = action.href ? h('a', { class: 'btn primary', href: action.href }, action.label) : h('button', { type: 'button', class: 'btn primary' }, action.label);
    if (action.onClick) b.addEventListener('click', action.onClick);
    box.append(b);
  }
  return box;
}

// Something went wrong, with an optional retry.
export function errorBox(text, retry) {
  const box = h('div', { class: 'notice err', role: 'alert' }, text);
  if (retry) {
    const b = h('button', { type: 'button', class: 'btn sm' }, 'ลองอีกครั้ง');
    b.addEventListener('click', retry);
    box.append(el('br'), b);
  }
  return box;
}

// Announces a short message to screen readers without moving focus.
export function announce(text) {
  const live = document.getElementById('srLive');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = String(text).slice(0, 300); }, 50);
}
