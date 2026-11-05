// Short courses: ordered steps built from activities the app already has (scenarios, voice
// practice, review, IELTS practice including Reading). Progress is worked out from what the learner really did after
// starting the course, so nothing can be ticked off without doing it. Pure.
import { dayRange } from './analytics.js';

export const COURSES = [
  { id: 'cafe', icon: '☕', th: 'สั่งอาหารและเครื่องดื่มให้มั่นใจ', level: 'A1–B1', days: 5,
    desc: 'คาเฟ่ ร้านอาหาร และโทรจองโต๊ะ พร้อมฝึกพูดและฟัง',
    steps: [
      { type: 'scenario', id: 'cafe', th: 'สั่งเครื่องดื่มที่คาเฟ่' },
      { type: 'shadow', n: 5, th: 'พูดตาม 5 ประโยค' },
      { type: 'scenario', id: 'restaurant', th: 'สั่งอาหารที่ร้านอาหาร' },
      { type: 'listen', n: 5, th: 'ฝึกฟัง 5 ข้อ' },
      { type: 'scenario', id: 'phone', th: 'โทรจองโต๊ะ' },
      { type: 'review', n: 10, th: 'ทบทวนคำที่เจอ 10 ข้อ' },
    ] },
  { id: 'travel', icon: '✈️', th: 'เตรียมพร้อมเที่ยวต่างประเทศ', level: 'A2–B1', days: 7,
    desc: 'สนามบิน โรงแรม ถามทาง ซื้อตั๋ว และร้านขายยา',
    steps: [
      { type: 'scenario', id: 'airport', th: 'สนามบินและ ตม.' },
      { type: 'scenario', id: 'hotel', th: 'เช็กอินโรงแรม' },
      { type: 'shadow', n: 5, th: 'พูดตาม 5 ประโยค' },
      { type: 'scenario', id: 'abroad', th: 'ถามทาง' },
      { type: 'scenario', id: 'transport', th: 'ซื้อตั๋วรถไฟ' },
      { type: 'scenario', id: 'pharmacy', th: 'ซื้อยาที่ร้านขายยา' },
      { type: 'review', n: 10, th: 'ทบทวน 10 ข้อ' },
    ] },
  { id: 'work', icon: '💼', th: 'ภาษาอังกฤษสำหรับที่ทำงาน', level: 'B1–B2', days: 7,
    desc: 'วันแรกที่ทำงาน สัมภาษณ์งาน ประชุม และโทรหาลูกค้า',
    steps: [
      { type: 'scenario', id: 'firstday', th: 'วันแรกที่ทำงาน' },
      { type: 'scenario', id: 'interview', th: 'สัมภาษณ์งาน' },
      { type: 'shadow', n: 8, th: 'พูดตาม 8 ประโยค' },
      { type: 'scenario', id: 'meeting', th: 'ประชุมทีม' },
      { type: 'scenario', id: 'support', th: 'โทรหาฝ่ายบริการลูกค้า' },
      { type: 'review', n: 15, th: 'ทบทวน 15 ข้อ' },
    ] },
  { id: 'ielts', icon: '🎓', th: 'IELTS Speaking & Writing เริ่มต้น', level: 'B1–C1', days: 10, englishOnly: true,
    desc: 'ฝึกครบทุก Part ของ Speaking และ Writing ทั้ง 2 Task (ได้ band โดยประมาณจากการฝึก)',
    steps: [
      { type: 'ielts', kind: 'speaking', part: 1, n: 2, th: 'Speaking Part 1 สองคำถาม' },
      { type: 'ielts', kind: 'speaking', part: 2, n: 1, th: 'Speaking Part 2 หนึ่งการ์ด' },
      { type: 'ielts', kind: 'speaking', part: 3, n: 1, th: 'Speaking Part 3 หนึ่งคำถาม' },
      { type: 'ielts', kind: 'listening', n: 2, th: 'Listening สองชุด' },
      { type: 'ielts', kind: 'writing', task: 1, n: 1, th: 'Writing Task 1 หนึ่งข้อ' },
      { type: 'ielts', kind: 'writing', task: 2, n: 1, th: 'Writing Task 2 หนึ่งเรียงความ' },
      { type: 'scenario', id: 'ielts', th: 'สอบพูดจำลองครบ 3 Part' },
    ] },
  { id: 'cadet', icon: '👮', th: 'ภาษาอังกฤษสำหรับนักเรียนนายร้อยตำรวจ', level: 'B1–B2', days: 7, englishOnly: true,
    desc: 'แจ้งความและเหตุฉุกเฉิน บทอ่านเรื่องงานตำรวจ พูดเรื่องอาชีพ และเขียนเรียงความแบบ IELTS',
    steps: [
      { type: 'scenario', id: 'police', th: 'รับแจ้งความ (คุยกับตำรวจ)' },
      { type: 'ielts', kind: 'reading', id: 'mission', n: 1, th: 'Reading: Working across languages' },
      { type: 'scenario', id: 'emergency', th: 'โทรแจ้งเหตุฉุกเฉิน' },
      { type: 'ielts', kind: 'speaking', part: 1, n: 2, th: 'Speaking Part 1 สองคำถาม' },
      { type: 'ielts', kind: 'reading', id: 'cameras', n: 1, th: 'Reading: Cameras or community officers?' },
      { type: 'ielts', kind: 'writing', task: 2, n: 1, th: 'Writing Task 2 หนึ่งเรียงความ' },
      { type: 'review', n: 10, th: 'ทบทวนคำที่เจอ 10 ข้อ' },
    ] },
];
export const courseById = (id) => COURSES.find((c) => c.id === id) || null;

// Evidence since the course started: { start, results, ielts, days }.
export function stepDone(step, { start = 0, results = [], ielts = [], days = {} } = {}, now = Date.now()) {
  if (step.type === 'scenario') return results.some((r) => r.id === step.id && r.t >= start);
  if (step.type === 'ielts') {
    const n = ielts.filter((a) => a.kind === step.kind && a.t >= start && (!step.part || a.part === step.part) && (!step.task || a.task === step.task) && (!step.id || a.id === step.id)).length;
    return n >= (step.n || 1);
  }
  const field = { shadow: 'shadow', listen: 'listen', review: 'reviews' }[step.type];
  if (!field) return false;
  // Day counters from the start day to today.
  const span = Math.max(1, Math.ceil((now - start) / 86400000) + 1);
  const keys = dayRange(now, Math.min(span, 400));
  const startKey = dayRange(start || now, 1)[0];
  const total = keys.filter((k) => k >= startKey).reduce((a, k) => a + (Number(days[k]?.[field]) || 0), 0);
  return total >= (step.n || 1);
}

// Steps are done in any order, but the next one to suggest is the first not done.
export function courseProgress(course, evidence, now = Date.now()) {
  const done = course.steps.map((s) => stepDone(s, evidence, now));
  const count = done.filter(Boolean).length;
  return { done, count, total: course.steps.length, next: done.indexOf(false), complete: count === course.steps.length };
}

// Stored as state.courses = { id: { start } }; unknown ids are dropped.
export function cleanCourses(c) {
  if (!c || typeof c !== 'object') return {};
  return Object.fromEntries(Object.entries(c).filter(([id, v]) => courseById(id) && v && Number(v.start) > 0).map(([id, v]) => [id, { start: Number(v.start) }]));
}
