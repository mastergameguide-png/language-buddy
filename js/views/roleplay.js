// Role-play scenarios grouped by theme, a custom scenario box, and past results.
import { el, h, fmtDate } from '../util.js';
import { settings, state, isEnglish } from '../store.js';
import { startScene } from './chat.js';

const IELTS_FEEDBACK = 'As an IELTS examiner, estimate the user\'s band for each criterion — Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy (pronunciation cannot be judged from text, say so) — and an overall band, based only on what they wrote. Then give 3 specific ways to reach the next half band, each with a better version of one of their own sentences. For "score", use the overall band scaled to 0–10 (band 9 = 10).';

export const SCENE_GROUPS = [
  { title: 'ชีวิตประจำวัน', scenes: [
    { id: 'daily', icon: '☀️', th: 'คุยเรื่องทั่วไป', sub: 'งาน งานอดิเรก แผนวันหยุด', en: 'You are a friendly neighbour the user meets every morning. Have an easy everyday conversation: the weather, plans for the day, weekend, hobbies, food. Ask follow-up questions like a real person.' },
    { id: 'restaurant', icon: '🍜', th: 'สั่งอาหารที่ร้าน', sub: 'เมนู แพ้อาหาร เช็กบิล', en: 'The user is a customer at a restaurant. You are the waiter: greet them, take the order, answer questions about the menu and allergies, and bring the bill at the end.' },
    { id: 'shopping', icon: '🛍️', th: 'ซื้อของ ต่อราคา', sub: 'ไซซ์ สี ราคา คืนของ', en: 'You are a friendly shop owner. The user wants to buy something and may try to bargain or ask to exchange an item. Talk about sizes, colours and price.' },
    { id: 'phone', icon: '📞', th: 'โทรจองโต๊ะ', sub: 'วัน เวลา จำนวนคน', en: 'You are a restaurant staff member answering the phone. The user is calling to book a table: date, time, number of people, name, special requests.' },
    { id: 'party', icon: '🎉', th: 'เจอเพื่อนใหม่', sub: 'Small talk ในงานปาร์ตี้', en: 'You are someone the user just met at a party. Make small talk: names, where you are from, work or study, hobbies, and suggest meeting again.' },
  ] },
  { title: 'เดินทาง', scenes: [
    { id: 'airport', icon: '✈️', th: 'ตม. และสนามบิน', sub: 'จุดประสงค์ ที่พัก ตั๋วกลับ', en: 'You are an immigration officer at the airport. Ask the user the usual questions: purpose of visit, how long, where they will stay, return ticket.' },
    { id: 'hotel', icon: '🏨', th: 'เช็กอินโรงแรม', sub: 'จองห้อง ปัญหาในห้อง', en: 'You are the hotel receptionist. The user is checking in: ask for the booking name, explain breakfast time, Wi-Fi, and handle a small problem with the room.' },
    { id: 'directions', icon: '🗺️', th: 'ถามทาง', sub: 'ทิศทาง จุดสังเกต', en: 'You are a local person on the street. The user is a tourist asking for directions. Give realistic directions with landmarks and check they understood.' },
    { id: 'transport', icon: '🚆', th: 'ซื้อตั๋วรถไฟ/รถบัส', sub: 'เที่ยว เวลา เปลี่ยนสาย', en: 'You are a ticket office clerk at a train station. The user wants to buy a ticket: destination, one-way or return, times, platform, delays and changing trains.' },
  ] },
  { title: 'งานและการเรียน', scenes: [
    { id: 'interview', icon: '💼', th: 'สัมภาษณ์งาน', sub: 'แนะนำตัว จุดแข็ง', en: 'You are a job interviewer. Ask the user typical interview questions one at a time (introduce yourself, strengths and weaknesses, a difficult situation, why this job) and react to their answers.' },
    { id: 'meeting', icon: '📊', th: 'ประชุมธุรกิจ', sub: 'อัปเดตงาน เสนอไอเดีย', en: 'You are the user\'s manager in a short team meeting. Ask for a project update, discuss a problem and a deadline, ask for their opinion and agree on next steps. Use common business English.' },
    { id: 'vet', icon: '🐾', th: 'คลินิกสัตว์ (คุณเป็นหมอ)', sub: 'ซักประวัติ อธิบายการรักษา', en: 'You are a worried pet owner at a veterinary clinic; the USER is the veterinarian. Describe your pet\'s symptoms bit by bit and ask the vet questions about diagnosis and care.' },
  ] },
  { title: 'สุขภาพและฉุกเฉิน', scenes: [
    { id: 'doctor', icon: '🏥', th: 'ไปหาหมอ', sub: 'อาการ วิธีกินยา', en: 'You are a doctor at a clinic. The user is a patient: ask about symptoms, how long, give simple advice and explain how to take medicine.' },
    { id: 'emergency', icon: '🚨', th: 'เหตุฉุกเฉิน', sub: 'ทำพาสปอร์ตหาย แจ้งตำรวจ', en: 'You are a police officer at a tourist police desk. The user lost their passport and wallet. Ask what happened, where and when, take their details, and explain what to do next (police report, embassy). Keep a calm, realistic tone.' },
  ] },
  { title: 'สอบ', englishOnly: true, scenes: [
    { id: 'ielts', icon: '🎓', th: 'สอบพูด IELTS', sub: 'Part 1–3 พร้อมประเมิน band', englishOnly: true, feedback: IELTS_FEEDBACK,
      en: 'You are an IELTS Speaking examiner running a full mock test. Part 1: ask 4–5 short questions about familiar topics (home, work or study, hobbies), one at a time. Part 2: give a cue card (a topic plus 3–4 bullet points), tell the user to prepare and speak for 1–2 minutes, then ask one short follow-up. Part 3: ask 3–4 deeper discussion questions linked to the Part 2 topic. Say which part you are starting. Behave like a real examiner: neutral and polite, no teaching during the test, one question per turn.' },
  ] },
];
const ALL = SCENE_GROUPS.flatMap((g) => g.scenes);

