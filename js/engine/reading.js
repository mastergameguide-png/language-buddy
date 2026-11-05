// IELTS Reading practice: short original passages written for this app (not taken from any test
// book), with the question types used in the real test, and an offline checker. Pure, no AI.
//
// Question types:
//   tfng — True / False / Not Given (answer: 'T' | 'F' | 'NG')
//   mc   — choose one option (answer: index)
//   gap  — complete with words from the passage; `max` words and/or one number (answer + accept)
// A short set is scored as raw marks only. The real test has 40 questions, so no band is shown.
import { checkListening } from './ielts.js';

export const TFNG = [['T', 'TRUE'], ['F', 'FALSE'], ['NG', 'NOT GIVEN']];

export const READING = [
  {
    id: 'mission', title: 'Working across languages', level: 'B1–B2', minutes: 15, theme: 'police',
    paragraphs: [
      'When a country sends police officers to serve in an international mission, they rarely work only with people from their own country. A single patrol team may include officers from four or five nations, each with its own training, habits and first language. In most missions, English is chosen as the shared working language, even though it is the mother tongue of only a small number of the officers.',
      'Experienced mission leaders say that the biggest problems are seldom caused by grammar mistakes. Instead, trouble usually starts when officers are too embarrassed to say that they have not understood an instruction. A short radio message such as "Hold your position" can be misheard as "Hold the prisoner", and if nobody checks, a simple task can quickly become dangerous.',
      'For this reason, many missions now train officers in what they call "closed-loop" communication. The person who receives a message repeats the key information back, and the sender confirms that it is correct. The method was first used by pilots and hospital teams, and it adds only a few seconds to each exchange.',
      'Communication with the public is a different challenge. Local residents may not speak English at all, so officers often work with interpreters. Trainers advise officers to look at the person they are speaking to, not at the interpreter, and to use short sentences with one idea each. Small signs of respect, such as learning a greeting in the local language, are often remembered by communities long after the officers have gone home.',
    ],
    questions: [
      { type: 'tfng', q: 'English is the first language of most officers in international missions.', answer: 'F' },
      { type: 'tfng', q: 'Mission leaders believe grammar mistakes cause the most serious problems.', answer: 'F' },
      { type: 'tfng', q: 'Officers who use closed-loop communication make fewer arrests.', answer: 'NG' },
      { type: 'gap', max: 2, q: 'In closed-loop communication, the receiver repeats the ___ back to the sender.', answer: 'key information' },
      { type: 'gap', max: 2, q: 'Closed-loop communication was first used by pilots and ___.', answer: 'hospital teams' },
      { type: 'mc', q: 'According to trainers, when officers speak through an interpreter they should', options: ['speak slowly to the interpreter.', 'look at the person they are speaking to.', 'write their questions down first.'], answer: 1 },
      { type: 'mc', q: 'What does the writer say about learning a local greeting?', options: ['It is required by most missions.', 'It is often remembered by local people.', 'It replaces the need for an interpreter.'], answer: 1 },
    ],
  },
  {
    id: 'shifts', title: 'Sleep and shift work', level: 'B2', minutes: 15,
    paragraphs: [
      'Around one in five workers in industrial countries works outside normal daytime hours. Police officers, nurses, drivers and factory staff often change between day and night shifts, and their bodies pay a price. The human body has an internal clock, known as the circadian rhythm, which tells us to feel sleepy when it is dark and alert when it is light. Night work asks people to do the opposite.',
      'Researchers have found that people who sleep during the day get, on average, one to two hours less sleep than those who sleep at night. Daytime sleep is lighter and is more easily broken by noise, sunlight and family life. Over months and years, this lack of sleep has been linked to poor concentration, more road accidents on the way home, and a higher risk of heart disease.',
      'Not all shift patterns are equally harmful. Studies suggest that rotating "forwards" — from morning shifts to afternoon shifts to night shifts — is easier for the body than rotating backwards. Short blocks of two or three night shifts also appear to be better than long blocks of seven or more.',
      'Workers themselves can reduce some of the effects. Sleep experts recommend dark curtains, a cool bedroom and avoiding caffeine during the last four hours of a shift. A short nap of about twenty minutes before a night shift can also improve alertness. However, experts agree that individual habits cannot fully solve a problem that is built into the way work is organised.',
    ],
    questions: [
      { type: 'tfng', q: 'About twenty per cent of workers in industrial countries work outside normal daytime hours.', answer: 'T' },
      { type: 'tfng', q: 'People who sleep in the day usually sleep longer than people who sleep at night.', answer: 'F' },
      { type: 'tfng', q: 'Police officers suffer more from shift work than nurses do.', answer: 'NG' },
      { type: 'gap', max: 2, q: 'The body\'s internal clock is called the ___.', answer: 'circadian rhythm' },
      { type: 'gap', max: 2, q: 'Experts advise avoiding caffeine during the last ___ hours of a shift.', answer: 'four', accept: ['4'] },
      { type: 'mc', q: 'Which shift pattern appears to be easiest for the body?', options: ['Night, then afternoon, then morning shifts', 'Morning, then afternoon, then night shifts', 'Long blocks of seven night shifts'], answer: 1 },
      { type: 'mc', q: 'What is the writer\'s main point in the last paragraph?', options: ['Personal habits help, but cannot solve the whole problem.', 'Naps are more useful than dark curtains.', 'Shift work should be stopped completely.'], answer: 0 },
    ],
  },
  {
    id: 'trees', title: 'Cooling cities with trees', level: 'B1–B2', minutes: 12,
    paragraphs: [
      'On a hot afternoon, the centre of a large city can be several degrees warmer than the countryside around it. Scientists call this the "urban heat island" effect. Roads, roofs and car parks absorb heat during the day and release it slowly at night, so city streets stay warm long after sunset.',
      'One of the simplest ways to reduce this effect is to plant more trees. Trees cool the air in two ways. First, their leaves block sunlight before it reaches the ground. Second, they release water through their leaves, which cools the surrounding air in the same way that sweat cools the human skin. Measurements in several cities have shown that a street lined with large trees can be up to five degrees cooler than a similar street without them.',
      'However, planting trees in cities is not always easy. Underground pipes and cables leave little room for roots, and young trees need regular watering for their first three years. Some residents also complain that falling leaves block drains or that roots damage pavements.',
      'Planners now try to choose species that suit local conditions, and to plant them where they will give the most shade, such as along bus stops and school routes. Many cities have also started asking residents to adopt a young tree near their home and to water it during dry weather.',
      'Supporters of street trees point out that the benefits go beyond cooler air. Shaded streets encourage people to walk instead of driving short distances, and some studies have linked green streets with lower stress. Although planting and caring for a tree costs money, many local governments now see trees as part of the basic infrastructure of a city, in the same way as roads and drains.',
    ],
    questions: [
      { type: 'tfng', q: 'City centres can stay warmer than the countryside even after the sun goes down.', answer: 'T' },
      { type: 'tfng', q: 'Trees cool the air only by giving shade.', answer: 'F' },
      { type: 'tfng', q: 'Most residents are against planting trees in their street.', answer: 'NG' },
      { type: 'gap', max: 3, q: 'Scientists use the name the ___ effect for warmer city centres.', answer: 'urban heat island' },
      { type: 'gap', max: 1, q: 'A street with large trees can be up to ___ degrees cooler.', answer: 'five', accept: ['5'] },
      { type: 'gap', max: 2, q: 'Young trees need regular watering for their first ___.', answer: 'three years', accept: ['3 years'] },
      { type: 'mc', q: 'Where do planners now try to plant trees?', options: ['Only in parks', 'Where they give the most useful shade', 'Wherever there are no residents'], answer: 1 },
    ],
  },
  {
    id: 'cameras', title: 'Cameras or community officers?', level: 'B2–C1', minutes: 18, theme: 'police',
    paragraphs: [
      'Over the past twenty years, many cities have spent large sums on security cameras in streets, stations and shopping areas. Supporters argue that cameras discourage crime because people behave differently when they know they are being watched. Recorded images can also help police identify suspects and give courts clear evidence.',
      'Critics, however, point out that the results are mixed. Reviews of many studies have found that cameras reduce some crimes, such as theft from cars in car parks, much more than others, such as violent crime late at night, when people may be acting without thinking about the consequences. Cameras may also simply move crime to nearby streets that are not watched.',
      'There are also questions about privacy. In some countries, people worry that recordings may be kept for too long or shared without clear rules. Several governments have responded by limiting how long images can be stored and by requiring signs that tell the public where cameras are in use.',
      'Some police leaders believe that money would be better spent on officers who work in the same neighbourhood for several years. Such "community officers" get to know local shopkeepers, schools and families, and residents are more likely to share information with someone they recognise. In one long-running programme described by researchers, residents reported feeling safer within a year, although the number of recorded crimes changed little.',
      'In practice, most experts now argue that the question is not "cameras or officers" but how the two can work together. A camera can record what happened; it cannot calm an argument, comfort a victim or explain a decision to a worried parent. Those tasks still depend on people, and on their ability to communicate clearly and fairly.',
    ],
    questions: [
      { type: 'tfng', q: 'Supporters say people act differently when they know a camera is watching them.', answer: 'T' },
      { type: 'tfng', q: 'Cameras reduce all types of crime by the same amount.', answer: 'F' },
      { type: 'tfng', q: 'Community officers are paid more than other officers.', answer: 'NG' },
      { type: 'tfng', q: 'In the programme described, recorded crime fell sharply in the first year.', answer: 'F' },
      { type: 'gap', max: 2, q: 'Cameras appear to work well against theft from cars in ___.', answer: 'car parks' },
      { type: 'mc', q: 'Why are residents more likely to share information with community officers?', options: ['The officers offer rewards.', 'They recognise the officers.', 'The officers use cameras.'], answer: 1 },
      { type: 'mc', q: 'Which statement best matches the writer\'s conclusion?', options: ['Cameras should replace most officers.', 'Officers are always better than cameras.', 'Cameras and officers each do things the other cannot.'], answer: 2 },
    ],
  },
];

export const readingById = (id) => READING.find((r) => r.id === id) || null;

// "NO MORE THAN TWO WORDS AND/OR A NUMBER": up to `max` words, plus at most one number.
export function withinLimit(given, max) {
  const parts = String(given ?? '').trim().split(/\s+/).filter(Boolean);
  const numbers = parts.filter((p) => /^\d[\d.,:]*$/.test(p)).length;
  return numbers <= 1 && parts.length - numbers <= max;
}

export const limitText = (max) => `ไม่เกิน ${max} คำ และ/หรือ ตัวเลข 1 ตัว`;

// Grades one question: true / false. Gap answers over the word limit are wrong, as in the real test.
export function checkReading(q, given) {
  if (q.type === 'tfng') return String(given || '').toUpperCase() === q.answer;
  if (q.type === 'gap' && !withinLimit(given, q.max || 2)) return false;
  return checkListening(q, given);
}

export const scoreReading = (item, answers) => item.questions.filter((q, i) => checkReading(q, answers[i])).length;

export const answerText = (q) => (q.type === 'tfng' ? TFNG.find(([k]) => k === q.answer)[1] : q.type === 'mc' ? q.options[q.answer] : q.answer);
