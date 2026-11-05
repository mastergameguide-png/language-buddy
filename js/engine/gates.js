// Gate tests for the Lv. system (English). Original questions written for this app, checked
// offline: vocabulary, grammar, a short reading and listening (the sentence is read aloud by the
// device voice). Each test draws 4 vocabulary, 4 grammar, 2 reading and 2 listening questions.
// Pure: no DOM.

export const GATE_SHAPE = { vocab: 4, grammar: 4, reading: 2, listening: 2 };
export const SECTION_TH = { vocab: "คำศัพท์", grammar: "ไวยากรณ์", reading: "การอ่าน", listening: "การฟัง" };

// mc: { q, options, answer (index) }. reading: { text, qs: [mc, mc] }. listening: { say, q, options, answer }.
export const BANK = {
  A2: {
    vocab: [
      { q: "I'm hungry. Let's get something to ___.", options: ["eat", "drink", "sleep", "wear"], answer: 0 },
      { q: "The shop is ___ on Sundays, so we can't buy anything.", options: ["closed", "empty", "busy", "cheap"], answer: 0 },
      { q: "My brother is a ___. He works in a hospital.", options: ["nurse", "pilot", "farmer", "chef"], answer: 0 },
      { q: "It's raining. Take an ___.", options: ["umbrella", "ticket", "envelope", "oven"], answer: 0 },
      { q: "Can you ___ me the salt, please?", options: ["pass", "say", "spend", "lend"], answer: 0 },
      { q: "I usually ___ the bus to work.", options: ["take", "make", "do", "go"], answer: 0 },
      { q: "This bag is too ___. I can't carry it.", options: ["heavy", "short", "quiet", "young"], answer: 0 },
      { q: "Turn ___ at the traffic lights and the bank is on your right.", options: ["left", "under", "over", "across"], answer: 0 },
    ],
    grammar: [
      { q: "She ___ to work every day.", options: ["walks", "walk", "walking", "is walk"], answer: 0 },
      { q: "We ___ to the beach last weekend.", options: ["went", "go", "gone", "goes"], answer: 0 },
      { q: "There ___ two chairs in the room.", options: ["are", "is", "be", "am"], answer: 0 },
      { q: "I'm ___ than my sister.", options: ["taller", "more tall", "tallest", "the tall"], answer: 0 },
      { q: "___ you like some coffee?", options: ["Would", "Do", "Are", "Will"], answer: 0 },
      { q: "He can't come because he ___ dinner right now.", options: ["is cooking", "cooks", "cook", "cooked"], answer: 0 },
      { q: "I have ___ apple and a banana.", options: ["an", "a", "the", "some"], answer: 0 },
      { q: "My birthday is ___ May.", options: ["in", "on", "at", "to"], answer: 0 },
    ],
    reading: [
      { text: "Hi Mai, I can't meet you at the cinema at six. My train is late and I will arrive at seven. Can we see the later film at half past seven? I will buy the tickets. — Tom",
        qs: [
          { q: "Why is Tom writing?", options: ["He will be late.", "He is ill.", "He lost the tickets.", "The cinema is closed."], answer: 0 },
          { q: "What will Tom do?", options: ["Buy the tickets", "Cook dinner", "Take a taxi", "Watch the six o'clock film"], answer: 0 },
        ] },
      { text: "City Library. Open Monday to Friday 9:00 to 18:00, Saturday 10:00 to 14:00. Closed on Sunday. You can borrow up to five books for three weeks. Children under 12 must come with an adult.",
        qs: [
          { q: "When does the library close on Saturday?", options: ["14:00", "18:00", "10:00", "It is closed."], answer: 0 },
          { q: "How many books can you borrow?", options: ["Five", "Three", "Twelve", "As many as you like"], answer: 0 },
        ] },
    ],
    listening: [
      { say: "The train to the airport leaves at ten fifteen from platform three.", q: "When does the train leave?", options: ["10:15", "10:50", "3:15", "10:30"], answer: 0 },
      { say: "I'd like a large coffee with milk, but no sugar, please.", q: "What does the speaker want?", options: ["Coffee with milk, no sugar", "Tea with sugar", "Coffee with sugar, no milk", "A small coffee"], answer: 0 },
      { say: "Sorry, the museum is closed today. Please come back tomorrow morning.", q: "What should the listener do?", options: ["Come back tomorrow", "Wait outside", "Buy a ticket now", "Go to another museum"], answer: 0 },
      { say: "My phone number is zero eight one, two four six, five nine three seven.", q: "What is the number?", options: ["081 246 5937", "081 264 5937", "018 246 5937", "081 246 9537"], answer: 0 },
    ],
  },
  B1: {
    vocab: [
      { q: "I need to ___ an appointment with the dentist.", options: ["make", "do", "take", "give"], answer: 0 },
      { q: "The flight was ___ because of the storm.", options: ["cancelled", "returned", "refused", "removed"], answer: 0 },
      { q: "She is very ___. She always tells the truth.", options: ["honest", "lazy", "nervous", "selfish"], answer: 0 },
      { q: "Could you ___ the meeting until next week?", options: ["put off", "put on", "take off", "look after"], answer: 0 },
      { q: "If you have any problems, don't ___ to call me.", options: ["hesitate", "remind", "prevent", "manage"], answer: 0 },
      { q: "The police officer asked the driver to show his ___ licence.", options: ["driving", "drive", "driven", "driver"], answer: 0 },
      { q: "I'm ___ forward to seeing you again.", options: ["looking", "waiting", "hoping", "seeing"], answer: 0 },
      { q: "Prices have ___ a lot this year; everything is more expensive.", options: ["risen", "raised", "grown up", "lifted"], answer: 0 },
    ],
    grammar: [
      { q: "I ___ here since 2020.", options: ["have lived", "live", "am living", "lived"], answer: 0 },
      { q: "If it rains tomorrow, we ___ at home.", options: ["will stay", "would stay", "stayed", "stay will"], answer: 0 },
      { q: "While I ___ TV, the phone rang.", options: ["was watching", "watched", "am watching", "have watched"], answer: 0 },
      { q: "This is the man ___ helped me yesterday.", options: ["who", "which", "whose", "what"], answer: 0 },
      { q: "You ___ wear a seat belt. It's the law.", options: ["must", "might", "would", "could"], answer: 0 },
      { q: "The report ___ by the team last Friday.", options: ["was written", "wrote", "is writing", "has write"], answer: 0 },
      { q: "I'm not used to ___ up so early.", options: ["getting", "get", "got", "be getting"], answer: 0 },
      { q: "She asked me where ___.", options: ["I lived", "did I live", "do I live", "I do live"], answer: 0 },
    ],
    reading: [
      { text: "From 1 December, visitors to the National Park must book a time slot online before they arrive. The park has become so popular that the car parks were full by 9 a.m. on most weekends last year. Booking is free, but places are limited to 2,000 people a day. Visitors who arrive by bus do not need to book.",
        qs: [
          { q: "Why has the park introduced booking?", options: ["Too many people were visiting.", "The park needs more money.", "The buses have stopped.", "The car parks are closing."], answer: 0 },
          { q: "Who does NOT need to book?", options: ["People who come by bus", "People who come on weekdays", "Children", "People who arrive before 9 a.m."], answer: 0 },
        ] },
      { text: "Dear Ms Lee, Thank you for applying for the position of receptionist. We would like to invite you to an interview on Tuesday at 2 p.m. Please bring a copy of your ID card and any certificates. If this time is not convenient, please reply by Friday so that we can arrange another day.",
        qs: [
          { q: "What is the main purpose of the letter?", options: ["To invite Ms Lee to an interview", "To offer Ms Lee the job", "To ask for a reference", "To cancel an interview"], answer: 0 },
          { q: "What should Ms Lee do if she cannot come on Tuesday?", options: ["Reply by Friday", "Phone on Tuesday", "Send her certificates", "Come on Friday instead"], answer: 0 },
        ] },
    ],
    listening: [
      { say: "Because of the heavy rain, today's football match has been moved from Saturday afternoon to Sunday morning.", q: "When will the match be played?", options: ["Sunday morning", "Saturday afternoon", "Saturday morning", "It has been cancelled."], answer: 0 },
      { say: "If you've lost something on the train, please go to the information desk next to the main entrance, not the ticket office.", q: "Where should people go if they lose something?", options: ["The information desk", "The ticket office", "The main platform", "The police station"], answer: 0 },
      { say: "I was going to drive, but my car is being repaired, so I'll take the bus and meet you there at eight.", q: "Why is the speaker taking the bus?", options: ["The car is being repaired.", "The bus is faster.", "There is no parking.", "The speaker cannot drive."], answer: 0 },
      { say: "The course costs three hundred dollars, but students get twenty per cent off if they register before the end of the month.", q: "Who gets a lower price?", options: ["Students who register early", "All students", "People who pay in cash", "People who register late"], answer: 0 },
    ],
  },
  B2: {
    vocab: [
      { q: "The new law had a significant ___ on road safety.", options: ["impact", "affect", "result", "cause"], answer: 0 },
      { q: "The witness's story was not ___ with the video evidence.", options: ["consistent", "constant", "considerate", "continuous"], answer: 0 },
      { q: "We need to ___ the problem before it gets worse.", options: ["tackle", "attack", "handle on", "carry"], answer: 0 },
      { q: "The suspect ___ any involvement in the robbery.", options: ["denied", "refused", "rejected", "objected"], answer: 0 },
      { q: "Her proposal was ___ by the committee, so the project can start.", options: ["approved", "proved", "improved", "provided"], answer: 0 },
      { q: "Reducing waste is a ___ goal, but it needs funding to work.", options: ["worthwhile", "worthless", "worthy of", "well-worn"], answer: 0 },
      { q: "The team managed to ___ the deadline despite the delays.", options: ["meet", "reach up", "achieve to", "make up"], answer: 0 },
      { q: "Crime rates have ___ steadily over the past decade.", options: ["declined", "descended", "dropped off to", "lowered down"], answer: 0 },
    ],
    grammar: [
      { q: "If I ___ about the traffic, I would have left earlier.", options: ["had known", "knew", "have known", "would know"], answer: 0 },
      { q: "By the time we arrived, the meeting ___.", options: ["had already started", "already started", "has already started", "was already start"], answer: 0 },
      { q: "Not only ___ late, but he also forgot the documents.", options: ["was he", "he was", "he is", "did he"], answer: 0 },
      { q: "The bridge, ___ was built in 1950, is now being repaired.", options: ["which", "that", "what", "where"], answer: 0 },
      { q: "I'd rather you ___ anyone about this yet.", options: ["didn't tell", "don't tell", "won't tell", "not to tell"], answer: 0 },
      { q: "She is said ___ the best officer in the unit.", options: ["to be", "being", "that she is", "be"], answer: 0 },
      { q: "___ the bad weather, the event went ahead as planned.", options: ["Despite", "Although", "However", "Even"], answer: 0 },
      { q: "You ___ have called; I was worried about you.", options: ["should", "must", "can", "would rather"], answer: 0 },
    ],
    reading: [
      { text: "Many companies now allow staff to work from home two or three days a week. Supporters say this saves commuting time and improves concentration. However, a recent survey of managers found that new employees who work mostly from home take longer to learn how the organisation works, because they miss the informal conversations that happen in an office. Several firms have therefore asked new staff to spend their first three months in the office.",
        qs: [
          { q: "According to the survey, what problem do some new employees have?", options: ["They learn how the organisation works more slowly.", "They spend too long commuting.", "They cannot concentrate at home.", "They do not want to work from home."], answer: 0 },
          { q: "What have several firms decided to do?", options: ["Ask new staff to work in the office at first", "Stop working from home completely", "Pay staff for commuting time", "Hire more managers"], answer: 0 },
        ] },
      { text: "Traffic police in one city tried a simple experiment. Instead of only giving fines, officers stopped drivers who were obeying the rules and gave them a small voucher for coffee. Over six months, the number of drivers stopping fully at red lights rose noticeably. Researchers say that rewards seem to work best when they are unexpected, and that fines remain necessary for dangerous behaviour.",
        qs: [
          { q: "What was different about the experiment?", options: ["Officers rewarded good drivers.", "Fines were made higher.", "Red lights were removed.", "Drivers paid for coffee."], answer: 0 },
          { q: "What do the researchers believe about fines?", options: ["They are still needed for dangerous driving.", "They should be replaced by rewards.", "They do not change behaviour.", "They work best when unexpected."], answer: 0 },
        ] },
    ],
    listening: [
      { say: "Although the proposal was popular with residents, the council rejected it, mainly because the cost of maintenance would have been far higher than expected.", q: "Why was the proposal rejected?", options: ["It would cost too much to maintain.", "Residents did not like it.", "It was submitted too late.", "It was not safe."], answer: 0 },
      { say: "Applicants who have already submitted their forms don't need to do anything else; we'll contact them directly once the results are ready.", q: "What should applicants who have sent their forms do?", options: ["Wait to be contacted", "Send the forms again", "Phone the office", "Collect the results"], answer: 0 },
      { say: "I wouldn't say the training was easy, but looking back, it was the most useful thing I did in my first year.", q: "How does the speaker feel about the training now?", options: ["It was difficult but very useful.", "It was easy and useful.", "It was a waste of time.", "It was too long."], answer: 0 },
      { say: "Instead of building another car park, the city plans to improve bus services, which it believes will reduce congestion more effectively.", q: "What does the city plan to do?", options: ["Improve bus services", "Build a car park", "Close the city centre", "Raise parking prices"], answer: 0 },
    ],
  },
  C1: {
    vocab: [
      { q: "The minister's remarks were widely ___ as an attempt to avoid responsibility.", options: ["interpreted", "translated", "explained", "expressed"], answer: 0 },
      { q: "The investigation was ___ by a lack of reliable witnesses.", options: ["hampered", "hindered from", "prevented to", "delayed off"], answer: 0 },
      { q: "There is a growing ___ that the current system is not working.", options: ["consensus", "consent", "concern for", "conscience"], answer: 0 },
      { q: "His explanation was so ___ that nobody could follow it.", options: ["convoluted", "concise", "coherent", "candid"], answer: 0 },
      { q: "The policy had several ___ consequences that nobody had predicted.", options: ["unintended", "unwilling", "uninterested", "unaware"], answer: 0 },
      { q: "The officer showed great ___ in a very tense situation.", options: ["composure", "composition", "compliance", "complacency"], answer: 0 },
      { q: "The two reports ___ on several key points, which raised questions.", options: ["diverged", "diverted", "deviated from", "departed"], answer: 0 },
      { q: "The evidence is ___ at best; it cannot be used in court.", options: ["circumstantial", "substantial", "conclusive", "fundamental"], answer: 0 },
    ],
    grammar: [
      { q: "Had the alarm ___ earlier, the damage could have been avoided.", options: ["been raised", "raised", "be raised", "been rising"], answer: 0 },
      { q: "Under no circumstances ___ leave the building during the drill.", options: ["should staff", "staff should", "staff must not", "do staff"], answer: 0 },
      { q: "It's high time the government ___ action on this issue.", options: ["took", "takes", "will take", "has taken"], answer: 0 },
      { q: "___ the volume of complaints, a review is clearly needed.", options: ["Given", "Giving", "To give", "Gave"], answer: 0 },
      { q: "Little ___ that the decision would cause such controversy.", options: ["did they realise", "they realised", "they did realise", "realised they"], answer: 0 },
      { q: "The suspect is believed ___ the country last week.", options: ["to have left", "to leave", "leaving", "having left to"], answer: 0 },
      { q: "Were the plan ___ approved, work would begin in March.", options: ["to be", "be", "being", "been"], answer: 0 },
      { q: "So complex ___ that it took months to resolve.", options: ["was the case", "the case was", "the case is", "it was the case"], answer: 0 },
    ],
    reading: [
      { text: "Predictive policing software promises to direct officers to places where crime is most likely to occur. Critics argue, however, that because such systems learn from past arrest data, they may simply send more officers to neighbourhoods that were already heavily policed, producing more arrests there and appearing to confirm the original prediction. Some forces now publish how their systems work and allow independent audits, which supporters say is essential if the public is to trust the results.",
        qs: [
          { q: "What is the critics' main concern?", options: ["The software may repeat existing patterns of policing.", "The software is too expensive.", "Officers refuse to use the software.", "The software ignores past data."], answer: 0 },
          { q: "Why do some forces allow independent audits?", options: ["To build public trust", "To reduce the number of officers", "To make arrests faster", "To keep the system secret"], answer: 0 },
        ] },
      { text: "Research on second-language learning consistently finds that learners who speak regularly, even with frequent mistakes, progress faster than those who wait until they feel ready. The reason appears to be that speaking forces learners to notice gaps in what they know, which they then try to fill. Anxiety about accent, on the other hand, tends to reduce the amount people speak, and therefore slows this process down.",
        qs: [
          { q: "Why does regular speaking help, according to the text?", options: ["It makes learners notice what they do not know.", "It removes all mistakes.", "It improves accent first.", "It replaces reading."], answer: 0 },
          { q: "What effect does anxiety about accent have?", options: ["People speak less, so they progress more slowly.", "People speak more carefully and faster.", "It has no real effect.", "It improves grammar."], answer: 0 },
        ] },
    ],
    listening: [
      { say: "While the figures suggest a modest improvement, it would be premature to conclude that the new strategy is working, given how short the trial period was.", q: "What is the speaker's view?", options: ["It is too early to judge the strategy.", "The strategy has clearly failed.", "The strategy is clearly working.", "The trial was too long."], answer: 0 },
      { say: "What surprised the researchers wasn't the number of complaints, which they'd expected, but the fact that most came from people who had never contacted the service before.", q: "What surprised the researchers?", options: ["Most complaints came from first-time users.", "The number of complaints was high.", "There were no complaints.", "Regular users complained most."], answer: 0 },
      { say: "Rather than cutting the training budget, which would save money in the short term, the department has chosen to reduce overtime instead.", q: "How will the department save money?", options: ["By reducing overtime", "By cutting training", "By hiring fewer staff", "By closing an office"], answer: 0 },
      { say: "The committee accepted the recommendations in principle, though it stopped short of committing any funding until a full assessment has been carried out.", q: "What did the committee decide?", options: ["To agree in principle but not fund it yet", "To fund it immediately", "To reject the recommendations", "To cancel the assessment"], answer: 0 },
    ],
  },
};

