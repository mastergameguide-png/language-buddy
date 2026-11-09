// 👮 RPCA-TEP practice (Royal Police Cadet Academy Test of English Proficiency).
// Structure from the RPCA English department's 2026 study: 120 multiple-choice items, Listening 40,
// Grammar 20, Vocabulary 20, Reading 40, about 40% in policing contexts; bachelor's pass mark 60
// (rpca-tep.rpca.ac.th). Item types follow the CU-TEP-style description the owner shared.
// Every question here is original, written for this app at B1–B2. Checked offline. Pure.

export const PARTS = [
  { id: 'listening', th: 'การฟัง', icon: '🎧', real: 40, desc: 'บทสนทนาสั้น บทสนทนายาว และการพูดคนเดียว' },
  { id: 'grammar', th: 'ไวยากรณ์', icon: '✏️', real: 20, desc: 'Structure เติมประโยค (แบบ mock test) และหาจุดผิด' },
  { id: 'vocab', th: 'คำศัพท์', icon: '📘', real: 20, desc: 'เติมคำให้เข้ากับประโยค (แบบ mock test) ความหมายจากบริบท และ Cloze' },
  { id: 'reading', th: 'การอ่าน', icon: '📖', real: 40, desc: 'บทอ่านสั้น (ประกาศ จดหมาย) และบทอ่านยาวเชิงวิชาการ' },
];
export const SET_SIZE = 10;
// The RPCA-TEP mock test (July 2026) uses gap-fill only for Structure and Vocabulary, so other
// item types are kept to a few per set.
export const TYPE_CAP = { grammar: { error: 2 }, vocab: { context: 2, cloze: 4 } };
export const POLICE_SHARE = 0.4;
export const PASS_BACHELOR = 60;    // out of 120
export const PASS_MASTER = 65;
export const partById = (id) => PARTS.find((p) => p.id === id) || null;

// Units: one or more questions that belong together (a dialogue, a passage, a cloze text).
// Each question: { q, options (4), answer (index), why (Thai) }.
// Grammar "error" items mark the four underlined parts with {braces}; the answer is the wrong one.
const mc = (q, options, answer, why) => ({ q, options, answer, why });

