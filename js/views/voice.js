// Voice practice: shadowing (listen → repeat → see which words the recogniser caught, or record
// yourself and compare by ear) and listening (gap-fill and dictation). Sentences come from the
// learner's own mistakes, words, chats and scenarios. Nothing here is a pronunciation score.
import { el, h, icon, toast } from '../util.js';
import { state, persist, emit, cefrOf } from '../store.js';
import { SCENARIOS, searchScenarios } from '../engine/scenarios.js';
import { practiceItems, listeningItems, compareWords, splitPhrases, checkAnswer, recordAttempt, itemKey, SOURCE_TH } from '../engine/shadowing.js';
import { speak, listen, stopListening, unlockSpeech, stopSpeaking } from '../speech.js';
import { stt } from '../voice/stt.js';
import { tts } from '../voice/tts.js';
import { canRecord, startRecording } from '../voice/recorder.js';
import { recordShadow, recordListen } from '../stats.js';
import { isEnglish } from '../store.js';

let tab = 'shadow';
let source = '';
let idx = 0;
let phraseMode = false, phrase = 0;
let pinned = null;                     // a sentence sent here from the chat ("practise this")
let lastCompare = null;                // { key, cmp } of the latest attempt on this screen
let recording = null, myAudio = null;  // recorder controller, and blob: URL of the last recording
let lIdx = 0, lResult = null, lCounted = new Set();

const NOT_SCORE = 'วัดว่าระบบฟังเสียงของเบราว์เซอร์จับคำได้กี่คำ — ไม่ใช่คะแนนการออกเสียง (เสียงดัง สำเนียง หรือไมค์ก็มีผลได้)';

// Opens the page with one sentence first (from a correction in the chat).
export function practiseSentence(text, th = '') {
  pinned = { key: itemKey(text), text, th, source: 'mistake' };
  tab = 'shadow'; source = ''; idx = 0; phraseMode = false; lastCompare = null;
  location.hash = '#voice';
}

// Opens the page on one tab ('shadow' or 'listen'), e.g. from a recommendation.
export function openVoice(which = 'shadow') {
  tab = which === 'listen' ? 'listen' : 'shadow';
  if (location.hash === '#voice') render(document.getElementById('voiceBody')); else location.hash = '#voice';
}

function levelExpressions() {
  return searchScenarios(SCENARIOS, { cefr: cefrOf(), english: isEnglish() }).flatMap((s) => s.expressions);
}
function shadowList() {
  let list = practiceItems({ mistakes: state.mistakes, vocab: state.vocab, messages: state.messages, expressions: levelExpressions() });
  if (pinned) list = [pinned, ...list.filter((x) => x.key !== pinned.key)];
  return source ? list.filter((x) => x.source === source) : list;
}

function capabilityLine() {
  const yes = (b) => (b ? '✓' : '✗');
  return el('p', 'xs muted', `เครื่องนี้: เสียงอ่าน ${yes(tts().available())} · ฟังเสียงพูด ${yes(stt().available())} · อัดเสียง ${yes(canRecord())} · การออกเสียง: ยังวัดไม่ได้ (ระบบในเบราว์เซอร์จับได้แค่คำ)`);
}

function releaseAudio() { if (myAudio) URL.revokeObjectURL(myAudio); myAudio = null; }