// Simple seeded random, so a test can be rebuilt from its seed (and tested).
function rng(seed) {
  let s = (Math.floor(seed * 2 ** 31) || 1) >>> 0;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 2 ** 24; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Options in a new order; `answer` follows the right option.
function mix(q, r) {
  const order = shuffle(q.options.map((_, i) => i), r);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

// Builds one test: [{ section, q, options, answer, say?, text? }] in section order.
export function buildGate(tier, seed = Math.random()) {
  const b = BANK[tier] || BANK.B1;
  const r = rng(seed);
  const out = [];
  for (const q of shuffle(b.vocab, r).slice(0, GATE_SHAPE.vocab)) out.push({ section: 'vocab', ...mix(q, r) });
  for (const q of shuffle(b.grammar, r).slice(0, GATE_SHAPE.grammar)) out.push({ section: 'grammar', ...mix(q, r) });
  const passage = b.reading[Math.floor(r() * b.reading.length)];
  for (const q of passage.qs.slice(0, GATE_SHAPE.reading)) out.push({ section: 'reading', text: passage.text, ...mix(q, r) });
  for (const q of shuffle(b.listening, r).slice(0, GATE_SHAPE.listening)) out.push({ section: 'listening', ...mix(q, r) });
  return out;
}

export function scoreGate(test, answers) {
  const by = {};
  let score = 0;
  test.forEach((q, i) => {
    const ok = Number(answers[i]) === q.answer && answers[i] !== undefined && answers[i] !== null && answers[i] !== '';
    by[q.section] ||= { score: 0, total: 0 };
    by[q.section].total += 1;
    if (ok) { by[q.section].score += 1; score += 1; }
  });
  return { score, total: test.length, by };
}