export const BANK = {
  listening: [
    { type: 'short', police: true, script: [['M', 'Excuse me, officer. Someone took my bag while I was sitting at the café over there.'], ['W', "I'm sorry to hear that. Can you tell me what was inside it and roughly what time this happened?"]],
      qs: [mc('What will the man probably do next?', ['Describe the bag and the time it was taken', 'Go back to the café to look for it', 'Buy a new bag at the market', 'Call his bank to cancel his cards'], 0, 'ตำรวจถามว่าในกระเป๋ามีอะไรและเกิดเวลาไหน ผู้ชายจึงต้องตอบเรื่องนี้ต่อ')] },
    { type: 'short', police: false, script: [['W', 'Are you coming to the meeting at three?'], ['M', "I'd love to, but my train has been pushed back an hour, so I won't get there until it's nearly over."]],
      qs: [mc('What does the man mean?', ['He will arrive late for the meeting', 'He will not go to the meeting at all', 'The meeting has been moved to four', 'He has missed his train'], 0, '"pushed back" = ถูกเลื่อนออกไป รถไฟช้า เขาจึงไปถึงตอนประชุมใกล้จบ (ยังไป แต่ไปสาย)')] },
    { type: 'short', police: true, script: [['M', "I'd like to report a car that's been parked across my driveway since this morning."], ['W', "Do you have the licence plate number? We'll send someone to check, but it may take about an hour."]],
      qs: [mc('What problem does the man have?', ['A car is blocking the entrance to his house', 'His car has been stolen', 'He has lost his driving licence', 'He received a parking ticket'], 0, 'parked across my driveway = จอดขวางทางเข้าบ้าน')] },
    { type: 'short', police: false, script: [['W', 'I thought the library closed at eight.'], ['M', 'It used to, but since the renovation it stays open until ten on weekdays.']],
      qs: [mc('What do we learn about the library?', ['It now closes later on weekdays', 'It is closed for renovation', 'It still closes at eight every day', 'It now opens at ten'], 0, '"used to" = เคย (ปิดสองทุ่ม) ตอนนี้เปิดถึงสี่ทุ่มในวันธรรมดา')] },
    { type: 'short', police: true, script: [['W', 'My passport is missing. I think I left it in a taxi.'], ['M', "First, we'll write a police report. You'll need it when you go to your embassy to apply for a new one."]],
      qs: [mc('Why does the woman need a police report?', ['To get a new passport from her embassy', 'To find the taxi driver', 'To leave the country today', 'To get money back from the taxi company'], 0, 'ตำรวจบอกว่าต้องใช้ใบแจ้งความตอนไปสถานทูตเพื่อขอพาสปอร์ตเล่มใหม่')] },
    { type: 'short', police: false, script: [['M', 'Have you finished the report yet?'], ['W', 'Almost. I just need to check the figures one more time before I send it.']],
      qs: [mc('What will the woman do next?', ['Check the numbers in the report', 'Write the report again', 'Send the report immediately', 'Ask the man to help her'], 0, 'figures = ตัวเลข เธอจะตรวจตัวเลขอีกครั้งก่อนส่ง')] },
    { type: 'long', police: true, script: [
      ['M', 'Good afternoon. You said you wanted to report a problem at the night market?'],
      ['W', 'Yes. A man offered to change my money at a very good rate. He counted the notes in front of me, but when I got back to the hotel, half of them were missing.'],
      ['M', 'I see. This is a common trick. Did you notice anything about the man, like his clothes or anything he said?'],
      ['W', "He wore a blue cap, and he said he worked for a travel agency nearby. I didn't see any office, though."],
      ['M', "That's helpful. We've had similar reports this week. Please only change money at banks or licensed exchange booths. I'll file a report, and we'll increase patrols in that area tonight."]],
      qs: [
        mc('What happened to the woman?', ['She received less money than she was promised', 'Her wallet was stolen at her hotel', 'She paid too much for a tour', 'She lost her passport at the market'], 0, 'เขานับเงินให้ดู แต่กลับถึงโรงแรมเงินหายไปครึ่งหนึ่ง = ได้เงินน้อยกว่าที่ตกลง'),
        mc('What did the man at the market claim?', ['He worked for a travel agency', 'He was a police officer', 'He worked at a bank', 'He owned a hotel nearby'], 0, 'ผู้หญิงเล่าว่า "he said he worked for a travel agency nearby" = อ้างว่าทำงานบริษัททัวร์'),
        mc('What will the police do?', ['Send more officers to the market area', 'Give the woman her money back', 'Close the night market', 'Visit the travel agency tomorrow'], 0, 'increase patrols = เพิ่มการลาดตระเวน คือส่งตำรวจไปบริเวณนั้นมากขึ้น')] },
    { type: 'long', police: false, script: [
      ['W', "So you're thinking of taking five courses next semester?"],
      ['M', 'Yes, I want to graduate early. But I also have a part-time job at weekends.'],
      ['W', "Five courses is possible, but two of the ones you've chosen have heavy lab work. Many students in your situation find it hard to keep their grades up."],
      ['M', 'What would you suggest?'],
      ['W', "Take four this semester and do the fifth one in the summer session. You'd still finish at the same time."]],
      qs: [
        mc('Why does the student want to take five courses?', ['To finish his degree sooner', 'To leave his part-time job', 'To change his major', 'To win a scholarship'], 0, '"I want to graduate early" = อยากเรียนจบเร็วขึ้น'),
        mc("What is the advisor's main concern?", ['The workload may affect his grades', 'The courses are already full', 'The labs are closed in summer', 'He has not taken the required courses'], 0, 'เธอบอกว่านักศึกษาแบบนี้มักรักษาเกรดไว้ได้ยาก เพราะงานแล็บหนัก'),
        mc('What does the advisor suggest?', ['Taking one course in the summer session', 'Giving up his weekend job', 'Taking six courses instead', 'Delaying his graduation'], 0, 'เรียน 4 วิชาเทอมนี้ แล้วเรียนวิชาที่ 5 ภาคฤดูร้อน')] },
    { type: 'talk', police: true, script: [
      ['M', 'Good morning, everyone. Before you start your shift, a few updates. First, the festival begins tomorrow, and we expect around fifty thousand visitors. All officers on the riverside route must report at six a.m., one hour earlier than usual.'],
      ['M', 'Second, several visitors complained that they could not find the lost-and-found point last year, so this year it will be next to the main stage, not at the station.'],
      ['M', "Finally, remember that many visitors won't speak Thai. Keep your instructions short and simple, and use the translation cards in your kit if needed."]],
      qs: [
        mc('What is the main purpose of the talk?', ['To give officers instructions for an event', 'To train officers in first aid', 'To report a serious crime', 'To welcome new officers to the station'], 0, 'เป็นการบรีฟก่อนเข้าเวรเรื่องงานเทศกาล = ให้คำสั่งสำหรับงานอีเวนต์'),
        mc('What has changed this year?', ['Where visitors can find lost items', 'The number of visitors expected', 'The date of the festival', 'The size of the main stage'], 0, 'จุดรับของหายย้ายไปอยู่ข้างเวทีหลัก ไม่ใช่ที่สถานี'),
        mc('What does the speaker advise about foreign visitors?', ['Use short and simple instructions', 'Ask them to speak Thai', 'Send them to the station', 'Avoid giving them directions'], 0, 'ผู้พูดบอกให้ "Keep your instructions short and simple" = ให้คำแนะนำสั้นและง่าย')] },
    { type: 'talk', police: false, script: [
      ['W', 'Today I want to talk about why sleep matters for students. Many people believe that staying up all night before an exam is a good way to study. Research suggests the opposite.'],
      ['W', 'During deep sleep, the brain moves new information into long-term memory. Students who sleep after studying usually remember more than those who study for the same time without sleeping.'],
      ['W', 'So, although it may feel productive, an all-night study session often reduces what you can recall the next day.']],
      qs: [
        mc('What is the talk mainly about?', ['How sleep helps students remember', 'How to choose a university', 'Why exams cause stress', 'How to sleep fewer hours'], 0, 'ใจความหลักคือการนอนช่วยให้จำสิ่งที่เรียนได้'),
        mc('According to the speaker, what happens during deep sleep?', ['New information is stored in long-term memory', 'The brain forgets unimportant facts', 'Students dream about their exams', 'The body uses less energy'], 0, 'ระหว่างหลับลึก สมองย้ายข้อมูลใหม่ไปเก็บในความจำระยะยาว (long-term memory)'),
        mc("What is the speaker's attitude toward studying all night?", ['Critical', 'Enthusiastic', 'Neutral', 'Amused'], 0, 'ผู้พูดบอกว่าการอ่านทั้งคืนทำให้จำได้น้อยลง = ไม่เห็นด้วย (critical)')] },
  ],

  grammar: [
    { type: 'error', police: true, s: 'The number of reported thefts {have} {risen} sharply {since} the new shopping centre {opened}.', answer: 0, fix: 'has', why: '"The number of …" เป็นประธานเอกพจน์ ต้องใช้ has (ต่างจาก "A number of …" ที่ใช้พหูพจน์)' },
    { type: 'error', police: true, s: 'Each of the officers {were} {given} a radio {before} the operation {began}.', answer: 0, fix: 'was', why: '"Each of + พหูพจน์" ถือเป็นเอกพจน์ ต้องใช้ was' },
    { type: 'error', police: true, s: 'The officer asked the driver {to turn} off the engine, {step} out of the car, and {showing} {his} licence.', answer: 2, fix: 'show', why: 'Parallel structure: to turn …, step …, and show … ต้องเป็นรูปเดียวกัน' },
    { type: 'error', police: true, s: 'The stolen motorbike {was found} {abandon} near the river two days {after} it {had been} reported missing.', answer: 1, fix: 'abandoned', why: 'ต้องใช้ past participle (abandoned = ถูกทิ้งไว้) ขยายสภาพของรถ' },
    { type: 'error', police: true, s: 'By the time the police {arrived}, the thieves {already escaped} {through} a back door {that} led to the car park.', answer: 1, fix: 'had already escaped', why: 'เหตุการณ์ที่เกิดก่อนอีกเหตุการณ์ในอดีต (By the time …) ใช้ past perfect: had escaped' },
    { type: 'error', police: true, s: 'Officers {are trained} {to remain} calm, {listening} carefully, and {respond} politely to complaints.', answer: 2, fix: 'listen', why: 'Parallel structure หลัง to: (to) remain, listen, respond' },
    { type: 'error', police: true, s: 'Tourists {who} lose their passports {should report} the loss {to} the police as soon as {possibly}.', answer: 3, fix: 'possible', why: 'สำนวน "as soon as possible" ใช้ adjective (possible) ไม่ใช่ adverb' },
    { type: 'error', police: false, s: 'She {has worked} at the hospital {since} five years and {is} now {responsible} for training new nurses.', answer: 1, fix: 'for', why: 'ระยะเวลา (five years) ใช้ for ส่วน since ใช้กับจุดเริ่มต้น เช่น since 2020' },
    { type: 'error', police: false, s: 'If the weather {will be} good tomorrow, we {will} {hold} the ceremony {outside}.', answer: 0, fix: 'is', why: 'First conditional: If + present simple, will + V (ไม่ใช้ will ในประโยค if)' },
    { type: 'error', police: false, s: 'The new library, {which} {was opened} last month, {have} more than 200 computers {available} to students.', answer: 2, fix: 'has', why: 'ประธานคือ The new library (เอกพจน์) ต้องใช้ has' },
    { type: 'error', police: false, s: 'Many students are afraid of {making} mistakes, so they {often} {avoid} {to ask} questions in class.', answer: 3, fix: 'asking', why: 'avoid ตามด้วย gerund (V-ing) เสมอ: avoid asking' },
    { type: 'error', police: false, s: 'Before the director arrives, the report {must} {be} {checked} and {send} to every team.', answer: 3, fix: 'sent', why: 'Passive หลัง modal: must be checked and (be) sent ต้องเป็น V3 ทั้งคู่ (parallel)' },
    { type: 'error', police: false, s: 'The children {was} {excited} {to visit} the museum {for} the first time.', answer: 0, fix: 'were', why: 'The children เป็นพหูพจน์ ต้องใช้ were' },
    { type: 'error', police: false, s: 'Thank you for the invitation. I {am} {really} {looking forward to} {meet} you at the conference.', answer: 3, fix: 'meeting', why: '"look forward to" — to ในสำนวนนี้เป็นบุพบท ต้องตามด้วย V-ing' },
    { type: 'error', police: false, s: 'Last year the company {has hired} more staff {than} {it} {did} in the previous five years.', answer: 0, fix: 'hired', why: 'มีคำบอกเวลาในอดีตชัดเจน (Last year) ใช้ past simple ไม่ใช่ present perfect' },
    { type: 'error', police: false, s: 'The more you practise speaking, {the} {most} confident you {will} {become}.', answer: 1, fix: 'more', why: 'โครงสร้าง "The more …, the more …" ใช้ขั้นกว่า (more) ทั้งสองฝั่ง' },
    { type: 'complete', police: true, ...mc('The witness said she ___ the man before the night of the robbery.', ['had never seen', 'has never seen', 'never sees', 'is never seeing'], 0, 'เล่าย้อนเหตุการณ์ที่เกิดก่อนคืนเกิดเหตุในอดีต ใช้ past perfect') },
    { type: 'complete', police: true, ...mc('All visitors ___ to show identification at the entrance.', ['are required', 'require', 'are requiring', 'have required'], 0, 'ผู้มาเยือน "ถูกกำหนดให้" แสดงบัตร = passive: are required to') },
    { type: 'complete', police: true, ...mc('The officer, ___ had worked in the tourist police for ten years, spoke three languages.', ['who', 'which', 'whose', 'whom'], 0, 'ขยายคน (the officer) และทำหน้าที่ประธานของ had worked ใช้ who') },
    { type: 'complete', police: false, ...mc('___ the heavy traffic, we arrived at the airport on time.', ['Despite', 'Although', 'Because', 'However'], 0, 'ตามด้วยคำนาม (the heavy traffic) ใช้ Despite; Although ต้องตามด้วยประโยค') },
    { type: 'complete', police: false, ...mc('She suggested ___ the meeting until all the data was ready.', ['postponing', 'to postpone', 'postpone', 'postponed'], 0, 'suggest ตามด้วย V-ing') },
    { type: 'complete', police: false, ...mc('If I ___ more time, I would join the volunteer programme.', ['had', 'have', 'will have', 'would have'], 0, 'Second conditional (สมมติ): If + past simple, would + V') },
    { type: 'complete', police: false, ...mc('Not only ___ the exam, but she also received the highest score in her class.', ['did she pass', 'she passed', 'she did pass', 'passed she'], 0, 'ขึ้นต้นด้วย Not only ต้องสลับเป็นรูปคำถาม (inversion): did she pass') },
    { type: 'complete', police: false, ...mc('The bridge ___ since last March, so drivers must use the other road.', ['has been closed', 'is closed', 'was closing', 'closes'], 0, 'มี since + ยังมีผลถึงตอนนี้ ใช้ present perfect (passive): has been closed') },
    // Structure items in the style of the RPCA-TEP mock test (July 2026): one gap, four forms.
    { type: 'complete', police: true, ...mc('The stolen car ___ in a shopping centre car park two days later.', ['was found', 'found', 'has found', 'is finding'], 0, 'รถ "ถูกพบ" และเป็นอดีต = passive past: was found') },
    { type: 'complete', police: true, ...mc('The officers need more ___ before they can make an arrest.', ['evidence', 'evident', 'evidently', 'evidential'], 0, 'หลัง more ต้องเป็นคำนาม: evidence (หลักฐาน)') },
    { type: 'complete', police: true, ...mc('Unless the driver ___ his licence, the officer will issue a fine.', ['shows', 'showed', 'will show', 'would show'], 0, 'Unless = If … not ใช้ present simple เหมือน first conditional') },
    { type: 'complete', police: true, ...mc('By next March, the new recruits ___ their basic training.', ['will have completed', 'will complete', 'complete', 'are completing'], 0, 'By + เวลาในอนาคต = จะเสร็จก่อนถึงเวลานั้น ใช้ future perfect: will have completed') },
    { type: 'complete', police: false, ...mc('The teacher reminded the students ___ their names on the answer sheet.', ['to write', 'write', 'writing', 'to writing'], 0, 'remind + คน + to + V (เตือนให้ทำ)') },
    { type: 'complete', police: true, ...mc('The station had its security cameras ___ last month.', ['replaced', 'replace', 'replacing', 'to replace'], 0, 'Causative: have + สิ่งของ + V3 = ให้คนอื่นทำให้ (had cameras replaced)') },
    { type: 'complete', police: true, ...mc('Neither the driver nor his passengers ___ wearing seat belts.', ['were', 'was', 'is', 'has been'], 0, 'Neither … nor … กริยาตามประธานตัวที่ใกล้ที่สุด (passengers = พหูพจน์) → were') },
    { type: 'complete', police: true, ...mc('The officer spoke ___ to calm the frightened child.', ['gently', 'gentle', 'gentleness', 'more gentle'], 0, 'ขยายกริยา spoke ต้องใช้ adverb: gently') },
    { type: 'complete', police: false, ...mc('She is used to ___ long hours at the hospital.', ['working', 'work', 'worked', 'works'], 0, 'be used to (เคยชินกับ) + V-ing') },
    { type: 'complete', police: true, ...mc('The man ___ wallet was stolen has come to make a statement.', ['whose', 'who', 'which', 'whom'], 0, 'แสดงความเป็นเจ้าของ (กระเป๋าสตางค์ของผู้ชาย) ใช้ whose') },
    { type: 'complete', police: false, ...mc('Please wait in this room ___ your name is called.', ['until', 'because', 'although', 'so that'], 0, 'until = จนกว่า (รอจนกว่าจะถูกเรียกชื่อ)') },
    { type: 'complete', police: false, ...mc('The new bridge is ___ than the old one.', ['much wider', 'more wide', 'widest', 'the wider'], 0, 'คำสั้นพยางค์เดียวใช้ -er + than; much ช่วยเน้น') },
    { type: 'complete', police: true, ...mc('The witness could not remember ___ the suspect ran after the robbery.', ['where', 'where did', 'where does', 'that where'], 0, 'คำถามซ้อน (indirect question) ไม่สลับกริยาช่วย: remember where the suspect ran') },
    { type: 'complete', police: false, ...mc('I would have called you if I ___ your phone number.', ['had known', 'knew', 'have known', 'would know'], 0, 'สมมติย้อนอดีต (Third conditional): if + had + V3, would have + V3') },
    { type: 'complete', police: false, ...mc('The application form must ___ before Friday.', ['be submitted', 'submit', 'submitting', 'be submitting'], 0, 'แบบฟอร์ม "ถูกส่ง" = passive หลัง modal: must be submitted') },
    { type: 'complete', police: true, ...mc('The suspect denied ___ the shop on the night of the robbery.', ['entering', 'to enter', 'enter', 'entered'], 0, 'deny (ปฏิเสธว่าไม่ได้ทำ) ตามด้วย V-ing') },
    { type: 'complete', police: false, ...mc('There ___ a lot of traffic on the main road this morning.', ['was', 'were', 'have been', 'are being'], 0, 'traffic เป็นคำนามนับไม่ได้ และเป็นเช้านี้ (อดีต) → was') },
    { type: 'complete', police: true, ...mc('Visitors were asked to stay behind the barrier for ___ own safety.', ['their', 'its', 'there', "they're"], 0, 'Visitors (พหูพจน์) → their own safety') },
    { type: 'complete', police: false, ...mc('The train was delayed, ___ we missed the start of the concert.', ['so', 'because', 'although', 'unless'], 0, 'บอกผลลัพธ์ (รถไฟช้า จึงพลาด) ใช้ so') },
    { type: 'complete', police: true, ...mc('The patrol car ___ when the officers received the emergency call.', ['was being repaired', 'repaired', 'is repairing', 'has repaired'], 0, 'กำลังถูกซ่อมอยู่ตอนที่มีเหตุอื่นแทรกในอดีต = past continuous passive') },
  ],

  vocab: [
    { type: 'context', police: true, ...mc('The officers were able to apprehend the suspect before he reached the border. "Apprehend" is closest in meaning to', ['arrest', 'question', 'warn', 'follow'], 0, 'apprehend = จับกุม (arrest)') },
    { type: 'context', police: true, ...mc('The witness gave only a vague description, so it was hard to identify the man. "Vague" means', ['unclear', 'detailed', 'false', 'angry'], 0, 'vague = คลุมเครือ ไม่ชัดเจน') },
    { type: 'context', police: true, ...mc('Drivers who violate traffic laws may lose their licence. "Violate" means', ['break', 'study', 'follow', 'change'], 0, 'violate = ฝ่าฝืน (break the law)') },
    { type: 'context', police: true, ...mc('The investigation revealed crucial evidence that changed the direction of the case. "Crucial" means', ['extremely important', 'very small', 'confusing', 'out of date'], 0, 'crucial = สำคัญมาก') },
    { type: 'context', police: true, ...mc('The tourist was reluctant to give her name because she was afraid. "Reluctant" means', ['unwilling', 'pleased', 'quick', 'able'], 0, 'reluctant = ไม่เต็มใจ ลังเล') },
    { type: 'context', police: true, ...mc('Stricter penalties are expected to deter people from drinking and driving. "Deter" means', ['discourage', 'allow', 'teach', 'remind'], 0, 'deter = ยับยั้ง ทำให้ไม่กล้าทำ') },
    { type: 'context', police: false, ...mc('The company decided to postpone the launch until the spring. "Postpone" means', ['delay', 'cancel', 'announce', 'speed up'], 0, 'postpone = เลื่อนออกไป (ยังจะทำ ไม่ใช่ยกเลิก)') },
    { type: 'context', police: false, ...mc('Her explanation was so concise that everyone understood it immediately. "Concise" means', ['short and clear', 'long and detailed', 'difficult', 'amusing'], 0, 'concise = กระชับ ได้ใจความ') },
    { type: 'context', police: false, ...mc('The new policy is intended to enhance the safety of factory workers. "Enhance" means', ['improve', 'reduce', 'test', 'describe'], 0, 'enhance = เพิ่ม ทำให้ดีขึ้น') },
    { type: 'context', police: false, ...mc("The scientist's findings were consistent with earlier studies. \"Consistent with\" means", ['in agreement with', 'in conflict with', 'unrelated to', 'older than'], 0, 'consistent with = สอดคล้องกับ') },
    { type: 'context', police: false, ...mc('Hotel prices fluctuate a lot during the holiday season. "Fluctuate" means', ['go up and down', 'stay the same', 'fall steadily', 'double'], 0, 'fluctuate = ขึ้นลงไม่คงที่') },
    { type: 'context', police: false, ...mc('The museum attracts a diverse group of visitors from many countries. "Diverse" means', ['varied', 'small', 'wealthy', 'young'], 0, 'diverse = หลากหลาย') },
    { type: 'context', police: false, ...mc('He made a deliberate decision to leave his job and study abroad. "Deliberate" means', ['intentional', 'sudden', 'wrong', 'shared'], 0, 'deliberate = ตั้งใจ ไตร่ตรองแล้ว') },
    { type: 'context', police: false, ...mc('The two towns are adjacent, so it takes only ten minutes to drive between them. "Adjacent" means', ['next to each other', 'far apart', 'very large', 'very similar'], 0, 'adjacent = อยู่ติดกัน') },
    { type: 'cloze', police: true,
      text: 'Community policing is an approach in which officers work closely with local residents to (1) ___ problems before they become serious. Instead of only (2) ___ to emergency calls, officers spend time getting to know shop owners, teachers and families. This helps build (3) ___, which makes people more willing to share information. (4) ___, community policing requires time and money, and results may not appear immediately.',
      qs: [
        mc('(1)', ['prevent', 'prevention', 'preventing', 'prevented'], 0, 'หลัง to (infinitive) ใช้กริยาช่องหนึ่ง: to prevent'),
        mc('(2)', ['responding', 'respond', 'response', 'responded'], 0, 'หลัง Instead of (บุพบท) ใช้ V-ing: responding'),
        mc('(3)', ['trust', 'fear', 'distance', 'crime'], 0, 'ทำให้คนเต็มใจให้ข้อมูลมากขึ้น = สร้างความไว้วางใจ (trust)'),
        mc('(4)', ['However', 'Therefore', 'For example', 'Similarly'], 0, 'ประโยคหลังพูดถึงข้อเสีย ขัดกับข้อดีก่อนหน้า ใช้ However')] },
    { type: 'cloze', police: false,
      text: 'Many universities now offer online courses. These courses are popular because students can study at their own (1) ___. However, some students find it hard to stay (2) ___ without a teacher in the room. Research shows that students who (3) ___ a regular timetable are more likely to complete their courses. (4) ___, online learning works best for people who can organise their own time.',
      qs: [
        mc('(1)', ['pace', 'speed limit', 'rate', 'step'], 0, 'สำนวน "at your own pace" = ตามจังหวะของตัวเอง'),
        mc('(2)', ['motivated', 'motivation', 'motivate', 'motivating'], 0, 'stay + adjective: stay motivated = มีแรงจูงใจอยู่เสมอ'),
        mc('(3)', ['follow', 'follows', 'following', 'to follow'], 0, 'students who … ประธานพหูพจน์ ใช้ follow'),
        mc('(4)', ['In short', 'On the other hand', 'Instead', 'Otherwise'], 0, 'ประโยคสุดท้ายสรุปเนื้อหา ใช้ In short')] },
    // Gap-fill vocabulary in the style of the RPCA-TEP mock test (July 2026).
    { type: 'gap', police: true, ...mc('Officers must ___ the identity of every visitor before letting them into the building.', ['verify', 'decorate', 'borrow', 'predict'], 0, 'verify = ตรวจสอบยืนยัน (verify the identity)') },
    { type: 'gap', police: true, ...mc('The police ___ a warning about fake websites that ask for bank details.', ['issued', 'invested', 'attended', 'repaired'], 0, 'issue a warning = ออกคำเตือน') },
    { type: 'gap', police: true, ...mc('The driver was fined for ___ the speed limit on the highway.', ['exceeding', 'obeying', 'measuring', 'reducing'], 0, 'exceed the speed limit = ขับเร็วเกินกำหนด (จึงถูกปรับ)') },
    { type: 'gap', police: true, ...mc('The victim was too ___ to describe the attacker clearly.', ['shaken', 'polite', 'wealthy', 'curious'], 0, 'shaken = ตกใจ ขวัญเสีย (จึงเล่าไม่ชัด)') },
    { type: 'gap', police: true, ...mc('Officers put a ___ around the area to keep the public away from the scene.', ['cordon', 'budget', 'ceremony', 'schedule'], 0, 'cordon = แนวกั้นพื้นที่ (เทปกั้นที่เกิดเหตุ)') },
    { type: 'gap', police: true, ...mc('The suspect was released because the police could not ___ that he was involved.', ['prove', 'wonder', 'allow', 'suggest'], 0, 'prove = พิสูจน์ (พิสูจน์ไม่ได้จึงต้องปล่อยตัว)') },
    { type: 'gap', police: true, ...mc('Tourists should ___ a lost passport to the nearest police station.', ['report', 'deliver', 'obtain', 'explain'], 0, 'report a lost passport = แจ้งพาสปอร์ตหาย') },
    { type: 'gap', police: true, ...mc('The officer remained ___ even when the man started shouting at him.', ['calm', 'empty', 'loose', 'rare'], 0, 'remain calm = ยังคงสงบ') },
    { type: 'gap', police: true, ...mc('Police are ___ the cause of the fire at the warehouse.', ['investigating', 'entertaining', 'celebrating', 'decorating'], 0, 'investigate = สืบสวน หาสาเหตุ') },
    { type: 'gap', police: true, ...mc('The new law ___ drivers from using mobile phones while driving.', ['prohibits', 'permits', 'encourages', 'requires'], 0, 'prohibit … from V-ing = ห้าม (permit/encourage/require ไม่ใช้กับ from)') },
    { type: 'gap', police: true, ...mc('The two officers worked closely together and ___ information throughout the investigation.', ['shared', 'wasted', 'hid', 'lost'], 0, 'ทำงานใกล้ชิดกัน = แบ่งปันข้อมูล (shared)') },
    { type: 'gap', police: true, ...mc('The bank alarm was ___ by mistake, so no officers were needed.', ['triggered', 'arrested', 'charged', 'convicted'], 0, 'trigger an alarm = ทำให้สัญญาณเตือนดัง') },
    { type: 'gap', police: false, ...mc('The company plans to ___ its services to other provinces next year.', ['expand', 'shrink', 'delay', 'cancel'], 0, 'expand … to = ขยาย (บริการ) ไปยัง') },
    { type: 'gap', police: false, ...mc('Please read the instructions ___ before you start the test.', ['carefully', 'heavily', 'nearly', 'widely'], 0, 'read carefully = อ่านอย่างละเอียด') },
    { type: 'gap', police: false, ...mc('The museum is ___ to visitors every day except Monday.', ['open', 'absent', 'equal', 'aware'], 0, 'be open to visitors = เปิดให้เข้าชม') },
    { type: 'gap', police: false, ...mc('She has a strong ___ for helping people, so she wants to become a nurse.', ['passion', 'pressure', 'habit', 'fashion'], 0, 'a passion for = ความหลงใหล ความรัก (ในการช่วยคน)') },
    { type: 'gap', police: false, ...mc('The heavy traffic caused a long ___ on the motorway.', ['delay', 'distance', 'height', 'purpose'], 0, 'cause a delay = ทำให้ล่าช้า') },
    { type: 'gap', police: false, ...mc('The government will ___ new measures to reduce air pollution.', ['introduce', 'arrive', 'happen', 'belong'], 0, 'introduce measures = นำมาตรการใหม่มาใช้ (ตัวเลือกอื่นเป็นกริยาที่ไม่มีกรรม)') },
    { type: 'gap', police: false, ...mc('Students must ___ their assignments by Friday at noon.', ['submit', 'attend', 'remain', 'occur'], 0, 'submit an assignment = ส่งงาน') },
    { type: 'gap', police: false, ...mc('Doctors say regular exercise can ___ the risk of heart disease, so they recommend it.', ['reduce', 'increase', 'behave', 'consist'], 0, 'แพทย์แนะนำ = ช่วยลดความเสี่ยง (reduce the risk)') },
  ],

  reading: [
    { type: 'short', police: true, title: 'Notice',
      text: 'NOTICE TO ALL VISITORS — Tourist Police Service Point. Open daily 08:00–20:00. We can help with lost property, reports of theft or fraud, and directions. For emergencies after 20:00, call 1155 (English available 24 hours). Please bring your passport or a copy when making a report.',
      qs: [
        mc('When can visitors use the service point?', ['Every day from 8 a.m. to 8 p.m.', 'Only on weekdays', '24 hours a day', 'Only after 8 p.m.'], 0, '"Open daily 08:00–20:00" = เปิดทุกวัน 8 โมงเช้าถึง 2 ทุ่ม (สายด่วน 1155 ต่างหากที่ 24 ชั่วโมง)'),
        mc('What should visitors bring when they make a report?', ['Their passport or a copy of it', 'A photo of the thief', 'A receipt from their hotel', 'A completed police form'], 0, 'ประกาศบอกให้นำพาสปอร์ตหรือสำเนามาด้วย ("Please bring your passport or a copy")')] },
    { type: 'short', police: false, title: 'Email',
      text: 'Dear Ms Chen, Thank you for your order of 20 office chairs. Unfortunately, the model you selected is out of stock until 15 March. We can either deliver a similar model next week at the same price, or deliver your original choice once it is back in stock. Please let us know which option you prefer by Friday. Best regards, Tom Hale, Sales Department',
      qs: [
        mc('Why did Tom write this email?', ['To explain a delay and offer two choices', 'To ask Ms Chen for payment', 'To cancel her order', 'To advertise a new product'], 0, 'บอกว่าสินค้าหมด และเสนอทางเลือก 2 ทาง'),
        mc('What does Ms Chen need to do by Friday?', ['Choose one of the two options', 'Pay for the chairs', 'Return the chairs', 'Visit the shop'], 0, 'ต้องแจ้งภายในวันศุกร์ว่าเลือกทางไหน ("let us know which option you prefer by Friday")')] },
    { type: 'short', police: true, title: 'Advertisement',
      text: 'VOLUNTEER INTERPRETERS NEEDED. The Provincial Police are looking for volunteers who speak English, Chinese or Russian to help officers communicate with foreign visitors during the high season (November–February). Volunteers will work up to two shifts a week and receive free training. Applicants must be at least 20 years old. No previous experience is required.',
      qs: [
        mc('What is the purpose of this advertisement?', ['To find people to help with communication', 'To hire new police officers', 'To sell language courses', 'To welcome foreign tourists'], 0, 'หาอาสาสมัครล่ามช่วยตำรวจสื่อสารกับนักท่องเที่ยว'),
        mc('Which statement is true?', ['Applicants do not need experience', 'Volunteers must work every day', 'Volunteers pay for their training', 'The work continues all year'], 0, '"No previous experience is required" (ทำงานไม่เกิน 2 กะ/สัปดาห์ อบรมฟรี เฉพาะ พ.ย.–ก.พ.)')] },
    { type: 'short', police: false, title: 'Notice',
      text: 'Due to maintenance work, the north entrance of City Hospital will be closed from 1 to 7 June. Patients and visitors should use the east entrance on Rama Road. Wheelchairs are available at the information desk. We apologise for any inconvenience.',
      qs: [
        mc('What will happen from 1 to 7 June?', ['One of the hospital entrances will be closed', 'The hospital will be closed', 'Rama Road will be repaired', 'New wheelchairs will arrive'], 0, 'ปิดเฉพาะทางเข้าทิศเหนือ'),
        mc('Where can patients get a wheelchair?', ['At the information desk', 'At the north entrance', 'On Rama Road', 'In the car park'], 0, 'มีรถเข็นให้ที่โต๊ะประชาสัมพันธ์ (information desk)')] },
    { type: 'long', police: true, title: 'Body-worn cameras',
      text: [
        'Over the past decade, police forces in many countries have begun to equip officers with small cameras worn on the uniform. Supporters argue that the devices provide an objective record of what happens during an encounter, which can be valuable evidence in court. They also claim that both officers and members of the public tend to behave more calmly when they know they are being recorded.',
        'Early studies seemed to confirm these benefits. In several cities, complaints against officers fell sharply in the first year after cameras were introduced. However, later and larger studies have produced more mixed results. Some found little difference in the use of force between officers with cameras and those without, suggesting that the early improvements may have been partly due to the attention that new programmes receive.',
        'There are also practical concerns. Recording, storing and reviewing thousands of hours of video is expensive, and forces must decide how long recordings are kept and who may watch them. Privacy is a further issue, because cameras may record victims, witnesses or people inside their own homes. Without clear rules, critics warn, a tool intended to increase public scrutiny of the police could instead become a way of watching the public.',
        'Most researchers now agree that cameras are neither a complete solution nor a waste of money. Their value appears to depend on how they are used: whether officers must switch them on during every encounter, whether recordings are reviewed fairly, and whether the public can trust that footage will not be misused. In other words, the technology is only as effective as the policies that surround it.'].join('\n\n'),
      qs: [
        mc('What is the main idea of the passage?', ['The value of body cameras depends on the rules for using them', 'Body cameras have greatly reduced crime', 'Body cameras are too expensive to use', 'Most officers refuse to wear cameras'], 0, 'Main idea อยู่ย่อหน้าสุดท้าย: ประโยชน์ขึ้นกับนโยบายการใช้'),
        mc('According to the passage, what did early studies find?', ['Complaints against officers dropped', 'Officers used more force', 'Cameras often stopped working', 'Courts refused to accept video'], 0, 'ย่อหน้า 2: ปีแรกเรื่องร้องเรียนตำรวจลดลงมาก ("complaints against officers fell sharply")'),
        mc('The word "scrutiny" in paragraph 3 is closest in meaning to', ['careful examination', 'support', 'fear', 'payment'], 0, 'Vocabulary in context: scrutiny = การตรวจสอบอย่างละเอียด'),
        mc('What can be inferred about the early improvements?', ['They may not have been caused only by the cameras', 'They continued in every later study', 'They were reported only by critics', 'They appeared in the second year'], 0, 'Inference: ผู้เขียนบอกว่าอาจเกิดจาก "ความสนใจที่โครงการใหม่ได้รับ" ส่วนหนึ่ง'),
        mc("The writer's attitude toward body cameras is best described as", ['balanced', 'strongly opposed', 'enthusiastic', 'uninterested'], 0, 'Tone: เสนอทั้งข้อดีและข้อกังวล และสรุปว่า "ไม่ใช่ทางออกทั้งหมด และไม่ใช่การเสียเงินเปล่า" = เป็นกลาง')] },
    { type: 'long', police: false, title: 'The four-day week',
      text: [
        'In recent years, a number of companies have experimented with a four-day working week, in which employees work fewer hours for the same pay. The idea is not new, but interest has grown as organisations look for ways to reduce stress and keep skilled staff.',
        'Results from trials in several countries have been encouraging. Many participating companies reported that productivity stayed the same or even rose slightly, while staff took fewer sick days. Employees said they had more time for family, exercise and study, and a large majority wanted the arrangement to continue after the trial ended.',
        'The trials also produced some unexpected findings. Several managers said that meetings became shorter and more focused, because teams knew they had less time. Others noticed that staff were more willing to share tasks and cover for colleagues, since everyone wanted the shorter week to succeed.',
        'Nevertheless, the model does not suit every workplace. Hospitals, schools and emergency services must provide cover every day, so reducing hours often means hiring more people, which raises costs. Some managers also worry that the gains seen in trials may fade once the novelty wears off, or that staff will simply try to squeeze five days of work into four, creating a different kind of pressure.',
        'For these reasons, experts suggest that companies should not simply copy the idea. Instead, they recommend starting with a limited trial, measuring results carefully, and adjusting the design to fit the nature of the work. A four-day week, they argue, is less a single policy than a set of choices about how work is organised.'].join('\n\n'),
      qs: [
        mc('What is the main idea of the passage?', ['A four-day week can work but needs careful planning', 'Every company should adopt a four-day week', 'A four-day week always reduces pay', 'Four-day week trials have failed everywhere'], 0, 'ผลทดลองดี แต่ไม่เหมาะทุกที่ ต้องทดลองและปรับให้เข้ากับงาน'),
        mc('What did employees in the trials report?', ['Having more time for personal activities', 'Earning more money', 'Working longer hours', 'Taking more sick days'], 0, 'พนักงานบอกว่ามีเวลาให้ครอบครัว ออกกำลังกาย และเรียนมากขึ้น'),
        mc('The word "novelty" in paragraph 4 is closest in meaning to', ['newness', 'difficulty', 'payment', 'tiredness'], 0, 'novelty = ความแปลกใหม่ (once the novelty wears off = พอความใหม่หมดไป)'),
        mc('Why might hospitals find a four-day week difficult?', ['They need staff available every day', 'Their staff do not want it', 'They are closed at weekends', 'They cannot measure productivity'], 0, '"must provide cover every day" ต้องมีคนทำงานทุกวัน'),
        mc("How would you describe the writer's tone?", ['cautiously positive', 'angry', 'humorous', 'completely negative'], 0, 'เห็นข้อดีจากผลทดลอง แต่เตือนให้ระวัง = บวกอย่างระมัดระวัง')] },
  ],
};