// A scene the learner has not done lately (IELTS first if they set a band).
export function suggestScene() {
  const done = new Set(state.results.slice(-6).map((r) => r.scene));
  const pool = ALL.filter((s) => (!s.englishOnly || isEnglish()) && !done.has(s.th));
  if (/^IELTS /.test(settings.level) && isEnglish() && !done.has('สอบพูด IELTS')) return ALL.find((s) => s.id === 'ielts');
  return pool.length ? pool[new Date().getDate() % pool.length] : null;
}

export function renderRoleplay(root) {
  root.textContent = '';
  root.append(h('div', { class: 'page-head' }, h('div', {}, el('h1', '', 'ฝึกสถานการณ์จริง'),
    el('p', '', `${settings.name} จะเล่นเป็นอีกฝ่าย พอเสร็จกด "จบและขอคำแนะนำ" ในแชต จะได้คะแนนและคำแนะนำเป็นภาษาไทย`))));

  if (state.scene) {
    root.append(h('div', { class: 'card', style: 'border-color: var(--warn)' },
      h('div', { class: 'row' }, el('span', 'grow small', `${state.scene.icon} กำลังฝึกอยู่: ${state.scene.th}`), h('a', { class: 'btn sm', href: '#chat' }, 'กลับไปที่แชต'))));
  }

  for (const g of SCENE_GROUPS) {
    if (g.englishOnly && !isEnglish()) continue;
    root.append(el('h2', 'sec', g.title));
    const grid = h('div', { class: 'scenes' });
    for (const s of g.scenes) {
      const b = h('button', { type: 'button', class: 'scene' }, el('span', 'em', s.icon), el('b', '', s.th), el('small', '', s.sub));
      b.addEventListener('click', () => startScene(s));
      grid.append(b);
    }
    root.append(grid);
  }

  root.append(el('h2', 'sec', 'สร้างสถานการณ์เอง'));
  const inp = h('input', { class: 'input', type: 'text', maxlength: '120', placeholder: 'เช่น คุยกับเจ้าของห้องเช่าเรื่องแอร์เสีย' });
  const go = h('button', { type: 'button', class: 'btn primary' }, 'เริ่ม');
  go.addEventListener('click', () => {
    const t = inp.value.trim();
    if (!t) { inp.focus(); return; }
    startScene({ icon: '🎭', th: t, en: `Situation chosen by the user (written in Thai or ${settings.lang}): "${t}". Play the other person in this situation.` });
  });
  root.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, inp), go));

  const res = state.results.slice(-8).reverse();
  if (res.length) {
    root.append(el('h2', 'sec', 'ผลการฝึกล่าสุด'));
    const list = h('div', { class: 'list' });
    for (const r of res) {
      const score = r.score == null ? null : el('span', 'chip ' + (r.score >= 7 ? 'good' : r.score >= 5 ? 'warn' : 'bad'), `${r.score}/10`);
      const item = h('div', { class: 'item', style: 'flex-direction:column; align-items:stretch; cursor:pointer' },
        h('div', { class: 'row' }, el('span', 'ico', r.icon || '🎭'), el('span', 'grow small', r.scene), score, el('span', 'xs muted', fmtDate(r.t))));
      const sum = el('div', 'small muted', r.summary);
      sum.hidden = true;
      sum.style.whiteSpace = 'pre-wrap';
      item.append(sum);
      item.addEventListener('click', () => { sum.hidden = !sum.hidden; });
      list.append(item);
    }
    root.append(list);
  }
}
