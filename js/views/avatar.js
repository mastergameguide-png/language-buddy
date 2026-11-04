// Character avatar: a portrait from assets/characters/<id>/<expression>.webp when the files exist
// (listed in the character's avatar.available), otherwise a drawn initial. No placeholder photos.
import { el, h } from '../util.js';
import { expressionFor } from '../engine/emotion.js';

export function avatarSrc(char, emotion) {
  const have = char.avatar?.available || [];
  if (!have.length || char.custom) return null;
  const want = expressionFor(emotion);
  const file = have.includes(want) ? want : have.includes('default') ? 'default' : have[0];
  return `assets/characters/${char.id}/${file}.webp`;
}

export function avatarEl(char, emotion, size = 'md') {
  const box = el('div', `avatar av-${size}`);
  box.style.setProperty('--av', char.avatar?.color || 'var(--accent)');
  box.setAttribute('aria-hidden', 'true');
  const fallback = () => {
    box.textContent = '';
    box.append(el('span', 'av-initial', (char.name || '?').charAt(0).toUpperCase()));
    if (char.avatar?.emoji) box.append(el('span', 'av-badge', char.avatar.emoji));
  };
  const src = avatarSrc(char, emotion);
  if (!src) { fallback(); return box; }
  const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async', width: '96', height: '96' });
  // A missing expression falls back to the default portrait, then to the initial.
  img.addEventListener('error', () => {
    const def = `assets/characters/${char.id}/default.webp`;
    if (!img.src.endsWith('/default.webp') && (char.avatar.available || []).includes('default')) img.src = def;
    else fallback();
  });
  box.append(img);
  return box;
}
