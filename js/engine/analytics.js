// Learning analytics, pure (no browser). Every number says where it comes from and how much data
// it rests on; a rate with too few samples is reported as "not enough data" instead of a value.
//
// data: { days: { 'YYYY-MM-DD': {...counters} }, mistakes, vocab, results, labels }
// labels: optional { category id: Thai name } for the sentences shown to the learner.
// Day counters come from stats.js: msgs, checked, corrected, secs, reviews, reviewForgot,
// reviewsGraded, words, voice, hints, hintFull, helper, shadow, shadowWords, shadowHeard,
// listen, listenOk.

const DAY = 86400000;
export const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The n local day keys ending `offset` days before `now` (oldest first).
export function dayRange(now, n, offset = 0) {
  const out = [];
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset - (n - 1));
  for (let i = 0; i < n; i++) { out.push(dayKeyOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}
const keyStart = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

const FIELDS = ['msgs', 'checked', 'corrected', 'secs', 'reviews', 'reviewsGraded', 'reviewForgot', 'words', 'voice', 'hints', 'hintFull', 'helper', 'shadow', 'shadowWords', 'shadowHeard', 'listen', 'listenOk'];
export function sumDays(days, keys) {
  const t = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  t.activeDays = 0;
  for (const k of keys) {
    const d = days?.[k];
    if (!d) continue;
    for (const f of FIELDS) t[f] += Number(d[f]) || 0;
    if (d.msgs > 0 || d.reviews > 0 || d.shadow > 0 || d.listen > 0 || d.secs >= 120) t.activeDays += 1;
  }
  return t;
}
const inKeys = (t, keys) => keys.length && t >= keyStart(keys[0]) && t < keyStart(keys[keys.length - 1]) + DAY;

// How sure a rate is, from its sample size. Counts are exact and need no confidence label.
export function confidenceOf(n, minN) {
  if (n < minN) return 'none';
  if (n < minN * 3) return 'low';
  if (n < minN * 10) return 'medium';
  return 'high';
}
export const CONFIDENCE_TH = { none: 'ข้อมูลยังไม่พอ', low: 'ความมั่นใจต่ำ', medium: 'ความมั่นใจปานกลาง', high: 'ความมั่นใจสูง', exact: 'นับจริง' };

const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// The metric registry. kind "count": an exact tally. kind "rate": a share or average, shown only
// with at least minN samples. better: which direction is good (null = neither).
export const METRICS = [
  { id: 'time', th: 'เวลาเรียน', unit: 'นาที', kind: 'count', better: 'up',
    source: 'นับเฉพาะตอนที่ใช้แอปจริง (แตะหรือพิมพ์ภายใน 90 วินาที หรือกำลังฟังเสียง)',
    calc: (t) => ({ value: Math.round(t.secs / 60), n: t.secs }) },
  { id: 'activeDays', th: 'วันที่ได้เรียน', unit: 'วัน', kind: 'count', better: 'up',
    source: 'วันที่มีการคุย ทบทวน ฝึกเสียง หรือใช้แอป 2 นาทีขึ้นไป',
    calc: (t) => ({ value: t.activeDays, n: t.activeDays }) },
  { id: 'messages', th: 'ข้อความที่คุย', unit: 'ข้อความ', kind: 'count', better: 'up',
    source: 'ข้อความที่คุณส่งในแชต', calc: (t) => ({ value: t.msgs, n: t.msgs }) },
  { id: 'accuracy', th: 'ความแม่นยำไวยากรณ์', unit: '%', kind: 'rate', minN: 10, better: 'up',
    source: 'ข้อความยาว 3 คำขึ้นไปที่ AI ไม่ต้องแก้ (คำแนะนำแบบ "ทางเลือก" ไม่นับเป็นผิด) — ขึ้นกับความเข้มของการแก้ที่ตั้งไว้',
    calc: (t) => ({ value: pct(t.checked - t.corrected, t.checked), n: t.checked }) },
  { id: 'reviews', th: 'ทบทวน', unit: 'ข้อ', kind: 'count', better: 'up',
    source: 'การให้คะแนนการ์ดในหน้าทบทวน', calc: (t) => ({ value: t.reviews, n: t.reviews }) },
  { id: 'recall', th: 'จำได้ตอนทบทวน', unit: '%', kind: 'rate', minN: 10, better: 'up',
    source: 'สัดส่วนการ์ดที่ไม่ได้กด "ลืม" (เริ่มเก็บตั้งแต่อัปเดตนี้)',
    calc: (t) => ({ value: pct(t.reviewsGraded - t.reviewForgot, t.reviewsGraded), n: t.reviewsGraded }) },
  { id: 'words', th: 'คำศัพท์ใหม่', unit: 'คำ', kind: 'count', better: 'up',
    source: 'คำที่เข้าคลังคำ (จากแชตหรือเพิ่มเอง)', calc: (t) => ({ value: t.words, n: t.words }) },
  { id: 'hints', th: 'ตอบโดยใช้คำใบ้', unit: '%', kind: 'rate', minN: 10, better: 'down',
    source: 'ข้อความที่ส่งหลังเปิดคำใบ้หรือเลือกคำตอบแนะนำ (น้อยลง = ตอบเองได้มากขึ้น)',
    calc: (t) => ({ value: pct(t.hints, t.msgs), n: t.msgs }) },
  { id: 'shadow', th: 'พูดตาม', unit: 'ประโยค', kind: 'count', better: 'up',
    source: 'ประโยคที่พูดตามในหน้าฝึกเสียง', calc: (t) => ({ value: t.shadow, n: t.shadow }) },
  { id: 'heard', th: 'ระบบจับคำได้', unit: '%', kind: 'rate', minN: 20, better: 'up',
    source: 'ระบบฟังเสียงของเบราว์เซอร์จับคำที่คุณพูดตามได้ — ไม่ใช่คะแนนการออกเสียง',
    calc: (t) => ({ value: pct(t.shadowHeard, t.shadowWords), n: t.shadowWords }) },
  { id: 'listening', th: 'ฝึกฟังถูก', unit: '%', kind: 'rate', minN: 5, better: 'up',
    source: 'ข้อฝึกฟังที่ตอบถูกในการตรวจครั้งแรก', calc: (t) => ({ value: pct(t.listenOk, t.listen), n: t.listen }) },
  { id: 'scenarios', th: 'จบสถานการณ์', unit: 'ครั้ง', kind: 'count', better: 'up',
    source: 'สถานการณ์ที่กด "จบและขอคำแนะนำ"', calc: (t, r) => ({ value: r.length, n: r.length }) },
  { id: 'scenarioScore', th: 'คะแนนสถานการณ์เฉลี่ย', unit: '/10', kind: 'rate', minN: 2, better: 'up',
    source: 'คะแนนที่ AI ประเมินตอนจบสถานการณ์ (เป็นการประมาณ ไม่ใช่ผลสอบ)',
    calc: (t, r) => { const s = r.map((x) => x.score).filter((x) => x != null && Number.isFinite(Number(x))).map(Number); return { value: s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null, n: s.length }; } },
];

// Every metric for a set of days: value (null when there is not enough data), sample size and confidence.
export function computeMetrics(data, keys) {
  const t = sumDays(data.days, keys);
  const results = (data.results || []).filter((r) => inKeys(r.t, keys));
  return METRICS.map((m) => {
    const { value, n } = m.calc(t, results);
    const confidence = m.kind === 'count' ? 'exact' : confidenceOf(n, m.minN);
    return { id: m.id, th: m.th, unit: m.unit, kind: m.kind, better: m.better, source: m.source, n, confidence, value: confidence === 'none' ? null : value };
  });
}

// This week (the last 7 days including today) against the 7 days before.
export function weeklyReport(data, now = Date.now()) {
  const thisKeys = dayRange(now, 7), prevKeys = dayRange(now, 7, 7);
  const cur = computeMetrics(data, thisKeys), prev = computeMetrics(data, prevKeys);
  const metrics = cur.map((m, i) => {
    const p = prev[i];
    const delta = m.value != null && p.value != null ? Math.round((m.value - p.value) * 10) / 10 : null;
    const trend = delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    const good = trend == null || trend === 'same' || !m.better ? null : trend === m.better;
    return { ...m, prev: p.value, delta, trend, good };
  });
  // Mistake categories this week vs last week.
  const count = (keys) => {
    const c = {};
    for (const x of data.mistakes || []) if (inKeys(x.t, keys)) c[x.category] = (c[x.category] || 0) + 1;
    return c;
  };
  const cThis = count(thisKeys), cPrev = count(prevKeys);
  const categories = [...new Set([...Object.keys(cThis), ...Object.keys(cPrev)])].filter((c) => c !== 'other')
    .map((c) => ({ category: c, now: cThis[c] || 0, before: cPrev[c] || 0 })).sort((a, b) => b.now - a.now || b.before - a.before);
  return { from: thisKeys[0], to: thisKeys[6], metrics, categories, highlights: highlightsOf(metrics, categories, data.labels || {}) };
}

// A few plain-Thai sentences, each built only from metrics that have enough data.
function highlightsOf(metrics, categories, labels) {
  const lab = (c) => labels[c] || c;
  const by = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const out = [];
  const ad = by.activeDays;
  out.push(ad.value ? `สัปดาห์นี้เรียน ${ad.value} จาก 7 วัน${ad.prev != null && ad.delta ? ` (${ad.delta > 0 ? 'มากกว่า' : 'น้อยกว่า'}สัปดาห์ก่อน ${Math.abs(ad.delta)} วัน)` : ''}` : 'สัปดาห์นี้ยังไม่ได้เรียน — เริ่มวันนี้สัก 10 นาทีก็ดี');
  const rates = metrics.filter((m) => m.kind === 'rate' && m.good != null && m.delta);
  const best = rates.filter((m) => m.good).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const worst = rates.filter((m) => !m.good).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  if (best) out.push(`ดีขึ้น: ${best.th} ${best.prev}${best.unit} → ${best.value}${best.unit}`);
  if (worst) out.push(`ควรดู: ${worst.th} ${worst.prev}${worst.unit} → ${worst.value}${worst.unit}`);
  const improved = categories.find((c) => c.before >= 2 && c.now < c.before);
  if (improved) out.push(`พลาดเรื่อง ${lab(improved.category)} น้อยลง (${improved.before} → ${improved.now} ครั้ง)`);
  const top = categories.find((c) => c.now >= 2);
  if (top) out.push(`พลาดบ่อยสุดสัปดาห์นี้: ${lab(top.category)} (${top.now} ครั้ง)`);
  return out;
}

// ---------- weak spots and what to do next ----------
// Each signal: { id, th, evidence, priority (higher first), action }.
// action.type: practice {category} · review {focus?} · scenario {id} · voice {tab} · chat
export function weaknesses(data, now = Date.now()) {
  const out = [];
  const last14 = dayRange(now, 14), last7 = dayRange(now, 7), last3 = dayRange(now, 3);
  const t14 = sumDays(data.days, last14), t7 = sumDays(data.days, last7), t3 = sumDays(data.days, last3);

  // 1. A mistake type that keeps coming back.
  const cats = {};
  for (const m of data.mistakes || []) if (inKeys(m.t, last14) && m.category !== 'other' && m.type !== 'style') cats[m.category] = (cats[m.category] || 0) + 1;
  const [topCat, topN] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0] || [];
  if (topN >= 3) out.push({ id: 'category', th: `พลาดเรื่อง ${data.labels?.[topCat] || topCat} บ่อย`, evidence: `${topN} ครั้งใน 14 วัน (จากคำแก้ในแชต)`, priority: 50 + topN, action: { type: 'practice', category: topCat, label: data.labels?.[topCat] || topCat } });

  // 2. Cards that keep being forgotten.
  const hard = [...(data.mistakes || []), ...(data.vocab || [])].filter((c) => (c.srs?.lapses || 0) >= 2);
  if (hard.length >= 3) out.push({ id: 'lapses', th: 'มีคำ/ประโยคที่ลืมบ่อย', evidence: `${hard.length} ข้อถูกกด "ลืม" 2 ครั้งขึ้นไป`, priority: 45 + Math.min(10, hard.length), action: { type: 'review' } });

  // 3. Reviews piling up.
  const due = [...(data.mistakes || []), ...(data.vocab || [])].filter((c) => c.srs && c.srs.due <= now).length;
  if (due >= 10) out.push({ id: 'due', th: 'การ์ดรอทบทวนเยอะ', evidence: `${due} ข้อถึงเวลาทบทวนแล้ว`, priority: 40 + Math.min(15, Math.floor(due / 5)), action: { type: 'review' } });

  // 4. Leaning on hints.
  if (t14.msgs >= 10 && t14.hints / t14.msgs >= 0.5) out.push({ id: 'hints', th: 'ใช้คำใบ้บ่อย', evidence: `${pct(t14.hints, t14.msgs)}% ของข้อความใน 14 วันส่งหลังเปิดคำใบ้`, priority: 35, action: { type: 'voice', tab: 'shadow' }, tip: 'ลองพูดตามประโยคตัวอย่างให้คล่องก่อน แล้วลองตอบเองก่อนเปิดคำใบ้' });

  // 5. A scenario criterion that stays low.
  const crit = {};
  for (const r of (data.results || []).slice(-20)) for (const c of r.criteria || []) {
    const k = `${r.id}|${c.name}`;
    (crit[k] ||= { id: r.id, name: c.name, scene: r.scene, scores: [] }).scores.push(c.score);
  }
  const low = Object.values(crit).filter((c) => c.scores.length >= 2).map((c) => ({ ...c, avg: c.scores.reduce((a, b) => a + b, 0) / c.scores.length })).filter((c) => c.avg <= 2.5).sort((a, b) => a.avg - b.avg)[0];
  if (low) out.push({ id: 'criterion', th: `สถานการณ์ "${low.scene}": ${low.name} ยังต่ำ`, evidence: `เฉลี่ย ${low.avg.toFixed(1)}/5 จาก ${low.scores.length} ครั้ง (AI ประเมิน)`, priority: 38, action: { type: 'scenario', id: low.id } });

  // 6. Listening and speaking.
  if (t14.listen >= 5 && t14.listenOk / t14.listen < 0.6) out.push({ id: 'listening', th: 'ฝึกฟังยังถูกน้อย', evidence: `ถูก ${pct(t14.listenOk, t14.listen)}% จาก ${t14.listen} ข้อใน 14 วัน`, priority: 33, action: { type: 'voice', tab: 'listen' }, tip: 'ใช้ปุ่ม "ฟังช้า" ก่อน แล้วค่อยฟังความเร็วปกติ' });
  if (t14.shadowWords >= 30 && t14.shadowHeard / t14.shadowWords < 0.7) out.push({ id: 'heard', th: 'ระบบจับคำที่พูดตามได้น้อย', evidence: `จับได้ ${pct(t14.shadowHeard, t14.shadowWords)}% จาก ${t14.shadowWords} คำ (ไม่ใช่คะแนนการออกเสียง)`, priority: 30, action: { type: 'voice', tab: 'shadow' }, tip: 'ฝึกทีละท่อน พูดช้าๆ ชัดๆ ใกล้ไมค์' });
  if ((t7.msgs || t7.reviews) && !t7.shadow && !t7.listen) out.push({ id: 'noVoice', th: 'ยังไม่ได้ฝึกพูด/ฟังสัปดาห์นี้', evidence: 'ไม่มีการฝึกในหน้าฝึกเสียง 7 วันที่ผ่านมา', priority: 25, action: { type: 'voice', tab: 'shadow' } });

  // 7. Not chatting lately.
  if (!t3.msgs) out.push({ id: 'noChat', th: 'ไม่ได้คุยมา 3 วัน', evidence: 'ไม่มีข้อความในแชต 3 วันที่ผ่านมา', priority: 20, action: { type: 'chat' } });

  return out.sort((a, b) => b.priority - a.priority);
}

// The next activities to suggest: the strongest signals, one per action type.
export function recommendations(data, now = Date.now(), limit = 3) {
  const seen = new Set(), out = [];
  for (const w of weaknesses(data, now)) {
    const key = w.action.type + (w.action.tab || w.action.id || w.action.category || '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

// One line per day for the learning history (newest first), only days with something done.
export function history(data, now = Date.now(), n = 30) {
  return dayRange(now, n).reverse().map((k) => {
    const d = data.days?.[k] || {};
    const results = (data.results || []).filter((r) => inKeys(r.t, [k]));
    return { key: k, mins: Math.round((d.secs || 0) / 60), msgs: d.msgs || 0, reviews: d.reviews || 0, words: d.words || 0, shadow: d.shadow || 0, listen: d.listen || 0, scenarios: results.length };
  }).filter((r) => r.mins || r.msgs || r.reviews || r.words || r.shadow || r.listen || r.scenarios);
}
