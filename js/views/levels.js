// 🏅 Lv. page: the learner's Lv. and XP (worked out from measured practice), where the XP came
// from, and the gate test every 5 Lv. (English, checked offline, 3 tries a day).
import { el, h, icon, num, fmtMinutes, toast, fmtDate } from '../util.js';
import { state, persist, emit, isEnglish } from '../store.js';
import { streak, totals } from '../stats.js';
import { speak, unlockSpeech } from '../speech.js';
import { tts } from '../voice/tts.js';
import { totalXp, levelInfo, XP_RULES, DAY_BONUS, STREAK_XP, STREAK_CAP, GATE_EVERY, PASS, TRIES_PER_DAY, triesToday, cleanLevels } from '../engine/levels.js';
import { buildGate, scoreGate, SECTION_TH } from '../engine/gates.js';

let exam = null;   // { gate, tier, test, answers, plays, result }
const levels = () => (state.levels = cleanLevels(state.levels));

export function myLevel() {
  const x = totalXp(state.days, state.ielts);
  return { ...x, ...levelInfo(x.xp, levels().passed, isEnglish()) };
}

export function renderLevels(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', '🏅 Lv. ของฉัน'), el('p', 'small muted', 'สะสม XP จากการฝึกทุกวัน ทุก 5 Lv. มีข้อสอบด่าน'))));
  if (exam) { renderExam(root); return; }
  const me = myLevel();
  const tot = totals();

  const pct = me.ready ? 100 : Math.min(100, Math.round((me.into / me.need) * 100));
  const head = h('div', { class: 'card pad-lg lv-card' },
    h('div', { class: 'row' },
      h('div', { class: 'lv-badge', 'aria-label': `เลเวล ${me.lv}` }, el('small', '', 'Lv.'), el('b', '', String(me.lv))),
      h('div', { class: 'grow' },
        el('div', 'small', me.ready ? `ถึงด่าน Lv. ${me.lv} แล้ว` : `อีก ${num(me.need - me.into)} XP ถึง Lv. ${me.lv + 1}`),
        h('div', { class: 'bar' + (me.ready ? ' good' : ''), style: 'margin-top:6px', role: 'progressbar', 'aria-label': 'XP ใน Lv. นี้', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, h('i', { style: `width:${pct}%` })),
        el('div', 'xs muted', `XP สะสม ${num(me.xp)}`))));
  if (me.ready) {
    const tries = triesToday(levels().tries, me.gate);
    const left = TRIES_PER_DAY - tries;
    head.append(el('p', 'small', `🚪 สอบด่านให้ผ่าน (ได้ ${PASS}/12 ขึ้นไป) เพื่อไป Lv. ${me.lv + 1} ต่อ · ระดับข้อสอบ ${me.tier}`));
    if (me.banked > 0) head.append(el('p', 'xs muted', `XP ที่ได้ระหว่างรอสอบยังเก็บไว้ครบ (${num(me.banked)} XP) สอบผ่านแล้ว Lv. จะขึ้นตามทันที`));
    const go = h('button', { type: 'button', class: 'btn primary' }, `เริ่มสอบด่าน Lv. ${me.gate}`);
    go.disabled = left <= 0;
    go.addEventListener('click', () => startExam(me, root));
    head.append(h('div', { class: 'row wrap-ok' }, go, el('span', 'xs muted', left > 0 ? `วันนี้สอบได้อีก ${left} ครั้ง · ใช้เวลาราว 10 นาที` : 'วันนี้ครบ 3 ครั้งแล้ว พรุ่งนี้สอบใหม่ได้')));
  } else if (!isEnglish()) {
    head.append(el('p', 'xs muted', 'ข้อสอบด่านตอนนี้มีเฉพาะภาษาอังกฤษ ภาษาอื่นจึงขึ้น Lv. ได้ต่อเนื่องโดยไม่ต้องสอบ'));
  } else {
    head.append(el('p', 'xs muted', `ทุก ${GATE_EVERY} Lv. มีข้อสอบด่าน (คำศัพท์ ไวยากรณ์ อ่าน ฟัง) ด่านต่อไป: Lv. ${Math.ceil((me.lv + 1) / GATE_EVERY) * GATE_EVERY}`));
  }
  root.append(head);

  // Real numbers behind the XP.
  root.append(el('h2', 'sec', 'สถิติที่นับจริง'));
  root.append(h('div', { class: 'grid cols-4' },
    stat('เวลาเรียนทั้งหมด', fmtMinutes(tot.secs), 'นับเฉพาะตอนใช้แอปจริง'),
    stat('คุยไปแล้ว', `${num(tot.msgs)} ข้อความ`, `พูดด้วยเสียง ${num(tot.voice)} ครั้ง`),
    stat('เรียนต่อเนื่อง', `🔥 ${streak()} วัน`, `สูงสุด ${num(me.bestRow)} วัน`),
    stat('วันที่ได้เรียน', `${num(me.activeDays)} วัน`, 'ทั้งหมด')));

  root.append(el('h2', 'sec', 'XP มาจากไหน'));
  const from = h('div', { class: 'card' });
  for (const r of XP_RULES) from.append(row(r.th, `${num(me.by[r.key])} XP`, `${r.xp} XP ต่อ${r.per} · สูงสุด ${r.cap} XP ต่อวัน`));
  from.append(row('โบนัสวันที่เรียน + วันต่อเนื่อง', `${num(me.by.bonus)} XP`, `${DAY_BONUS} XP ต่อวัน + ${STREAK_XP} XP × วันติดกัน (สูงสุด ${STREAK_CAP} วัน)`));
  from.append(el('p', 'xs muted', 'XP คำนวณจากสถิติที่แอปวัดในเครื่องนี้เท่านั้น ไม่มีการเดาหรือให้ AI ให้คะแนน แต่ละอย่างมีเพดานต่อวัน เพื่อให้การฝึกสม่ำเสมอทุกวันได้ XP มากกว่าการฝึกหนักวันเดียว'));
  root.append(from);

  const tries = levels().tries.slice(-5).reverse();
  if (tries.length) {
    root.append(el('h2', 'sec', 'ผลสอบด่านล่าสุด'));
    root.append(h('div', { class: 'card' }, ...tries.map((t) => row(`ด่าน Lv. ${t.gate}`, `${t.score}/${t.total} ${t.score >= PASS ? '✅ ผ่าน' : '❌'}`, fmtDate(t.t)))));
  }
}

function stat(label, value, sub) {
  return h('div', { class: 'card stat' }, el('div', 'label', label), el('div', 'value', value), sub ? el('div', 'sub', sub) : null);
}
function row(label, value, sub) {
  return h('div', { class: 'row lv-row' }, h('div', { class: 'grow' }, el('div', 'small', label), el('div', 'xs muted', sub)), el('b', 'small', value));
}

function startExam(me, root) {
  exam = { gate: me.gate, tier: me.tier, test: buildGate(me.tier), answers: {}, plays: {}, result: null };
  renderLevels(root);
  root.closest('.scroll')?.scrollTo(0, 0);
}

function renderExam(root) {
  const { test, result } = exam;
  root.append(el('p', 'small', `ข้อสอบด่าน Lv. ${exam.gate} · ระดับ ${exam.tier} · 12 ข้อ ต้องได้ ${PASS} ข้อขึ้นไป`));
  let lastSection = '', lastText = '';
  const card = h('div', { class: 'card pad-lg' });
  test.forEach((q, i) => {
    if (q.section !== lastSection) { card.append(el('h2', 'sec', SECTION_TH[q.section])); lastSection = q.section; }
    if (q.text && q.text !== lastText) { card.append(el('div', 'reading-text small', q.text)); lastText = q.text; }
    const ok = result ? Number(exam.answers[i]) === q.answer : null;
    const box = h('div', { class: 'lq' + (ok === true ? ' ok' : ok === false ? ' bad' : ''), lang: 'en' }, el('div', 'small', `${i + 1}. ${q.q}`));
    if (q.say) {
      const n = exam.plays[i] || 0;
      const play = h('button', { type: 'button', class: 'btn sm', 'aria-label': `ฟังข้อ ${i + 1}` }, icon('speaker'), n ? `ฟังอีกครั้ง (เหลือ ${2 - n})` : 'ฟัง');
      play.disabled = n >= 2 && !result;
      play.addEventListener('click', () => { unlockSpeech(); speak(q.say, { plain: true }); if (!result) { exam.plays[i] = n + 1; renderLevels(root); } });
      box.append(play);
      // No device voice: show the sentence, so the question can still be answered.
      if (result || !tts().available()) box.append(el('div', 'xs muted', `${result ? 'ประโยคที่ได้ยิน' : 'เครื่องนี้อ่านออกเสียงไม่ได้ อ่านประโยคแทน'}: ${q.say}`));
    }
    q.options.forEach((o, j) => {
      const r = h('input', { type: 'radio', name: `gq${i}`, value: String(j) });
      r.checked = exam.answers[i] === String(j);
      r.disabled = !!result;
      r.addEventListener('change', () => { exam.answers[i] = String(j); });
      box.append(h('label', { class: 'small opt' }, r, ' ', `${'ABCD'[j]}  ${o}`));
    });
    if (result && !ok) box.append(el('div', 'xs', `คำตอบ: ${'ABCD'[q.answer]}  ${q.options[q.answer]}`));
    card.append(box);
  });
  root.append(card);

  if (!result) {
    const send = h('button', { type: 'button', class: 'btn primary' }, 'ส่งคำตอบ');
    send.addEventListener('click', () => {
      const missing = test.length - Object.keys(exam.answers).length;
      if (missing && !confirm(`ยังไม่ได้ตอบ ${missing} ข้อ ข้อที่ไม่ตอบนับว่าผิด ส่งเลยไหม?`)) return;
      finishExam(root);
    });
    const quit = h('button', { type: 'button', class: 'btn ghost' }, 'ออก (ไม่นับครั้งนี้)');
    quit.addEventListener('click', () => { exam = null; renderLevels(root); });
    root.append(h('div', { class: 'row wrap-ok' }, send, quit));
    return;
  }
  const passed = result.score >= PASS;
  const sum = h('div', { class: 'card pad-lg' },
    el('div', 'shadow-text', passed ? `🎉 ผ่านด่าน! ได้ ${result.score}/${result.total}` : `ได้ ${result.score}/${result.total} ยังไม่ผ่าน (ต้อง ${PASS})`),
    ...Object.entries(result.by).map(([k, v]) => el('div', 'small', `${SECTION_TH[k]}: ${v.score}/${v.total}`)),
    el('p', 'xs muted', passed ? 'Lv. ขึ้นตาม XP ที่สะสมไว้แล้ว' : 'ดูข้อที่ผิดด้านบน แล้วลองใหม่ได้ ข้อสอบจะสุ่มชุดใหม่ทุกครั้ง'));
  const back = h('button', { type: 'button', class: 'btn primary' }, 'กลับไปหน้า Lv.');
  back.addEventListener('click', () => { exam = null; renderLevels(root); root.closest('.scroll')?.scrollTo(0, 0); });
  sum.append(back);
  root.append(sum);
}

function finishExam(root) {
  const res = scoreGate(exam.test, exam.answers);
  exam.result = res;
  const lv = levels();
  lv.tries.push({ t: Date.now(), gate: exam.gate, score: res.score, total: res.total });
  if (res.score >= PASS && !lv.passed.includes(exam.gate)) lv.passed.push(exam.gate);
  state.levels = cleanLevels(lv);
  persist();
  emit('state');
  if (res.score >= PASS) toast(`🎉 ผ่านด่าน Lv. ${exam.gate} แล้ว! ตอนนี้ Lv. ${myLevel().lv}`);
  renderLevels(root);
  root.closest('.scroll')?.scrollTo(0, 0);
}

// Leaving the page drops an unfinished test (it is not counted).
window.addEventListener('hashchange', () => { if (location.hash !== '#levels' && exam && !exam.result) exam = null; });