// ---------- shadowing ----------
function renderShadow(body, root) {
  const chips = h('div', { class: 'chips' });
  for (const [id, label] of [['', 'ทั้งหมด'], ['mistake', 'สมุดผิด'], ['word', 'คลังคำ'], ['chat', 'แชต'], ['scenario', 'สถานการณ์']]) {
    const c = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(source === id) }, label);
    c.addEventListener('click', () => { source = id; idx = 0; phrase = 0; lastCompare = null; render(root); });
    chips.append(c);
  }
  body.append(chips);
  const list = shadowList();
  if (!list.length) {
    body.append(h('div', { class: 'card empty-state' }, el('div', 'big', '🎙️'), el('p', 'small', 'ยังไม่มีประโยคในหมวดนี้ — คุยกับตัวละคร หรือเพิ่มคำศัพท์ แล้วประโยคจะมาอยู่ที่นี่')));
    return;
  }
  idx = Math.min(idx, list.length - 1);
  const item = list[idx];
  const phrases = splitPhrases(item.text);
  if (phrase >= phrases.length) phrase = 0;
  const target = phraseMode ? phrases[phrase] : item.text;
  const rec = state.voice?.[item.key];

  const card = h('div', { class: 'card pad-lg shadow-card' });
  card.append(h('div', { class: 'row xs muted' }, el('span', 'grow', `ข้อ ${idx + 1}/${list.length} · ${SOURCE_TH[item.source] || ''}`),
    rec ? el('span', 'chip good', rec.best == null ? `ฝึกแล้ว ${rec.n} ครั้ง` : `จับคำได้ดีสุด ${Math.round(rec.best * 100)}%`) : null));

  // The sentence; in phrase mode the current phrase is highlighted.
  const line = h('div', { class: 'shadow-text', lang: 'en' });
  if (lastCompare && lastCompare.key === item.key + (phraseMode ? ':' + phrase : '')) {
    for (const w of lastCompare.cmp.words) line.append(el('span', w.ok ? 'w-ok' : 'w-miss', w.word), ' ');
  } else if (phraseMode) {
    phrases.forEach((p, i) => line.append(el('span', i === phrase ? 'phrase on' : 'phrase', p), ' '));
  } else line.append(item.text);
  card.append(line);
  if (item.th) card.append(el('div', 'small muted', item.th));

  // Whole sentence or phrase by phrase
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'ฝึกทั้งประโยคหรือทีละท่อน' });
  for (const [on, label] of [[false, 'ทั้งประโยค'], [true, `ทีละท่อน (${phrases.length})`]]) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(phraseMode === on), class: phraseMode === on ? 'on' : '' }, label);
    b.addEventListener('click', () => { phraseMode = on; phrase = 0; lastCompare = null; render(root); });
    seg.append(b);
  }
  if (phrases.length > 1) card.append(seg);

  const btn = (label, ic, fn, cls = 'btn') => { const b = h('button', { type: 'button', class: cls }, ic ? icon(ic) : '', label); b.addEventListener('click', fn); return b; };
  const listenRow = h('div', { class: 'row wrap-ok' },
    btn('ฟัง', 'speaker', () => { unlockSpeech(); speak(target, { plain: true }); }),
    btn('ฟังช้า 🐢', null, () => { unlockSpeech(); speak(target, { plain: true, slow: true }); }));
  card.append(listenRow);

  // Repeat: speech recognition (word check) and/or recording (compare by ear).
  const live = el('div', 'small muted live');
  const actions = h('div', { class: 'row wrap-ok' });
  if (stt().available()) {
    const mic = btn('พูดตาม (ให้เครื่องฟัง)', 'mic', () => {
      if (mic.classList.contains('on')) { stopListening(); return; }
      stopSpeaking();
      const started = listen({
        onText: (t) => { live.textContent = '🎧 ' + t; },
        onEnd: (heard) => {
          mic.classList.remove('on');
          if (!heard) { live.textContent = 'ไม่ได้ยินเสียง ลองอีกครั้ง (พูดใกล้ไมค์)'; return; }
          const cmp = compareWords(target, heard);
          lastCompare = { key: item.key + (phraseMode ? ':' + phrase : ''), cmp, heard };
          // Progress is kept for whole sentences; phrases are steps toward it.
          if (!phraseMode) { state.voice = recordAttempt(state.voice || {}, item.key, 'shadow', cmp.ratio); recordShadow(cmp.total, cmp.matched); persist(); emit('badges'); }
          render(root);
        },
        onError: (e) => { mic.classList.remove('on'); if (e === 'not-allowed' || e === 'service-not-allowed') toast('ไม่ได้รับอนุญาตให้ใช้ไมค์', true); },
      });
      mic.classList.toggle('on', started);
      if (started) live.textContent = '🎧 กำลังฟัง… พูดประโยคนี้';
    }, 'btn primary');
    actions.append(mic);
  }
  if (canRecord()) {
    const recBtn = btn(recording ? 'หยุดอัด' : 'อัดเสียงตัวเอง', null, async () => {
      if (recording) {
        const r = await recording.stop();
        recording = null;
        releaseAudio();
        myAudio = r.url;
        render(root);
        return;
      }
      try { stopSpeaking(); recording = await startRecording(); render(root); } catch (e) { toast(e.message, true); }
    }, recording ? 'btn danger' : 'btn');
    recBtn.prepend(el('span', '', recording ? '⏹ ' : '⏺ '));
    actions.append(recBtn);
  }
  // Without speech recognition, the learner marks the sentence done themselves.
  if (!stt().available()) {
    actions.append(btn('✓ พูดตามแล้ว', null, () => {
      state.voice = recordAttempt(state.voice || {}, item.key, 'shadow', null); recordShadow(0, 0); persist(); emit('badges');
      toast('บันทึกแล้ว'); next(list.length); render(root);
    }));
  }
  card.append(actions, live);

  if (myAudio) {
    card.append(h('div', { class: 'compare' }, el('span', 'xs muted', 'เทียบเสียง:'),
      btn('ต้นฉบับ', 'speaker', () => speak(target, { plain: true }), 'btn sm'),
      h('audio', { src: myAudio, controls: true, preload: 'auto' })));
  }

  if (lastCompare && lastCompare.key === item.key + (phraseMode ? ':' + phrase : '')) {
    const c = lastCompare.cmp;
    const pct = Math.round(c.ratio * 100);
    card.append(h('div', { class: 'result' },
      el('div', 'small', `จับคำได้ ${c.matched}/${c.total} คำ (${pct}%)${c.extra ? ` · มีคำเกิน ${c.extra} คำ` : ''}`),
      el('div', 'xs muted', `เครื่องได้ยิน: "${lastCompare.heard}"`),
      el('div', 'xs muted', NOT_SCORE)));
  }

  const nav = h('div', { class: 'row', style: 'margin-top:12px' });
  if (phraseMode) {
    nav.append(btn('← ท่อนก่อน', null, () => { phrase = Math.max(0, phrase - 1); lastCompare = null; render(root); }, 'btn sm ghost'),
      el('span', 'grow xs muted', `ท่อน ${phrase + 1}/${phrases.length}`),
      btn(phrase + 1 < phrases.length ? 'ท่อนต่อไป →' : 'ทั้งประโยค →', null, () => {
        if (phrase + 1 < phrases.length) phrase += 1; else { phraseMode = false; phrase = 0; }
        lastCompare = null; render(root);
      }, 'btn sm'));
  } else {
    nav.append(btn('← ก่อนหน้า', null, () => { idx = Math.max(0, idx - 1); lastCompare = null; releaseAudio(); render(root); }, 'btn sm ghost'),
      el('span', 'grow'),
      btn('ข้อต่อไป →', null, () => { next(list.length); render(root); }, 'btn sm primary'));
  }
  card.append(nav);
  body.append(card);
}
function next(n) { idx = (idx + 1) % Math.max(1, n); phrase = 0; lastCompare = null; releaseAudio(); }

