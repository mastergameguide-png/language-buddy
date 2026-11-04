// Role-play scenarios as data. The prompt turns these into guidance for a flexible conversation
// (stages to move through, not a script), so the character can react to anything the learner says.
// aiRoles: roles the character may take, best match first (see ROLES in characters.js).
// cast: characters that fit best (shown first when choosing who to practise with).

const IELTS_FEEDBACK = 'Start by saying clearly (in Thai) that this is a practice estimate from typed answers, not an official IELTS score. As an IELTS examiner, estimate the user\'s band for each criterion — Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy (pronunciation cannot be judged from text, say so) — and an overall band, based only on what they wrote. Then give 3 specific ways to reach the next half band, each with a better version of one of their own sentences. For "score", use the overall band scaled to 0–10 (band 9 = 10).';

export const SCENARIO_GROUPS = [
  { id: 'daily', th: 'ชีวิตประจำวัน' },
  { id: 'travel', th: 'เดินทาง' },
  { id: 'work', th: 'งานและการเรียน' },
  { id: 'safety', th: 'สุขภาพและฉุกเฉิน' },
  { id: 'exam', th: 'สอบ', englishOnly: true },
];

export const SCENARIOS = [
  {
    id: 'daily', group: 'daily', icon: '☀️', th: 'คุยเรื่องทั่วไป', sub: 'งาน งานอดิเรก แผนวันหยุด',
    environment: 'A relaxed chat on a weekday evening.', aiRoles: ['friend', 'new_friend', 'colleague'], userRole: 'themselves',
    objectives: ['Talk about your day and plans', 'Ask the other person at least two questions', 'Use past and future forms'],
    difficulty: 'A2', vocab: ['plans', 'hang out', 'busy', 'weekend', 'actually', 'by the way'],
    flow: ['casual opener', 'what happened today', 'plans for the weekend', 'a shared interest', 'friendly wrap-up'],
    completion: 'The learner has shared a few things about their day and plans, and asked questions back.',
    criteria: ['range of everyday vocabulary', 'asking follow-up questions', 'tense accuracy'], cast: ['emma', 'sofia', 'buddy'],
  },
  {
    id: 'cafe', group: 'daily', icon: '☕', th: 'สั่งเครื่องดื่ม/อาหารที่คาเฟ่', sub: 'ขนาด นมทางเลือก กลับบ้าน',
    environment: 'A busy café counter in the morning.', aiRoles: ['barista', 'restaurant_staff'], userRole: 'customer',
    objectives: ['Order a drink and a snack', 'Customise it (size, milk, sugar)', 'Pay and answer "for here or to go?"'],
    difficulty: 'A2', vocab: ['for here or to go', 'oat milk', 'decaf', 'large', 'that\'s all', 'receipt'],
    flow: ['greeting and order', 'options and questions', 'extra item suggestion', 'payment', 'name for the cup / goodbye'],
    completion: 'The order is complete and paid.',
    criteria: ['polite requests (Could I / I\'d like)', 'clear numbers and sizes', 'handling questions'], cast: ['sofia', 'emma'],
  },
  {
    id: 'restaurant', group: 'daily', icon: '🍜', th: 'ร้านอาหาร', sub: 'เมนู แพ้อาหาร เช็กบิล',
    environment: 'A sit-down restaurant at dinner time.', aiRoles: ['restaurant_staff', 'waiter'], userRole: 'customer',
    objectives: ['Ask about the menu', 'Mention an allergy or preference', 'Order a full meal', 'Ask for the bill'],
    difficulty: 'B1', vocab: ['recommend', 'allergic to', 'medium-rare', 'side dish', 'split the bill', 'tip'],
    flow: ['seating and drinks', 'menu questions', 'ordering with a special request', 'a small problem with the dish', 'bill and payment'],
    completion: 'The meal is ordered, any problem is solved and the bill is paid.',
    criteria: ['polite requests', 'explaining preferences', 'handling a problem calmly'], cast: ['sofia', 'emma'],
  },
  {
    id: 'shopping', group: 'daily', icon: '🛍️', th: 'ซื้อของ ต่อราคา', sub: 'ไซซ์ สี ราคา คืนของ',
    environment: 'A clothing shop or market stall.', aiRoles: ['shopping_assistant'], userRole: 'shopper',
    objectives: ['Find an item in your size and colour', 'Ask about price or a discount', 'Exchange or return something'],
    difficulty: 'A2', vocab: ['try on', 'fitting room', 'a size up', 'on sale', 'refund', 'exchange'],
    flow: ['greeting and what you need', 'sizes and colours', 'trying on', 'price and discount', 'paying or returning'],
    completion: 'The learner buys, exchanges or politely declines an item.',
    criteria: ['describing items', 'comparatives', 'polite negotiation'], cast: ['sofia', 'emma'],
  },
  {
    id: 'phone', group: 'daily', icon: '📞', th: 'โทรจองโต๊ะ', sub: 'วัน เวลา จำนวนคน',
    environment: 'A phone call to a popular restaurant.', aiRoles: ['restaurant_staff', 'waiter'], userRole: 'caller',
    objectives: ['Book a table for a date and time', 'Spell your name', 'Make a special request'],
    difficulty: 'A2', vocab: ['book a table', 'party of four', 'fully booked', 'under the name', 'window seat'],
    flow: ['answering the phone', 'date, time and number of people', 'the time is full, offer another', 'name and phone number', 'confirmation'],
    completion: 'A booking is confirmed.',
    criteria: ['dates and times', 'spelling', 'clarifying'], cast: ['sofia'],
  },
  {
    id: 'party', group: 'daily', icon: '🎉', th: 'เจอเพื่อนใหม่', sub: 'Small talk ในงานปาร์ตี้',
    environment: 'A friend\'s birthday party; you know almost nobody.', aiRoles: ['new_friend', 'friend'], userRole: 'party guest',
    objectives: ['Introduce yourself', 'Find something in common', 'Suggest meeting again'],
    difficulty: 'A2', vocab: ['how do you know…', 'what do you do', 'into (music)', 'grab a coffee', 'keep in touch'],
    flow: ['introductions', 'how you know the host', 'work or study', 'hobbies in common', 'swap contacts / plan to meet'],
    completion: 'The learner has introduced themselves and suggested meeting again.',
    criteria: ['small-talk questions', 'keeping the conversation going', 'natural reactions'], cast: ['sofia', 'emma'],
  },
  {
    id: 'airport', group: 'travel', icon: '✈️', th: 'สนามบินและ ตม.', sub: 'เช็กอิน ตม. กระเป๋าหาย',
    environment: 'An international airport: check-in desk and passport control.', aiRoles: ['airport_staff', 'officer'], userRole: 'passenger',
    objectives: ['Check in and choose a seat', 'Answer immigration questions', 'Report a problem (delay or lost bag)'],
    difficulty: 'B1', vocab: ['boarding pass', 'aisle seat', 'carry-on', 'purpose of your visit', 'connecting flight', 'baggage claim'],
    flow: ['check-in and passport', 'bags and seat', 'immigration questions', 'an unexpected delay or problem', 'next steps'],
    completion: 'The learner is checked in and through immigration, and the problem has a solution.',
    criteria: ['answering formal questions clearly', 'travel vocabulary', 'asking for help'], cast: ['mika', 'alex'],
  },
  {
    id: 'hotel', group: 'travel', icon: '🏨', th: 'เช็กอินโรงแรม', sub: 'จองห้อง ปัญหาในห้อง',
    environment: 'A hotel front desk in the evening.', aiRoles: ['hotel_receptionist'], userRole: 'guest',
    objectives: ['Check in with your booking', 'Ask about breakfast and Wi-Fi', 'Report a problem with the room'],
    difficulty: 'A2', vocab: ['reservation', 'check-out time', 'key card', 'the air conditioning isn\'t working', 'late check-out'],
    flow: ['greeting and booking name', 'ID and payment', 'hotel information', 'a room problem', 'solution and goodbye'],
    completion: 'The guest is checked in and the room problem is handled.',
    criteria: ['polite requests', 'describing a problem', 'understanding information'], cast: ['mika'],
  },
  {
    id: 'abroad', group: 'travel', icon: '🗺️', th: 'เที่ยวต่างประเทศ ถามทาง', sub: 'ทิศทาง ที่เที่ยว เคล็ดลับท้องถิ่น',
    environment: 'A street in a foreign city; you are a tourist.', aiRoles: ['travel_companion', 'tourist', 'local'], userRole: 'traveller',
    objectives: ['Ask for directions to a place', 'Ask for a local recommendation', 'Check you understood'],
    difficulty: 'A2', vocab: ['how do I get to', 'turn left', 'straight ahead', 'about ten minutes\' walk', 'must-see', 'local tip'],
    flow: ['asking for help politely', 'directions with landmarks', 'checking understanding', 'a recommendation', 'thanks and goodbye'],
    completion: 'The learner knows how to get there and got a tip.',
    criteria: ['direction language', 'clarifying questions', 'politeness'], cast: ['mika', 'emma'],
  },
  {
    id: 'transport', group: 'travel', icon: '🚆', th: 'ซื้อตั๋วรถไฟ/รถบัส', sub: 'เที่ยว เวลา เปลี่ยนสาย',
    environment: 'A train station ticket office.', aiRoles: ['clerk', 'airport_staff'], userRole: 'traveller',
    objectives: ['Buy the right ticket', 'Ask about times and platforms', 'Handle a delay'],
    difficulty: 'A2', vocab: ['one-way', 'return ticket', 'platform', 'change trains', 'delayed', 'next departure'],
    flow: ['destination', 'ticket type and time', 'platform and changes', 'a delay announcement', 'alternatives'],
    completion: 'The learner has a ticket and knows where to go.',
    criteria: ['numbers and times', 'asking for clarification'], cast: ['mika'],
  },
  {
    id: 'interview', group: 'work', icon: '💼', th: 'สัมภาษณ์งาน', sub: 'แนะนำตัว จุดแข็ง',
    environment: 'A job interview for a position the learner would like.', aiRoles: ['interviewer'], userRole: 'candidate',
    objectives: ['Introduce yourself professionally', 'Talk about strengths with an example', 'Answer a behavioural question', 'Ask the interviewer a question'],
    difficulty: 'B1', vocab: ['background in', 'responsible for', 'team player', 'deadline', 'I\'m keen to', 'career goals'],
    flow: ['welcome and small talk', 'tell me about yourself', 'strengths and weaknesses', 'a difficult situation (STAR)', 'why this job', 'candidate questions and close'],
    completion: 'All main questions are answered and the learner asked a question back.',
    criteria: ['clear structure', 'professional vocabulary', 'concrete examples', 'tense accuracy'], cast: ['james', 'emma'],
  },
  {
    id: 'meeting', group: 'work', icon: '📊', th: 'ประชุมธุรกิจ', sub: 'อัปเดตงาน เสนอไอเดีย',
    environment: 'A short team meeting about a project.', aiRoles: ['manager', 'business_partner', 'colleague'], userRole: 'team member',
    objectives: ['Give a project update', 'Explain a problem', 'Propose a solution and agree next steps'],
    difficulty: 'B2', vocab: ['on track', 'behind schedule', 'stakeholder', 'follow up', 'action item', 'by end of week'],
    flow: ['opening', 'status update', 'a problem or risk', 'options and opinions', 'agree action items'],
    completion: 'Next steps and owners are agreed.',
    criteria: ['clarity', 'business collocations', 'agreeing and disagreeing politely'], cast: ['james'],
  },
  {
    id: 'vet', group: 'work', icon: '🐾', th: 'คลินิกสัตว์ (คุณเป็นหมอ)', sub: 'ซักประวัติ อธิบายการรักษา',
    environment: 'A veterinary clinic. The learner is the vet.', aiRoles: ['pet_owner'], userRole: 'veterinarian',
    objectives: ['Ask about symptoms', 'Explain the diagnosis simply', 'Give care instructions'],
    difficulty: 'B1', vocab: ['symptoms', 'appetite', 'vaccinated', 'prescribe', 'twice a day', 'follow-up visit'],
    flow: ['greeting the owner', 'history and symptoms', 'examination questions', 'diagnosis', 'treatment and care plan'],
    completion: 'The owner understands the treatment plan.',
    criteria: ['question forms', 'explaining simply', 'reassuring language'], cast: ['emma', 'sofia'],
  },
  {
    id: 'doctor', group: 'safety', icon: '🏥', th: 'ไปหาหมอ', sub: 'อาการ วิธีกินยา',
    environment: 'A clinic appointment.', aiRoles: ['doctor'], userRole: 'patient',
    objectives: ['Describe symptoms and how long', 'Answer the doctor\'s questions', 'Understand how to take medicine'],
    difficulty: 'A2', vocab: ['sore throat', 'fever', 'since yesterday', 'allergic', 'prescription', 'after meals'],
    flow: ['what brings you in', 'symptoms and duration', 'questions and check', 'advice', 'medicine instructions'],
    completion: 'The learner understands the advice and medicine.',
    criteria: ['describing symptoms', 'time expressions', 'checking understanding'], cast: ['david', 'alex'],
  },
  {
    id: 'emergency', group: 'safety', icon: '🚨', th: 'เหตุฉุกเฉิน', sub: 'ขอความช่วยเหลือ บอกตำแหน่ง',
    environment: 'An emergency phone call (fire, accident or medical).', aiRoles: ['police_officer', 'police_instructor'], userRole: 'caller',
    objectives: ['Say what happened clearly', 'Give the exact location', 'Answer questions calmly and follow instructions'],
    difficulty: 'B1', vocab: ['there\'s been an accident', 'injured', 'conscious', 'breathing', 'the address is', 'stay on the line'],
    flow: ['what is your emergency', 'location', 'details about people involved', 'instructions', 'help is on the way'],
    completion: 'The dispatcher has the location and key details, and the learner repeated the instructions.',
    criteria: ['clear short sentences', 'location details', 'staying calm and precise'], cast: ['alex'],
  },
  {
    id: 'police', group: 'safety', icon: '👮', th: 'แจ้งความกับตำรวจ', sub: 'พาสปอร์ตหาย บรรยายเหตุการณ์',
    environment: 'A tourist police desk. The learner lost a passport and wallet, or witnessed a theft.', aiRoles: ['police_officer', 'police_instructor', 'witness'], userRole: 'person reporting',
    objectives: ['Explain what happened, where and when', 'Describe a person or item', 'Understand the next steps (report, embassy)'],
    difficulty: 'B1', vocab: ['I\'d like to report', 'stolen', 'around 3 p.m.', 'he was wearing', 'police report', 'embassy'],
    flow: ['how can I help', 'what happened', 'when and where', 'descriptions', 'personal details', 'next steps'],
    completion: 'A report is made and the learner knows what to do next.',
    criteria: ['past narrative', 'describing people and things', 'formal politeness'], cast: ['alex'],
  },
  {
    id: 'ielts', group: 'exam', icon: '🎓', th: 'สอบพูด IELTS', sub: 'Part 1–3 · ประมาณ band จากการฝึก', englishOnly: true, feedback: IELTS_FEEDBACK,
    environment: 'An IELTS Speaking test room.', aiRoles: ['speaking_examiner'], userRole: 'candidate',
    objectives: ['Answer Part 1 questions with some detail', 'Speak for 1–2 minutes on the Part 2 card', 'Discuss Part 3 questions with reasons and examples'],
    difficulty: 'B2', vocab: ['I\'d say', 'on the other hand', 'it depends on', 'for instance', 'in my experience'],
    flow: ['Part 1: 4–5 short familiar questions', 'Part 2: cue card, 1–2 minute talk, one follow-up', 'Part 3: 3–4 deeper discussion questions', 'close the test'],
    completion: 'All three parts are done.',
    criteria: ['Fluency and Coherence', 'Lexical Resource', 'Grammatical Range and Accuracy'], cast: ['david'],
  },
];

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || null;

