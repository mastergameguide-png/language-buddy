// First-run guide: three short steps in a modal dialog (what the app does → language and level →
// pick a buddy and start). It opens once; one localStorage flag remembers that it was shown.
import { el, h } from '../util.js';
import { settings, state, setSettings, LANGS } from '../store.js';
import { CHARACTERS } from '../engine/characters.js';
import { fillLevelSelect } from './settings.js';
import { avatarEl } from './avatar.js';
import { switchCharacter } from './chat.js';
import { announce } from './ui.js';

const FLAG = 'lb_onboarded';
const STEPS = 3;

const wasShown = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return true; } };   // no storage: don't nag
const markShown = () => { try { localStorage.setItem(FLAG, '1'); } catch {} };

export function maybeOnboard() {
  if (wasShown()) return;
  // Someone who already uses the app does not need the guide.
  if (state.messages.length || state.vocab.length || state.mistakes.length) { markShown(); return; }
  openGuide();
}

function openGuide() {
  const pick = {
    lang: settings.lang,
    level: settings.level,
    char: CHARACTERS.some((c) => c.id === settings.character) ? settings.character : CHARACTERS[0].id,
  };
  let step = 1;
  const dlg = h('dialog', { class: 'sheet onboarding', 'aria-labelledby': 'obTitle' });
  const body = h('div', { class: 'sheet-body' });
  dlg.append(body);

  const finish = (andChat) => {
    markShown();
    dlg.close();
    dlg.remove();
    if (andChat) switchCharacter(pick.char);
  };
  // Escape counts as "skip".
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });

  function stepOne() {
    const list = h('ul', { class: 'ob-list' });
    for (const [icon, text] of [
      ['💬', 'คุยกับเพื่อน AI เป็นภาษาที่คุณอยากฝึก พิมพ์หรือพูดก็ได้'],
      ['✏️', 'ได้คำแก้ไวยากรณ์และสำนวนทันที พร้อมคำอธิบายเป็นภาษาไทย'],
      ['🔁', 'ทบทวนคำศัพท์และข้อที่เคยผิด ให้จำได้นานขึ้น'],
      ['🎭', 'ฝึกสถานการณ์จริง เช่น สั่งอาหาร สัมภาษณ์งาน และเตรียมสอบ IELTS'],
    ]) list.append(h('li', {}, el('span', 'ob-ico', icon), el('span', '', text)));
    return { title: 'ยินดีต้อนรับสู่ Language Buddy', content: [el('p', 'muted', 'ฝึกภาษากับเพื่อน AI ฟรี ใช้เวลาตั้งค่าไม่ถึงนาที'), list] };
  }

  function stepTwo() {
    const lang = h('select', { class: 'input', id: 'obLang' });
    for (const [key, v] of Object.entries(LANGS)) lang.append(h('option', { value: key }, v.label));
    lang.value = pick.lang;
    const level = h('select', { class: 'input', id: 'obLevel' });
    fillLevelSelect(level, pick.lang, pick.level);
    lang.addEventListener('change', () => { pick.lang = lang.value; fillLevelSelect(level, pick.lang, level.value); pick.level = level.value; });
    level.addEventListener('change', () => { pick.level = level.value; });
    pick.level = level.value;
    return {
      title: 'เลือกภาษาและระดับ',
      content: [
        h('label', { class: 'field' }, el('span', '', 'ภาษาที่อยากฝึก'), lang),
        el('div', 'hint', 'เปลี่ยนภายหลังได้ที่ ฉัน → ตั้งค่า'),
        h('label', { class: 'field' }, el('span', '', 'ระดับของคุณ'), level),
        el('div', 'hint', 'เลือกที่ใกล้เคียง ไม่ต้องเป๊ะ (A1 เริ่มต้น → C2 เชี่ยวชาญ) เพื่อน AI จะปรับความยากให้เอง'),
      ],
    };
  }

  function stepThree() {
    const group = h('div', { class: 'ob-chars', role: 'radiogroup', 'aria-labelledby': 'obTitle' });
    for (const c of CHARACTERS) {
      const input = h('input', { type: 'radio', name: 'obChar', value: c.id });
      input.checked = c.id === pick.char;
      input.addEventListener('change', () => { pick.char = c.id; });
      group.append(h('label', { class: 'ob-char' }, input, avatarEl(c, null, 'md'),
        h('span', { class: 'grow' }, el('b', '', c.name), el('small', 'muted', c.tagline.th))));
    }
    return { title: 'เลือกเพื่อนที่อยากคุยด้วย', content: [group, el('div', 'hint', 'ทุกคนเป็นตัวละคร AI สมมติ เปลี่ยนคนคุยได้ทุกเมื่อที่หน้า ตัวละคร')] };
  }

  function render() {
    const s = [stepOne, stepTwo, stepThree][step - 1]();
    body.textContent = '';
    const title = h('h2', { id: 'obTitle', tabindex: '-1' }, s.title);
    const dots = h('span', { class: 'ob-dots', 'aria-hidden': 'true' });
    for (let i = 1; i <= STEPS; i++) dots.append(el('i', i === step ? 'on' : ''));
    const skip = h('button', { type: 'button', class: 'btn ghost' }, 'ข้าม');
    skip.addEventListener('click', () => finish(false));
    const back = step > 1 ? h('button', { type: 'button', class: 'btn' }, 'ย้อนกลับ') : null;
    back?.addEventListener('click', () => { step--; render(); });
    const next = h('button', { type: 'button', class: 'btn primary' }, step === STEPS ? 'เริ่มคุยเลย' : 'ถัดไป');
    next.addEventListener('click', () => {
      if (step === 2) setSettings({ ...settings, lang: pick.lang, level: pick.level });
      if (step === STEPS) finish(true);
      else { step++; render(); }
    });
    body.append(
      h('div', { class: 'ob-head' }, el('p', 'xs muted ob-count', `ขั้นที่ ${step} จาก ${STEPS}`), dots),
      title, ...s.content,
      h('div', { class: 'ob-actions' }, skip, h('span', { class: 'grow' }), back, next),
    );
    title.focus({ preventScroll: true });
    announce(`ขั้นที่ ${step} จาก ${STEPS}`);
  }

  document.body.append(dlg);
  dlg.showModal();
  render();
}