// ---------- listening ----------
function renderListen(body, root) {
  const list = listeningItems({ vocab: state.vocab, mistakes: state.mistakes, expressions: levelExpressions() });
  if (!list.length) {
    body.append(h('div', { class: 'card empty-state' }, el('div', 'big', '👂'), el('p', 'small', 'ยังไม่มีข้อฝึกฟัง — เพิ่มคำศัพท์ที่มีประโยคตัวอย่าง หรือคุยกับตัวละครก่อน')));
    return;
  }
  lIdx = Math.min(lIdx, list.length - 1);
  const item = list[lIdx];
  const card = h('div', { class: 'card pad-lg shadow-card' });
  card.append(el('div', 'xs muted', `ข้อ ${lIdx + 1}/${list.length} · ${item.kind === 'gap' ? 'ฟังแล้วเติมคำที่หายไป' : 'ฟังแล้วพิมพ์ทั้งประโยค'}`));
  const play = (slow) => { unlockSpeech(); speak(item.text, { plain: true, slow }); };
  const b1 = h('button', { type: 'button', class: 'btn primary' }, icon('speaker'), 'ฟัง');
  b1.addEventListener('click', () => play(false));
  const b2 = h('button', { type: 'button', class: 'btn' }, 'ฟังช้า 🐢');
  b2.addEventListener('click', () => play(true));
  card.append(h('div', { class: 'row wrap-ok' }, b1, b2));
  if (item.kind === 'gap') card.append(el('div', 'shadow-text', item.prompt));
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'en', placeholder: item.kind === 'gap' ? 'คำที่หายไป' : 'พิมพ์ประโยคที่ได้ยิน', 'aria-label': 'คำตอบ' });
  const check = h('button', { type: 'button', class: 'btn' }, 'ตรวจ');
  const doCheck = () => {
    if (!input.value.trim()) { input.focus(); return; }
    lResult = { key: item.key, typed: input.value, ...checkAnswer(item, input.value) };
    // Only the first check of each item on this visit counts toward the stats.
    if (!lCounted.has(item.key)) {
      lCounted.add(item.key);
      state.voice = recordAttempt(state.voice || {}, item.key, 'listen', lResult.ok ? 1 : lResult.close ? 0.5 : 0);
      recordListen(lResult.ok);
      persist(); emit('badges');
    }
    render(root);
  };
  check.addEventListener('click', doCheck);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); });
  card.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, input), check));
  if (lResult && lResult.key === item.key) {
    input.value = lResult.typed;
    const head = lResult.ok ? '✅ ถูกต้อง' : lResult.close ? '≈ เกือบถูก' : '❌ ยังไม่ถูก';
    const res = h('div', { class: 'result' }, el('div', 'small', head));
    if (lResult.compare) {
      const line = h('div', { class: 'shadow-text sm', lang: 'en' });
      for (const w of lResult.compare.words) line.append(el('span', w.ok ? 'w-ok' : 'w-miss', w.word), ' ');
      res.append(line);
    } else res.append(el('div', 'small', `คำตอบ: ${item.answer} — ${item.text}`));
    if (item.th) res.append(el('div', 'xs muted', item.th));
    card.append(res);
  } else setTimeout(() => input.focus({ preventScroll: true }), 50);
  const nextBtn = h('button', { type: 'button', class: 'btn sm primary' }, 'ข้อต่อไป →');
  nextBtn.addEventListener('click', () => { lIdx = (lIdx + 1) % list.length; lResult = null; render(root); });
  const show = h('button', { type: 'button', class: 'btn sm ghost' }, 'ดูเฉลย');
  show.addEventListener('click', () => { lResult = { key: item.key, typed: input.value, ok: false, close: false, compare: null }; render(root); });
  card.append(h('div', { class: 'row', style: 'margin-top:12px' }, lResult ? null : show, el('span', 'grow'), nextBtn));
  body.append(card);
}

function render(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ฝึกเสียง'),
    el('p', '', 'พูดตามประโยคจากสมุดผิด คลังคำ แชต และสถานการณ์ของคุณเอง แล้วฝึกฟังด้วยการเติมคำและพิมพ์ตามเสียง'))));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  for (const [id, label] of [['shadow', '🎙️ พูดตาม'], ['listen', '👂 ฝึกฟัง']]) {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id) }, label);
    b.addEventListener('click', () => { if (recording) { recording.stop(); recording = null; } tab = id; render(root); });
    tabs.append(b);
  }
  root.append(tabs, capabilityLine());
  const body = h('div', {});
  root.append(body);
  if (tab === 'shadow') renderShadow(body, root); else renderListen(body, root);
}

export const renderVoice = render;

// Leaving the page stops the microphone.
window.addEventListener('hashchange', () => {
  if (location.hash === '#voice') return;
  if (recording) { recording.stop(); recording = null; }
  stopListening();
});
