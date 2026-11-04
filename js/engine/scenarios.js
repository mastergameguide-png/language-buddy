// Role-play scenarios as data (schema v2). The prompt turns these into guidance for a flexible
// conversation (stages to move through, not a script), so the character can react to anything.
//
// Each scenario: id, category, icon, th (title), title_en, sub (short Thai description),
// environment (English description), cefr [min, max], difficulty (typical level), aiRoles (best
// match first, see ROLES in characters.js), userRole, objectives, vocab (words), expressions
// (whole useful phrases), flow (English stages) + flowTh (the same stages in Thai, for the progress
// bar), completion, criteria, cast (characters that fit best), optional feedback/englishOnly.
// Steps are derived from flow as s1, s2, ... so the model can report where the scene is.
// v1 fields (group, flow, vocab, difficulty) are still valid; see upgradeScenario.

const IELTS_FEEDBACK = 'Start by saying clearly (in Thai) that this is a practice estimate from typed answers, not an official IELTS score. As an IELTS examiner, estimate the user\'s band for each criterion — Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy (pronunciation cannot be judged from text, say so) — and an overall band, based only on what they wrote. Then give 3 specific ways to reach the next half band, each with a better version of one of their own sentences. For "score", use the overall band scaled to 0–10 (band 9 = 10).';

export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SCENARIO_CATEGORIES = [
  { id: 'everyday', th: 'ชีวิตประจำวัน', icon: '☀️' },
  { id: 'food', th: 'อาหารและร้านอาหาร', icon: '🍽️' },
  { id: 'shopping', th: 'ช้อปปิ้งและบริการ', icon: '🛍️' },
  { id: 'travel', th: 'การเดินทาง', icon: '🧳' },
  { id: 'immigration', th: 'สนามบินและ ตม.', icon: '🛂' },
  { id: 'social', th: 'เข้าสังคม', icon: '🎉' },
  { id: 'relationships', th: 'ความสัมพันธ์', icon: '💛' },
  { id: 'education', th: 'การเรียน', icon: '🏫' },
  { id: 'workplace', th: 'ที่ทำงาน', icon: '🧑‍💻' },
  { id: 'professional', th: 'งานมืออาชีพ', icon: '💼' },
  { id: 'healthcare', th: 'สุขภาพ', icon: '🩺' },
  { id: 'emergency', th: 'เหตุฉุกเฉิน', icon: '🚨' },
  { id: 'ielts', th: 'IELTS', icon: '🎓', englishOnly: true },
];
// Older code and saved data used these five groups.
const GROUP_TO_CATEGORY = { daily: 'everyday', travel: 'travel', work: 'workplace', safety: 'healthcare', exam: 'ielts' };
export const SCENARIO_GROUPS = SCENARIO_CATEGORIES;

// How hard the other person makes it. Chosen by the learner before starting.
export const VARIANTS = {
  easy: { th: 'ง่าย', prompt: 'Difficulty EASY: be patient and cooperative, speak a little simpler and slower than the learner\'s level, give a gentle prompt when they seem stuck, and leave out the planned complication.' },
  normal: { th: 'ปกติ', prompt: 'Difficulty NORMAL: a realistic pace, including the planned small problem.' },
  hard: { th: 'ยาก', prompt: 'Difficulty HARD: natural native pace, a busier or less cooperative person, one extra unexpected complication, and expect fuller answers.' },
};