// ---------- building a practice set ----------
function rng(seed) {
  let s = (Math.floor(seed * 2 ** 31) || 1) >>> 0;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 2 ** 24; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const unitQs = (u) => (u.qs ? u.qs : [u]);

// Error-identification item → the four underlined parts and the sentence pieces around them.
export function errorParts(s) {
  const pieces = [], marks = [];
  let rest = s;
  const re = /\{([^}]+)\}/;
  let m;
  while ((m = re.exec(rest))) {
    pieces.push(rest.slice(0, m.index));
    marks.push(m[1]);
    rest = rest.slice(m.index + m[0].length);
  }
  pieces.push(rest);
  return { pieces, marks };
}

// A set of about SET_SIZE questions from one part, about 40% in policing contexts.
// Returns [{ unit, questions: [{ q, options, answer, why, police, n }] }] with options shuffled
// (error items keep A–D in sentence order).
export function buildSet(part, seed = Math.random(), size = SET_SIZE) {
  const r = rng(seed);
  const units = shuffle(BANK[part] || [], r);
  const wantPolice = Math.round(size * POLICE_SHARE);
  const picked = [];
  let total = 0, police = 0;
  const caps = TYPE_CAP[part] || {}, used = {};
  const capped = (u) => caps[u.type] != null && (used[u.type] || 0) + unitQs(u).length > caps[u.type];
  const take = (u) => { picked.push(u); total += unitQs(u).length; used[u.type] = (used[u.type] || 0) + unitQs(u).length; if (u.police) police += unitQs(u).length; };
  // First pass keeps the police share; the second fills what is left.
  for (const u of units) {
    const n = unitQs(u).length;
    if (total + n > size || capped(u)) continue;
    const slack = n > 1 ? 1 : 0;   // a dialogue or passage may go one question over
    if (u.police ? police + n > wantPolice + slack : (total - police) + n > size - wantPolice + slack) continue;
    take(u);
  }
  for (const u of units) if (!picked.includes(u) && total + unitQs(u).length <= size && !capped(u)) take(u);
  let n = 0;
  return picked.map((u) => ({
    unit: u,
    questions: unitQs(u).map((q) => {
      n += 1;
      if (u.type === 'error') {
        const { marks } = errorParts(u.s);
        return { n, q: u.s, options: marks, answer: u.answer, why: `${u.why} (แก้เป็น "${u.fix}")`, police: !!u.police, error: true };
      }
      const order = shuffle(q.options.map((_, i) => i), r);
      return { n, q: q.q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer), why: q.why, police: !!u.police };
    }),
  }));
}

export const setQuestions = (set) => set.flatMap((g) => g.questions);
export function scoreSet(set, answers) {
  const qs = setQuestions(set);
  return { score: qs.filter((q, i) => answers[i] !== undefined && answers[i] !== null && answers[i] !== '' && Number(answers[i]) === q.answer).length, total: qs.length };
}
export const bankSize = (part) => (BANK[part] || []).reduce((s, u) => s + unitQs(u).length, 0);
export const policeShareOf = (part) => { const all = BANK[part] || []; const t = bankSize(part); return t ? all.filter((u) => u.police).reduce((s, u) => s + unitQs(u).length, 0) / t : 0; };