// IELTS results are practice estimates from typed text, never official scores.
export const IELTS_NOTE_TH = 'ประมาณการจากการฝึกด้วยการพิมพ์ ไม่ใช่คะแนนสอบ IELTS จริง (การออกเสียงยังไม่ได้ประเมิน)';
const isIelts = (r) => r && (r.id === 'ielts' || r.scene === 'สอบพูด IELTS');
// The model reports IELTS as the overall band scaled to 0–10 (band 9 = 10); turn it back into a band.
export const bandFromScore = (score) => Math.max(0, Math.min(9, Math.round(((Number(score) * 9) / 10) * 2) / 2));
// Short label for a role-play result: "7/10" or "≈ band 6.5 (ประมาณการ)".
export function scoreLabel(r) {
  if (!r || r.score == null || !Number.isFinite(Number(r.score))) return null;
  return isIelts(r) ? `≈ band ${bandFromScore(r.score).toFixed(1)} (ประมาณการ)` : `${r.score}/10`;
}
export const resultNote = (r) => (isIelts(r) ? IELTS_NOTE_TH : '');

// Text for the model: guidance, not a script.
export function scenarioBrief(sc, roleLabel) {
  return [
    `Scenario: ${sc.th} — ${sc.environment}`,
    `You play: ${roleLabel}. The learner plays: ${sc.userRole}.`,
    `Learner objectives: ${sc.objectives.join('; ')}.`,
    `Useful language to draw out (do not list it, create chances to use it): ${sc.vocab.join(', ')}.`,
    `Rough stages (adapt freely, skip or reorder if the learner takes it elsewhere): ${sc.flow.join(' → ')}.`,
    `It is complete when: ${sc.completion} Then tell the learner they can tap "จบและขอคำแนะนำ".`,
    `Difficulty around ${sc.difficulty}, adjusted to the learner's level.`,
  ].join('\n');
}

export function validateScenario(s) {
  const errs = [];
  for (const k of ['id', 'group', 'icon', 'th', 'environment', 'aiRoles', 'userRole', 'objectives', 'difficulty', 'vocab', 'flow', 'completion', 'criteria', 'cast']) {
    if (s[k] == null || (Array.isArray(s[k]) && !s[k].length)) errs.push(`missing ${k}`);
  }
  if (!SCENARIO_GROUPS.some((g) => g.id === s.group)) errs.push('unknown group');
  return errs;
}