const RAW = [
  {
    id: 'daily', category: 'everyday', icon: '☀️', th: 'คุยเรื่องทั่วไป', title_en: 'Everyday chat', sub: 'งาน งานอดิเรก แผนวันหยุด',
    environment: 'A relaxed chat on a weekday evening.', aiRoles: ['friend', 'new_friend', 'colleague'], userRole: 'themselves',
    objectives: ['Talk about your day and plans', 'Ask the other person at least two questions', 'Use past and future forms'],
    cefr: ['A1', 'B2'], difficulty: 'A2', vocab: ['plans', 'hang out', 'busy', 'weekend', 'actually', 'by the way'],
    expressions: ['How was your day?', 'Not much, just…', 'I\'m planning to…', 'What about you?'],
    flow: ['casual opener', 'what happened today', 'plans for the weekend', 'a shared interest', 'friendly wrap-up'],
    flowTh: ['ทักทาย', 'เล่าเรื่องวันนี้', 'แผนวันหยุด', 'เรื่องที่ชอบเหมือนกัน', 'ลาแบบเป็นกันเอง'],
    completion: 'The learner has shared a few things about their day and plans, and asked questions back.',
    criteria: ['range of everyday vocabulary', 'asking follow-up questions', 'tense accuracy'], cast: ['emma', 'sofia', 'buddy'],
  },
  {
    id: 'cafe', category: 'food', icon: '☕', th: 'สั่งเครื่องดื่ม/อาหารที่คาเฟ่', title_en: 'Ordering at a café', sub: 'ขนาด นมทางเลือก กลับบ้าน',
    environment: 'A busy café counter in the morning.', aiRoles: ['barista', 'restaurant_staff'], userRole: 'customer',
    objectives: ['Order a drink and a snack', 'Customise it (size, milk, sugar)', 'Pay and answer "for here or to go?"'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['for here or to go', 'oat milk', 'decaf', 'large', 'that\'s all', 'receipt'],
    expressions: ['Could I get a…, please?', 'Can I have it with…?', 'To go, please.', 'That\'s all, thanks.'],
    flow: ['greeting and order', 'options and questions', 'extra item suggestion', 'payment', 'name for the cup / goodbye'],
    flowTh: ['ทักทายและสั่ง', 'เลือกขนาด/นม', 'พนักงานชวนซื้อเพิ่ม', 'จ่ายเงิน', 'บอกชื่อและลา'],
    completion: 'The order is complete and paid.',
    criteria: ['polite requests (Could I / I\'d like)', 'clear numbers and sizes', 'handling questions'], cast: ['sofia', 'emma'],
  },
  {
    id: 'restaurant', category: 'food', icon: '🍜', th: 'ร้านอาหาร', title_en: 'At a restaurant', sub: 'เมนู แพ้อาหาร เช็กบิล',
    environment: 'A sit-down restaurant at dinner time.', aiRoles: ['restaurant_staff', 'waiter'], userRole: 'customer',
    objectives: ['Ask about the menu', 'Mention an allergy or preference', 'Order a full meal', 'Ask for the bill'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['recommend', 'allergic to', 'medium-rare', 'side dish', 'split the bill', 'tip'],
    expressions: ['What would you recommend?', 'I\'m allergic to…', 'Excuse me, this isn\'t what I ordered.', 'Could we have the bill, please?'],
    flow: ['seating and drinks', 'menu questions', 'ordering with a special request', 'a small problem with the dish', 'bill and payment'],
    flowTh: ['รับโต๊ะและเครื่องดื่ม', 'ถามเรื่องเมนู', 'สั่งพร้อมคำขอพิเศษ', 'อาหารมีปัญหา', 'เช็กบิล'],
    completion: 'The meal is ordered, any problem is solved and the bill is paid.',
    criteria: ['polite requests', 'explaining preferences', 'handling a problem calmly'], cast: ['sofia', 'emma'],
  },
  {
    id: 'phone', category: 'food', icon: '📞', th: 'โทรจองโต๊ะ', title_en: 'Booking a table by phone', sub: 'วัน เวลา จำนวนคน',
    environment: 'A phone call to a popular restaurant.', aiRoles: ['restaurant_staff', 'waiter'], userRole: 'caller',
    objectives: ['Book a table for a date and time', 'Spell your name', 'Make a special request'],
    cefr: ['A2', 'B1'], difficulty: 'A2', vocab: ['book a table', 'party of four', 'fully booked', 'under the name', 'window seat'],
    expressions: ['I\'d like to book a table for…', 'Is 7 o\'clock available?', 'It\'s under the name…', 'Could we sit by the window?'],
    flow: ['answering the phone', 'date, time and number of people', 'the time is full, offer another', 'name and phone number', 'confirmation'],
    flowTh: ['รับสาย', 'วัน เวลา จำนวนคน', 'เวลาเต็ม เสนอเวลาอื่น', 'ชื่อและเบอร์โทร', 'ยืนยันการจอง'],
    completion: 'A booking is confirmed.',
    criteria: ['dates and times', 'spelling', 'clarifying'], cast: ['sofia'],
  },
  {
    id: 'shopping', category: 'shopping', icon: '🛍️', th: 'ซื้อของ ต่อราคา', title_en: 'Shopping for clothes', sub: 'ไซซ์ สี ราคา คืนของ',
    environment: 'A clothing shop or market stall.', aiRoles: ['shopping_assistant'], userRole: 'shopper',
    objectives: ['Find an item in your size and colour', 'Ask about price or a discount', 'Exchange or return something'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['try on', 'fitting room', 'a size up', 'on sale', 'refund', 'exchange'],
    expressions: ['Do you have this in a medium?', 'Can I try it on?', 'Is there any discount?', 'I\'d like to exchange this.'],
    flow: ['greeting and what you need', 'sizes and colours', 'trying on', 'price and discount', 'paying or returning'],
    flowTh: ['บอกว่าหาอะไร', 'ไซซ์และสี', 'ลองใส่', 'ราคาและส่วนลด', 'จ่ายเงินหรือคืนของ'],
    completion: 'The learner buys, exchanges or politely declines an item.',
    criteria: ['describing items', 'comparatives', 'polite negotiation'], cast: ['sofia', 'emma'],
  },
  {
    id: 'support', category: 'shopping', icon: '📦', th: 'โทรหาฝ่ายบริการลูกค้า', title_en: 'Calling customer service', sub: 'ได้ของผิด ขอเปลี่ยน/คืนเงิน',
    environment: 'A phone call to an online shop: the parcel arrived with the wrong item.', aiRoles: ['support_agent', 'shopping_assistant'], userRole: 'customer',
    objectives: ['Explain the problem with your order', 'Give your order details', 'Agree on a replacement or refund'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['order number', 'the wrong item', 'damaged', 'replacement', 'refund', 'in 3–5 working days'],
    expressions: ['I\'m calling about my order.', 'I received the wrong item.', 'Could you send a replacement?', 'How long will it take?'],
    flow: ['greeting and reason for calling', 'order number and details', 'describing the problem', 'options: replacement or refund', 'confirmation and timeline'],
    flowTh: ['บอกเหตุผลที่โทร', 'เลขคำสั่งซื้อ', 'อธิบายปัญหา', 'เลือกเปลี่ยนของหรือคืนเงิน', 'ยืนยันและระยะเวลา'],
    completion: 'A replacement or refund is agreed and the learner knows when it will happen.',
    criteria: ['explaining a problem clearly', 'polite firmness', 'numbers and dates'], cast: ['sofia', 'james'],
  },
  {
    id: 'landlord', category: 'everyday', icon: '🔧', th: 'แจ้งเจ้าของห้องว่าแอร์เสีย', title_en: 'Telling the landlord about a repair', sub: 'อธิบายปัญหา นัดช่าง',
    environment: 'A call to the landlord of the learner\'s apartment: the air conditioner stopped working.', aiRoles: ['landlord'], userRole: 'tenant',
    objectives: ['Describe the problem and when it started', 'Ask for a repair and a time', 'Agree who pays'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['stopped working', 'leaking', 'repair', 'technician', 'as soon as possible', 'deposit'],
    expressions: ['The air conditioner isn\'t working.', 'It started on Monday.', 'When can someone come to fix it?', 'Who will pay for the repair?'],
    flow: ['greeting and the problem', 'details: since when, what happens', 'landlord is not sure / busy', 'arranging a repair time', 'agreeing costs and goodbye'],
    flowTh: ['บอกปัญหา', 'รายละเอียดอาการ', 'เจ้าของห้องยังไม่สะดวก', 'นัดเวลาซ่อม', 'ตกลงเรื่องค่าใช้จ่าย'],
    completion: 'A repair time is agreed and it is clear who pays.',
    criteria: ['describing a problem', 'time expressions', 'polite but firm requests'], cast: ['james', 'mika'],
  },
  {
    id: 'party', category: 'social', icon: '🎉', th: 'เจอเพื่อนใหม่', title_en: 'Meeting someone at a party', sub: 'Small talk ในงานปาร์ตี้',
    environment: 'A friend\'s birthday party; you know almost nobody.', aiRoles: ['new_friend', 'friend'], userRole: 'party guest',
    objectives: ['Introduce yourself', 'Find something in common', 'Suggest meeting again'],
    cefr: ['A2', 'B2'], difficulty: 'A2', vocab: ['how do you know…', 'what do you do', 'into (music)', 'grab a coffee', 'keep in touch'],
    expressions: ['How do you know (the host)?', 'So what do you do?', 'Me too!', 'We should grab a coffee sometime.'],
    flow: ['introductions', 'how you know the host', 'work or study', 'hobbies in common', 'swap contacts / plan to meet'],
    flowTh: ['แนะนำตัว', 'รู้จักเจ้าภาพได้ยังไง', 'งานหรือการเรียน', 'งานอดิเรกที่ตรงกัน', 'แลกช่องทางติดต่อ'],
    completion: 'The learner has introduced themselves and suggested meeting again.',
    criteria: ['small-talk questions', 'keeping the conversation going', 'natural reactions'], cast: ['sofia', 'emma'],
  },
  {
    id: 'neighbour', category: 'social', icon: '🔊', th: 'คุยกับเพื่อนบ้านเรื่องเสียงดัง', title_en: 'Talking to a noisy neighbour', sub: 'ขอร้องอย่างสุภาพ หาทางออก',
    environment: 'Knocking on the next-door neighbour\'s door at 11 p.m. because of loud music.', aiRoles: ['neighbour'], userRole: 'neighbour next door',
    objectives: ['Introduce yourself and explain the problem politely', 'Respond to excuses calmly', 'Agree on a solution'],
    cefr: ['B1', 'C1'], difficulty: 'B1', vocab: ['sorry to bother you', 'a bit loud', 'early start', 'keep it down', 'compromise', 'no hard feelings'],
    expressions: ['Sorry to bother you, but…', 'Would you mind turning it down a bit?', 'I have to get up early tomorrow.', 'How about…?'],
    flow: ['greeting and apology for disturbing', 'explaining the noise problem', 'the neighbour explains or gets defensive', 'finding a compromise', 'friendly goodbye'],
    flowTh: ['ทักทายและขอโทษที่รบกวน', 'อธิบายเรื่องเสียง', 'เพื่อนบ้านแก้ตัว/ไม่พอใจ', 'หาทางออกร่วมกัน', 'ลาแบบดีๆ'],
    completion: 'Both sides agree on something and part on good terms.',
    criteria: ['softening language (would you mind, a bit)', 'staying calm', 'proposing a compromise'], cast: ['james', 'alex'],
  },
  {
    id: 'apology', category: 'relationships', icon: '💐', th: 'ขอโทษเพื่อนที่ลืมวันเกิด', title_en: 'Apologising to a friend', sub: 'ขอโทษ อธิบาย ชวนชดเชย',
    environment: 'Calling a close friend whose birthday dinner you forgot last night.', aiRoles: ['friend'], userRole: 'the friend who forgot',
    objectives: ['Apologise sincerely', 'Explain without making excuses', 'Offer to make it up'],
    cefr: ['A2', 'C1'], difficulty: 'B1', vocab: ['I\'m so sorry', 'it slipped my mind', 'no excuse', 'make it up to you', 'my treat', 'forgive'],
    expressions: ['I\'m really sorry I missed…', 'It completely slipped my mind.', 'Let me make it up to you.', 'Dinner\'s on me.'],
    flow: ['the friend sounds a bit hurt', 'a sincere apology', 'what happened (honestly)', 'the friend shares feelings', 'an offer to make it up'],
    flowTh: ['เพื่อนน้อยใจ', 'ขอโทษอย่างจริงใจ', 'เล่าตามจริงว่าเกิดอะไร', 'เพื่อนบอกความรู้สึก', 'ชวนไปชดเชย'],
    completion: 'The friend accepts the apology and a plan to make it up is agreed.',
    criteria: ['sincere apology language', 'empathy', 'making an offer'], cast: ['emma', 'sofia'],
  },
  {
    id: 'hotel', category: 'travel', icon: '🏨', th: 'เช็กอินโรงแรม', title_en: 'Checking in at a hotel', sub: 'จองห้อง ปัญหาในห้อง',
    environment: 'A hotel front desk in the evening.', aiRoles: ['hotel_receptionist'], userRole: 'guest',
    objectives: ['Check in with your booking', 'Ask about breakfast and Wi-Fi', 'Report a problem with the room'],
    cefr: ['A2', 'B1'], difficulty: 'A2', vocab: ['reservation', 'check-out time', 'key card', 'the air conditioning isn\'t working', 'late check-out'],
    expressions: ['I have a reservation under…', 'What time is breakfast?', 'What\'s the Wi-Fi password?', 'There\'s a problem with my room.'],
    flow: ['greeting and booking name', 'ID and payment', 'hotel information', 'a room problem', 'solution and goodbye'],
    flowTh: ['ชื่อที่จอง', 'บัตรและการจ่ายเงิน', 'ข้อมูลโรงแรม', 'ห้องมีปัญหา', 'แก้ปัญหาและลา'],
    completion: 'The guest is checked in and the room problem is handled.',
    criteria: ['polite requests', 'describing a problem', 'understanding information'], cast: ['mika'],
  },
  {
    id: 'abroad', category: 'travel', icon: '🗺️', th: 'เที่ยวต่างประเทศ ถามทาง', title_en: 'Asking for directions abroad', sub: 'ทิศทาง ที่เที่ยว เคล็ดลับท้องถิ่น',
    environment: 'A street in a foreign city; you are a tourist.', aiRoles: ['travel_companion', 'tourist', 'local'], userRole: 'traveller',
    objectives: ['Ask for directions to a place', 'Ask for a local recommendation', 'Check you understood'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['how do I get to', 'turn left', 'straight ahead', 'about ten minutes\' walk', 'must-see', 'local tip'],
    expressions: ['Excuse me, how do I get to…?', 'Is it far from here?', 'So I turn left at…, right?', 'Any local tips?'],
    flow: ['asking for help politely', 'directions with landmarks', 'checking understanding', 'a recommendation', 'thanks and goodbye'],
    flowTh: ['ขอความช่วยเหลือ', 'ฟังทางและจุดสังเกต', 'ทวนว่าเข้าใจถูก', 'ขอคำแนะนำที่เที่ยว', 'ขอบคุณและลา'],
    completion: 'The learner knows how to get there and got a tip.',
    criteria: ['direction language', 'clarifying questions', 'politeness'], cast: ['mika', 'emma'],
  },
  {
    id: 'transport', category: 'travel', icon: '🚆', th: 'ซื้อตั๋วรถไฟ/รถบัส', title_en: 'Buying a train ticket', sub: 'เที่ยว เวลา เปลี่ยนสาย',
    environment: 'A train station ticket office.', aiRoles: ['clerk', 'airport_staff'], userRole: 'traveller',
    objectives: ['Buy the right ticket', 'Ask about times and platforms', 'Handle a delay'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['one-way', 'return ticket', 'platform', 'change trains', 'delayed', 'next departure'],
    expressions: ['A one-way ticket to…, please.', 'What time is the next train?', 'Which platform is it?', 'Do I need to change?'],
    flow: ['destination', 'ticket type and time', 'platform and changes', 'a delay announcement', 'alternatives'],
    flowTh: ['บอกปลายทาง', 'ประเภทตั๋วและเวลา', 'ชานชาลาและการต่อรถ', 'ประกาศรถล่าช้า', 'ทางเลือกอื่น'],
    completion: 'The learner has a ticket and knows where to go.',
    criteria: ['numbers and times', 'asking for clarification'], cast: ['mika'],
  },
  {
    id: 'airport', category: 'immigration', icon: '✈️', th: 'สนามบินและ ตม.', title_en: 'Airport and passport control', sub: 'เช็กอิน ตม. กระเป๋าหาย',
    environment: 'An international airport: check-in desk and passport control.', aiRoles: ['airport_staff', 'officer'], userRole: 'passenger',
    objectives: ['Check in and choose a seat', 'Answer immigration questions', 'Report a problem (delay or lost bag)'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['boarding pass', 'aisle seat', 'carry-on', 'purpose of your visit', 'connecting flight', 'baggage claim'],
    expressions: ['Could I have an aisle seat?', 'I\'m here on holiday.', 'I\'m staying for two weeks.', 'My bag didn\'t arrive.'],
    flow: ['check-in and passport', 'bags and seat', 'immigration questions', 'an unexpected delay or problem', 'next steps'],
    flowTh: ['เช็กอินและพาสปอร์ต', 'กระเป๋าและที่นั่ง', 'ตอบคำถาม ตม.', 'ปัญหาไม่คาดคิด', 'ขั้นตอนต่อไป'],
    completion: 'The learner is checked in and through immigration, and the problem has a solution.',
    criteria: ['answering formal questions clearly', 'travel vocabulary', 'asking for help'], cast: ['mika', 'alex'],
  },
  {
    id: 'visa', category: 'immigration', icon: '🛂', th: 'สัมภาษณ์วีซ่า', title_en: 'Visa interview', sub: 'จุดประสงค์ ที่พัก เงิน แผนกลับ',
    environment: 'A short visa interview at an embassy window.', aiRoles: ['officer'], userRole: 'visa applicant',
    objectives: ['Explain the purpose of your trip', 'Give details of stay, money and work', 'Show you will return home'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['purpose of travel', 'itinerary', 'accommodation', 'bank statement', 'employer', 'return ticket'],
    expressions: ['I\'m going for a two-week holiday.', 'I\'ll be staying at…', 'I work as… at…', 'I have a return ticket for…'],
    flow: ['greeting and documents', 'purpose and length of stay', 'accommodation and money', 'job and ties to home', 'decision or next steps'],
    flowTh: ['ทักทายและยื่นเอกสาร', 'จุดประสงค์และระยะเวลา', 'ที่พักและการเงิน', 'งานและเหตุผลที่จะกลับ', 'ผลหรือขั้นตอนต่อไป'],
    completion: 'All questions are answered clearly and consistently.',
    criteria: ['clear, consistent answers', 'formal register', 'future plans (will / going to)'], cast: ['alex', 'james'],
  },
  {
    id: 'teacher', category: 'education', icon: '📝', th: 'ขอเลื่อนส่งงานกับอาจารย์', title_en: 'Asking a teacher for an extension', sub: 'อธิบายเหตุผล ต่อรองวันส่ง',
    environment: 'Office hours with a university teacher; the assignment is due in two days.', aiRoles: ['teacher'], userRole: 'student',
    objectives: ['Explain your situation honestly', 'Ask politely for more time', 'Agree a new deadline and plan'],
    cefr: ['A2', 'C1'], difficulty: 'B1', vocab: ['assignment', 'deadline', 'extension', 'I\'ve been unwell', 'progress so far', 'by Friday'],
    expressions: ['Do you have a minute?', 'I was wondering if I could have an extension.', 'I\'ve finished about half of it.', 'Would next Monday be okay?'],
    flow: ['greeting and asking for a minute', 'explaining the situation', 'the teacher asks questions', 'negotiating a new deadline', 'thanks and plan'],
    flowTh: ['ขอเวลาคุย', 'อธิบายสถานการณ์', 'อาจารย์ถามรายละเอียด', 'ต่อรองวันส่งใหม่', 'ขอบคุณและวางแผน'],
    completion: 'A new deadline is agreed (or a clear answer is given) and the learner thanked the teacher.',
    criteria: ['polite requests (I was wondering if…)', 'giving reasons', 'formal but friendly tone'], cast: ['david'],
  },
  {
    id: 'firstday', category: 'workplace', icon: '👋', th: 'วันแรกที่ทำงานใหม่', title_en: 'First day at a new job', sub: 'แนะนำตัว ถามเรื่องงาน',
    environment: 'The first morning at a new office; a colleague shows the learner around.', aiRoles: ['colleague', 'manager'], userRole: 'new employee',
    objectives: ['Introduce yourself and your role', 'Ask about the team and how things work', 'Make small talk and remember names'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['I\'ve just joined', 'in charge of', 'who should I ask about…', 'lunch break', 'get the hang of', 'shared drive'],
    expressions: ['Hi, I\'m…, I\'ve just joined the… team.', 'Who should I ask about…?', 'How long have you worked here?', 'Thanks, that\'s really helpful.'],
    flow: ['introductions', 'the team and roles', 'practical questions (tools, lunch, hours)', 'small talk', 'plans for the first week'],
    flowTh: ['แนะนำตัว', 'ทีมและหน้าที่', 'ถามเรื่องที่ต้องรู้', 'คุยเล่น', 'แผนสัปดาห์แรก'],
    completion: 'The learner has introduced themselves, asked useful questions and made some small talk.',
    criteria: ['introductions', 'asking for information', 'workplace small talk'], cast: ['james', 'emma'],
  },
  {
    id: 'meeting', category: 'workplace', icon: '📊', th: 'ประชุมทีม', title_en: 'Team meeting', sub: 'อัปเดตงาน เสนอไอเดีย',
    environment: 'A short team meeting about a project.', aiRoles: ['manager', 'business_partner', 'colleague'], userRole: 'team member',
    objectives: ['Give a project update', 'Explain a problem', 'Propose a solution and agree next steps'],
    cefr: ['B1', 'C1'], difficulty: 'B2', vocab: ['on track', 'behind schedule', 'stakeholder', 'follow up', 'action item', 'by end of week'],
    expressions: ['We\'re on track with…', 'We\'ve run into a problem with…', 'What if we…?', 'So the next step is…'],
    flow: ['opening', 'status update', 'a problem or risk', 'options and opinions', 'agree action items'],
    flowTh: ['เปิดประชุม', 'อัปเดตงาน', 'ปัญหาหรือความเสี่ยง', 'แลกความเห็น', 'สรุปงานที่ต้องทำ'],
    completion: 'Next steps and owners are agreed.',
    criteria: ['clarity', 'business collocations', 'agreeing and disagreeing politely'], cast: ['james'],
  },
  {
    id: 'interview', category: 'professional', icon: '💼', th: 'สัมภาษณ์งาน', title_en: 'Job interview', sub: 'แนะนำตัว จุดแข็ง',
    environment: 'A job interview for a position the learner would like.', aiRoles: ['interviewer'], userRole: 'candidate',
    objectives: ['Introduce yourself professionally', 'Talk about strengths with an example', 'Answer a behavioural question', 'Ask the interviewer a question'],
    cefr: ['A2', 'C1'], difficulty: 'B1', vocab: ['background in', 'responsible for', 'team player', 'deadline', 'I\'m keen to', 'career goals'],
    expressions: ['I have a background in…', 'One of my strengths is…', 'For example, when I…', 'Could you tell me more about the team?'],
    flow: ['welcome and small talk', 'tell me about yourself', 'strengths and weaknesses', 'a difficult situation (STAR)', 'why this job', 'candidate questions and close'],
    flowTh: ['ต้อนรับ', 'เล่าเกี่ยวกับตัวเอง', 'จุดแข็งจุดอ่อน', 'เล่าสถานการณ์ยาก (STAR)', 'ทำไมอยากได้งานนี้', 'ถามกลับและปิด'],
    completion: 'All main questions are answered and the learner asked a question back.',
    criteria: ['clear structure', 'professional vocabulary', 'concrete examples', 'tense accuracy'], cast: ['james', 'emma'],
  },
  {
    id: 'vet', category: 'professional', icon: '🐾', th: 'คลินิกสัตว์ (คุณเป็นหมอ)', title_en: 'Vet clinic (you are the vet)', sub: 'ซักประวัติ อธิบายการรักษา',
    environment: 'A veterinary clinic. The learner is the vet.', aiRoles: ['pet_owner'], userRole: 'veterinarian',
    objectives: ['Ask about symptoms', 'Explain the diagnosis simply', 'Give care instructions'],
    cefr: ['B1', 'C1'], difficulty: 'B1', vocab: ['symptoms', 'appetite', 'vaccinated', 'prescribe', 'twice a day', 'follow-up visit'],
    expressions: ['What seems to be the problem?', 'How long has he been like this?', 'It looks like…', 'Give her this twice a day.'],
    flow: ['greeting the owner', 'history and symptoms', 'examination questions', 'diagnosis', 'treatment and care plan'],
    flowTh: ['ทักทายเจ้าของ', 'ประวัติและอาการ', 'ซักถามตอนตรวจ', 'วินิจฉัย', 'การรักษาและการดูแล'],
    completion: 'The owner understands the treatment plan.',
    criteria: ['question forms', 'explaining simply', 'reassuring language'], cast: ['emma', 'sofia'],
  },
  {
    id: 'doctor', category: 'healthcare', icon: '🏥', th: 'ไปหาหมอ', title_en: 'Seeing a doctor', sub: 'อาการ วิธีกินยา',
    environment: 'A clinic appointment.', aiRoles: ['doctor'], userRole: 'patient',
    objectives: ['Describe symptoms and how long', 'Answer the doctor\'s questions', 'Understand how to take medicine'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['sore throat', 'fever', 'since yesterday', 'allergic', 'prescription', 'after meals'],
    expressions: ['I have a sore throat.', 'It started two days ago.', 'I\'m allergic to…', 'How often should I take it?'],
    flow: ['what brings you in', 'symptoms and duration', 'questions and check', 'advice', 'medicine instructions'],
    flowTh: ['บอกว่ามาหาหมอเรื่องอะไร', 'อาการและเป็นมานานเท่าไร', 'หมอซักถาม', 'คำแนะนำ', 'วิธีกินยา'],
    completion: 'The learner understands the advice and medicine.',
    criteria: ['describing symptoms', 'time expressions', 'checking understanding'], cast: ['david', 'alex'],
  },
  {
    id: 'pharmacy', category: 'healthcare', icon: '💊', th: 'ซื้อยาที่ร้านขายยา', title_en: 'At the pharmacy', sub: 'บอกอาการ ถามวิธีใช้ ผลข้างเคียง',
    environment: 'A pharmacy counter abroad; the learner has a cold and a headache.', aiRoles: ['pharmacist', 'doctor'], userRole: 'customer',
    objectives: ['Describe your symptoms', 'Ask how to take the medicine', 'Ask about side effects or allergies'],
    cefr: ['A1', 'B1'], difficulty: 'A2', vocab: ['headache', 'runny nose', 'tablets', 'every six hours', 'drowsy', 'side effects'],
    expressions: ['I have a headache and a runny nose.', 'Do you have anything for…?', 'How many should I take?', 'Will it make me sleepy?'],
    flow: ['greeting and symptoms', 'pharmacist questions (how long, allergies)', 'a recommendation', 'how to take it', 'side effects and paying'],
    flowTh: ['บอกอาการ', 'เภสัชกรถาม', 'แนะนำยา', 'วิธีกิน', 'ผลข้างเคียงและจ่ายเงิน'],
    completion: 'The learner has suitable medicine and knows how to take it safely.',
    criteria: ['describing symptoms', 'question forms', 'understanding instructions'], cast: ['david', 'mika'],
  },
  {
    id: 'emergency', category: 'emergency', icon: '🚨', th: 'เหตุฉุกเฉิน', title_en: 'Emergency call', sub: 'ขอความช่วยเหลือ บอกตำแหน่ง',
    environment: 'An emergency phone call (fire, accident or medical).', aiRoles: ['police_officer', 'police_instructor'], userRole: 'caller',
    objectives: ['Say what happened clearly', 'Give the exact location', 'Answer questions calmly and follow instructions'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['there\'s been an accident', 'injured', 'conscious', 'breathing', 'the address is', 'stay on the line'],
    expressions: ['There\'s been an accident.', 'I\'m at… near…', 'He\'s breathing but not moving.', 'Okay, I understand.'],
    flow: ['what is your emergency', 'location', 'details about people involved', 'instructions', 'help is on the way'],
    flowTh: ['แจ้งว่าเกิดอะไร', 'บอกตำแหน่ง', 'รายละเอียดผู้บาดเจ็บ', 'ทำตามคำแนะนำ', 'รอความช่วยเหลือ'],
    completion: 'The dispatcher has the location and key details, and the learner repeated the instructions.',
    criteria: ['clear short sentences', 'location details', 'staying calm and precise'], cast: ['alex'],
  },
  {
    id: 'police', category: 'emergency', icon: '👮', th: 'แจ้งความกับตำรวจ', title_en: 'Reporting to the police', sub: 'พาสปอร์ตหาย บรรยายเหตุการณ์',
    environment: 'A tourist police desk. The learner lost a passport and wallet, or witnessed a theft.', aiRoles: ['police_officer', 'police_instructor', 'witness'], userRole: 'person reporting',
    objectives: ['Explain what happened, where and when', 'Describe a person or item', 'Understand the next steps (report, embassy)'],
    cefr: ['A2', 'B2'], difficulty: 'B1', vocab: ['I\'d like to report', 'stolen', 'around 3 p.m.', 'he was wearing', 'police report', 'embassy'],
    expressions: ['I\'d like to report a theft.', 'It happened around… at…', 'He was wearing…', 'What should I do next?'],
    flow: ['how can I help', 'what happened', 'when and where', 'descriptions', 'personal details', 'next steps'],
    flowTh: ['เจ้าหน้าที่ถาม', 'เล่าเหตุการณ์', 'เวลาและสถานที่', 'บรรยายคน/ของ', 'ข้อมูลส่วนตัว', 'ขั้นตอนต่อไป'],
    completion: 'A report is made and the learner knows what to do next.',
    criteria: ['past narrative', 'describing people and things', 'formal politeness'], cast: ['alex'],
  },
  {
    id: 'ielts', category: 'ielts', icon: '🎓', th: 'สอบพูด IELTS', title_en: 'IELTS Speaking mock test', sub: 'Part 1–3 · ประมาณ band จากการฝึก', englishOnly: true, feedback: IELTS_FEEDBACK,
    environment: 'An IELTS Speaking test room.', aiRoles: ['speaking_examiner'], userRole: 'candidate',
    objectives: ['Answer Part 1 questions with some detail', 'Speak for 1–2 minutes on the Part 2 card', 'Discuss Part 3 questions with reasons and examples'],
    cefr: ['B1', 'C2'], difficulty: 'B2', vocab: ['I\'d say', 'on the other hand', 'it depends on', 'for instance', 'in my experience'],
    expressions: ['That\'s an interesting question.', 'I\'d say that…', 'For instance,…', 'On the other hand,…'],
    flow: ['Part 1: 4–5 short familiar questions', 'Part 2: cue card, 1–2 minute talk, one follow-up', 'Part 3: 3–4 deeper discussion questions', 'close the test'],
    flowTh: ['Part 1 คำถามสั้น', 'Part 2 พูดตามการ์ด', 'Part 3 อภิปราย', 'จบการสอบ'],
    completion: 'All three parts are done.',
    criteria: ['Fluency and Coherence', 'Lexical Resource', 'Grammatical Range and Accuracy'], cast: ['david'],
  },
];

// Fills in derived fields, so a v1 entry (group, flow) still works.
export function upgradeScenario(s) {
  const category = s.category || GROUP_TO_CATEGORY[s.group] || 'everyday';
  const lvl = s.difficulty && CEFR_ORDER.includes(s.difficulty) ? s.difficulty : 'B1';
  const cefr = Array.isArray(s.cefr) && s.cefr.length === 2 ? s.cefr : [lvl, lvl];
  const flow = s.flow || [];
  return {
    ...s, category, cefr,
    title_en: s.title_en || s.th, description: s.description || s.environment,
    expressions: s.expressions || [],
    steps: flow.map((goal, i) => ({ id: `s${i + 1}`, goal, th: (s.flowTh || [])[i] || goal })),
  };
}

export const SCENARIOS = RAW.map(upgradeScenario);
export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || null;
export const categoryOf = (id) => SCENARIO_CATEGORIES.find((c) => c.id === id) || SCENARIO_CATEGORIES[0];

// True when the learner's CEFR level falls inside the scenario's range.
export function fitsLevel(s, cefr) {
  const i = CEFR_ORDER.indexOf(cefr);
  return i >= 0 && i >= CEFR_ORDER.indexOf(s.cefr[0]) && i <= CEFR_ORDER.indexOf(s.cefr[1]);
}

// Search over Thai and English titles, the description, vocabulary and expressions.
export function searchScenarios(list, { q = '', category = '', cefr = '', english = true } = {}) {
  const needle = q.trim().toLowerCase();
  return list.filter((s) => (!s.englishOnly || english)
    && (!category || s.category === category)
    && (!cefr || fitsLevel(s, cefr))
    && (!needle || [s.th, s.title_en, s.sub, s.environment, ...s.vocab, ...s.expressions].join(' ').toLowerCase().includes(needle)));
}

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

// Past attempts at one scenario, newest first, and how the latest compares with the one before.
export function attemptsOf(results, id) {
  return (results || []).filter((r) => r.id === id).sort((a, b) => b.t - a.t);
}
export function progressOf(results, id) {
  const list = attemptsOf(results, id);
  const scored = list.filter((r) => r.score != null && r.score !== '' && Number.isFinite(Number(r.score)));   // Number(null) is 0
  const best = scored.length ? Math.max(...scored.map((r) => Number(r.score))) : null;
  const delta = scored.length >= 2 ? Number(scored[0].score) - Number(scored[1].score) : null;
  return { count: list.length, best, last: scored[0] ?? null, delta };
}

// Keeps only scores for the scene's own criteria (names matched loosely), in the scene's order.
export function matchCriteria(scores, criteria = []) {
  const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return criteria.map((name) => {
    const hit = (scores || []).find((x) => key(x.name) === key(name) || key(name).startsWith(key(x.name)) || key(x.name).startsWith(key(name)));
    return hit ? { name, score: hit.score } : null;
  }).filter(Boolean);
}

// Text for the model: guidance, not a script. state: { variant, step } of the running scene.
export function scenarioBrief(sc, roleLabel, state = {}) {
  const v = VARIANTS[state.variant] || VARIANTS.normal;
  const lines = [
    `Scenario: ${sc.title_en || sc.th} (${sc.th}) — ${sc.environment}`,
    `You play: ${roleLabel}. The learner plays: ${sc.userRole}.`,
    `Learner objectives: ${sc.objectives.join('; ')}.`,
    `Useful language to draw out (do not list it, create chances to use it): ${sc.vocab.join(', ')}${sc.expressions?.length ? `; phrases like: ${sc.expressions.join(' / ')}` : ''}.`,
  ];
  if (sc.steps?.length) {
    lines.push(`Stages (adapt freely, skip or reorder if the learner takes it elsewhere): ${sc.steps.map((s) => `${s.id} ${s.goal}`).join(' → ')}.`);
    if (state.step) lines.push(`The learner has reached stage s${state.step} so far.`);
  }
  lines.push(`It is complete when: ${sc.completion} Then set "scenario_done" to true and tell the learner they can tap "จบและขอคำแนะนำ".`);
  lines.push(`Typical level ${sc.cefr[0]}–${sc.cefr[1]}, adjusted to the learner's level. ${v.prompt}`);
  return lines.join('\n');
}

export function validateScenario(s) {
  const errs = [];
  for (const k of ['id', 'category', 'icon', 'th', 'title_en', 'sub', 'environment', 'aiRoles', 'userRole', 'objectives', 'cefr', 'difficulty', 'vocab', 'expressions', 'flow', 'completion', 'criteria', 'cast']) {
    if (s[k] == null || (Array.isArray(s[k]) && !s[k].length)) errs.push(`missing ${k}`);
  }
  if (!SCENARIO_CATEGORIES.some((c) => c.id === s.category)) errs.push('unknown category');
  if (!Array.isArray(s.cefr) || s.cefr.length !== 2 || !s.cefr.every((x) => CEFR_ORDER.includes(x)) || CEFR_ORDER.indexOf(s.cefr[0]) > CEFR_ORDER.indexOf(s.cefr[1])) errs.push('bad cefr range');
  if (!s.flowTh || s.flowTh.length !== (s.flow || []).length) errs.push('flowTh must match flow');
  if (!s.steps || s.steps.length !== (s.flow || []).length) errs.push('steps missing');
  return errs;
}
