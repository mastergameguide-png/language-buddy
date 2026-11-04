// A 7-day study plan built from the learner's daily goals and weak spots. Pure (no browser).
// Tasks are measurable: progress comes from the day's real counters, so a task is "done" only
// when the learner actually did it. The learner can change targets, remove and add tasks.
import { dayRange } from './analytics.js';

export const TASK_KINDS = {
  chat: { th: 'คุยในแชต', unit: 'ข้อความ', icon: '💬', step: 5, max: 100, href: '#chat' },
  review: { th: 'ทบทวน', unit: 'ข้อ', icon: '🧠', step: 5, max: 100, href: '#review' },
  shadow: { th: 'พูดตาม', unit: 'ประโยค', icon: '🎙️', step: 1, max: 50, href: '#voice' },
  listen: { th: 'ฝึกฟัง', unit: 'ข้อ', icon: '👂', step: 1, max: 50, href: '#voice' },
  scenario: { th: 'เล่นสถานการณ์', unit: 'ครั้ง', icon: '🎭', step: 1, max: 5, href: '#roleplay' },
  words: { th: 'เก็บคำใหม่', unit: 'คำ', icon: '📘', step: 1, max: 30, href: '#review' },
  time: { th: 'เวลาเรียน', unit: 'นาที', icon: '⏱️', step: 5, max: 240, href: '#home' },
};
export const MAX_TASKS = 5;

// How much of a task is done on its day. dayRec: state.days[key]; scenariosThatDay: results count.
export function taskProgress(task, dayRec = {}, scenariosThatDay = 0) {
  const field = { chat: 'msgs', review: 'reviews', shadow: 'shadow', listen: 'listen', words: 'words' }[task.kind];
  const done = task.kind === 'scenario' ? scenariosThatDay : task.kind === 'time' ? Math.floor((dayRec.secs || 0) / 60) : Number(dayRec[field]) || 0;
  return { done, target: task.target, complete: done >= task.target };
}

let seq = 0;
const tid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

// goals: { minutes, messages, reviews }. focus: action types from analytics.weaknesses, strongest
// first (e.g. ['voice:listen', 'scenario', 'review']). Every day gets chat + review, then one
// practice task that rotates through the focus areas (or a default mix).
export function makePlan({ goals = {}, focus = [], startKey, now = Date.now() } = {}) {
  const keys = startKey ? dayRange(new Date(keyTime(startKey) + 6 * 86400000), 7) : dayRange(now, 7, -6);
  const mix = [...new Set([...focus.map(focusKind).filter(Boolean), 'shadow', 'scenario', 'listen', 'words'])];
  return {
    start: keys[0], made: now,
    days: keys.map((key, i) => ({
      key,
      tasks: [
        { id: tid(), kind: 'chat', target: clampTarget('chat', goals.messages || 10) },
        { id: tid(), kind: 'review', target: clampTarget('review', goals.reviews || 10) },
        { id: tid(), kind: mix[i % mix.length], target: defaultTarget(mix[i % mix.length]) },
      ],
    })),
  };
}
const keyTime = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
function focusKind(a) {
  if (a === 'voice:listen' || a === 'listen') return 'listen';
  if (a === 'voice:shadow' || a === 'voice' || a === 'shadow') return 'shadow';
  if (a === 'scenario') return 'scenario';
  if (a === 'review' || a === 'practice' || a === 'chat') return null;   // already in every day
  return null;
}
const defaultTarget = (kind) => ({ shadow: 5, listen: 5, scenario: 1, words: 3, time: 15, chat: 10, review: 10 }[kind] || 1);
function clampTarget(kind, n) {
  const k = TASK_KINDS[kind];
  const v = n == null || n === '' || !Number.isFinite(Number(n)) ? defaultTarget(kind) : Number(n);   // 0 is a number, not "missing"
  return Math.max(1, Math.min(k.max, Math.round(v)));
}

// ---------- editing (each returns a new plan) ----------
const mapDay = (plan, key, fn) => ({ ...plan, days: plan.days.map((d) => (d.key === key ? fn(d) : d)) });
export function changeTarget(plan, key, id, dir) {
  return mapDay(plan, key, (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, target: clampTarget(t.kind, t.target + dir * TASK_KINDS[t.kind].step) } : t)) }));
}
export function removeTask(plan, key, id) {
  return mapDay(plan, key, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
}
export function addTask(plan, key, kind) {
  if (!TASK_KINDS[kind]) return plan;
  return mapDay(plan, key, (d) => (d.tasks.length >= MAX_TASKS || d.tasks.some((t) => t.kind === kind) ? d : { ...d, tasks: [...d.tasks, { id: tid(), kind, target: defaultTarget(kind) }] }));
}

// The plan is "current" while today is inside its 7 days.
export const planCovers = (plan, key) => !!plan && plan.days?.some((d) => d.key === key);

// Validates a stored or synced plan; anything broken becomes null (the app then offers a new one).
export function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.days)) return null;
  const days = p.days.slice(0, 7).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.key) && Array.isArray(d.tasks)).map((d) => ({
    key: d.key,
    tasks: d.tasks.filter((t) => t && TASK_KINDS[t.kind]).slice(0, MAX_TASKS)
      .map((t) => ({ id: String(t.id || tid()).slice(0, 20), kind: t.kind, target: clampTarget(t.kind, t.target) })),
  }));
  return days.length ? { start: days[0].key, made: Number(p.made) || 0, days } : null;
}
