# Changelog

## 🏅 Lv. system with gate tests (2026-11-06)

The owner chose these options: game-style Lv. with a gate test every 5 Lv., tests checked offline, and English first.

- **XP from measured practice only** (`js/engine/levels.js`). XP is worked out each time from the existing per-day stats and IELTS attempts, so it is never stored or guessed.
  - Active time: 1 XP a minute, capped at 60 a day.
  - Messages: 2 XP each, capped at 100 a day.
  - Reviews: 1 XP each, capped at 50 a day.
  - Shadowing or listening sentences: 1 XP each, capped at 30 a day.
  - IELTS practice: 15 XP each, capped at 45 a day.
  - A practice day earns +10 XP, plus 2 XP × days in a row, counting up to 10 days.
- **Lv. curve:** Lv. n → n+1 needs 100 + 20 × (n−1) XP.
- **Gates every 5 Lv. (English only):**
  - The Lv. waits at the gate until the test is passed. XP earned meanwhile is kept, and the Lv. catches up as soon as the test is passed.
  - For other languages there are no gates for now.
- **Gate tests** (`js/engine/gates.js`, original questions, checked offline, no AI):
  - Each test has 12 questions: 4 vocabulary, 4 grammar, 2 reading (one short text) and 2 listening.
  - Listening uses the device voice and can be played twice. If the device has no voice, the sentence is shown instead.
  - Pass mark is 10/12. Three tries a day.
  - Each try draws a new set, and the options are shuffled.
  - Levels: A2 (Lv. 5), B1 (Lv. 10), B2 (Lv. 15), C1 (Lv. 20 and later).
- **Page `#levels` (🏅 Lv. ของฉัน)** shows:
  - the Lv. badge and XP bar;
  - real totals: time, messages, streak, best streak, practice days;
  - where every XP came from, with the rules;
  - the last 5 test results.
- **Where to find it:** a Lv. strip on Home (taps through to the page) and a button on the Me page.
- **Saving and sync:**
  - `state.levels = { passed, tries }`, cleaned by `cleanLevels`.
  - Synced as `x:levels`. Merging keeps every passed gate and every try from both devices.
- **Tests:** `tests/levels.test.mjs`, 10 checks. They cover caps, streak bonus across a gap and a month end, the curve, gates, shuffled answers, scoring, merge and wiring.
- **Checked in the browser** at 390×844:
  - a failed try (0/12) and a passing try (11/12, Lv. 5 → 8);
  - the tries-left count;
  - ui-audit on the levels, home and me pages, in both themes: no low contrast, no unnamed controls, no sideways scroll;
  - exam page contrast at least 5.4:1.
- No change to the Worker, `js/ai.js` or `js/engine/prompt.js`. Three new files were added to `sw.js`.

## IELTS Speaking: sentence helper and random-question drill (2026-11-05)

The owner said other speaking apps get stuck on accent and pronunciation, which costs time that should go into forming sentences.

- **Note at the top of Speaking:** "แอปนี้ไม่ตรวจสำเนียงหรือการออกเสียง…". This was already true: the feedback prompt never judges pronunciation, and transcribed text can be edited before sending. The note just makes it visible.
- **💡 ตัวช่วยคิดประโยค (works offline, no AI):**
  - A short answer plan in Thai, one per part:
    - Part 1: answer, reason, own example.
    - Part 2: note 1–2 keywords per point, then go through the points in order.
    - Part 3: opinion, reason, example or comparison, then the other side.
  - Sentence starters that fit the question type: Do/Is…, Would you…, How often…, Why…, How…, What/Which…, Should….
  - "Let me think…" lines give time to think.
  - Tapping a starter adds its opening words to the answer box. The learner finishes the sentence by speaking or typing.
  - `speakingHints`, `starterText` and `NO_ACCENT_NOTE` are in `js/engine/ielts.js`.
- **🎲 สุ่มคำถาม (random drill):**
  - Picks a random question from Part 1, 2 or 3.
  - Starts a 1-minute thinking countdown, then up to 5 minutes of talking.
  - "พูดเสร็จแล้ว" stops early and also stops the microphone. "คำถามอื่น" draws a new random question.
  - Part 2 outside the drill keeps its 1 + 2 minutes.
  - `pickDrill`, `DRILL_THINK` and `DRILL_TALK` are in `js/engine/ielts.js`.
- **Tests:** `tests/speaking-help.test.mjs` (6 checks). Every Part 1/2/3 question gets a plan and starters with no repeats.
- **Checked in the browser** at 390×844: starter chips wrap, no sideways scroll, and contrast is at least 5.4:1 in the light theme. The ui-audit found no low-contrast or unnamed controls.
- No change to the Worker, `js/ai.js` or `js/engine/prompt.js`. No new file for `sw.js`.

## IELTS Reading, cadet course, exam timer and band calculator (2026-11-05)

These come from the owner's IELTS Session 1 handout (police cadet IELTS club). The handout was only used to see what the real test needs. Its passages and its listening task were not copied.

- **IELTS Reading (new tab "📖 Reading"):**
  - 4 original passages of 250–300 words each, in `js/engine/reading.js`. Two are police-themed: "Working across languages" and "Cameras or community officers?". The other two are "Sleep and shift work" and "Cooling cities with trees".
  - Each passage has 7 questions. Every passage mixes TRUE / FALSE / NOT GIVEN, gap completion and multiple choice, and paragraphs are lettered A, B, C…
  - Checked offline, no AI. A gap answer over the word limit ("NO MORE THAN TWO WORDS AND/OR A NUMBER") is marked wrong, as in the real test, and the app says why.
  - The raw score is saved as a `reading` attempt (like Listening). No band is shown, because the real test has 40 questions in 60 minutes.
- **Work-and-English content:**
  - Speaking Part 1 topic "Your career and English";
  - Part 2 card "Describe a person whose job helps to keep people safe", with Part 3 questions about the police and community trust;
  - two Task 2 essays: English for public-service workers, and cameras versus more officers.
- **Course "👮 ภาษาอังกฤษสำหรับนักเรียนนายร้อยตำรวจ":** 7 steps, using the existing police and emergency scenarios, the two police passages, Speaking Part 1, Writing Task 2 and review. A reading step only ticks when that exact passage is done (`stepDone` now checks `step.id`).
- **Exam-length countdown:**
  - Writing has a 20-minute timer for Task 1 and a 40-minute timer for Task 2; each reading passage has its own suggested time.
  - Only the clock text changes each second, so typing is not interrupted. Each clock belongs to its own task, so switching tasks never shows another task's time.
  - The timer stops when the page is left. When time is up, a message says that the real test would stop here.
- **Overall band calculator** (under the courses): pick the four skill bands. It shows the average and the overall band, rounded to the nearest half band (.25 rounds up to .5 and .75 up to the next whole band), using the existing `overallBand`. Nothing is saved.
- **Five IELTS tabs** wrap onto two rows on small phones.
- **Tests:** `tests/reading.test.mjs` (9 checks):
  - the passage bank, and that every gap answer is in its passage and within the word limit;
  - the word-limit rule and the checker;
  - the new content and the cadet course;
  - storing reading attempts;
  - band rounding;
  - the page wiring, including that the countdown does not redraw the page every second.
  - `sw.js` caches `js/engine/reading.js`.

No AI prompt, Worker or CSP change.

## IELTS Writing: attach essay photos (2026-11-05)

- **"แนบภาพเรียงความ" button on the Writing page:**
  - It takes `image/*`, up to 3 photos (one per page) of a handwritten or note-app essay.
  - Each page is resized in memory to 1600 px on the longer side and sent alone, so it fits the Worker's photo limit and counts once in `usage.photos`.
  - The text is put in the essay box with the note "ถอดจากภาพแล้ว กรุณาตรวจคำที่มี [?] และคำที่อ่านผิดก่อนส่งตรวจ".
  - Nothing is scored until the learner presses "ขอคำติชม (AI)". The Writing scoring is unchanged.
  - If the box already has text, the app asks before replacing it.
  - **One automatic retry:** a page that timed out (the AI is sometimes slow once and fast the next time) is sent once more by itself, and the button says "ลองหน้า 1/3 อีกครั้ง…". Quota, offline and size errors are not retried. If the retry also times out, the usual Thai message is shown.
- **Transcription prompt** (`TRANSCRIBE_PROMPT` in `engine/ielts.js`):
  - copy only what is written: no grammar fixes, no added or removed words, no interpreting;
  - `[?]` for each unreadable word;
  - JSON `{"text", "no_text"}`, because the Worker asks Gemini for JSON.
  - Photos always go to Gemini (existing Worker routing).
- **Errors in Thai:**
  - a PDF ("ตอนนี้รองรับเฉพาะภาพ ให้ส่งออกเป็นรูปภาพ (PNG/JPG) จาก Good Notes ก่อน");
  - more than 3 photos, a non-image file, or a file over 30 MB;
  - a photo that cannot be opened;
  - offline;
  - no text found;
  - a page that is probably blurry (more than 20% `[?]`);
  - some pages failed (the pages that worked are kept);
  - Gemini quota used up, and the photo too large (existing messages).
- **Photos are not stored:** they stay in local variables only. They are never put on app state, localStorage, sync or backups. Only the text is kept, as the usual local draft of that question.
- **One resize helper:** `preparePhoto` moved from `views/chat.js` to `util.js` (with `maxSide`, and a lower JPEG quality if the image is still too large). The chat photo button uses it unchanged at 1024 px.
- **New function in `ai.js`:** `askTranscribe(system, photo)`, approved by the owner. No other change to `ai.js`, and none to `engine/prompt.js`.
- **Settings:** today's usage line also shows the photo count ("รูป N"), as the chat quota line does.
- **Contrast fix:** the selected "Task 1 / Task 2" button was white on light purple (2.72:1) in the dark theme. It now uses the primary-button text colour.
- **Tests:** `tests/transcribe.test.mjs` (9 checks):
  - the prompt wording;
  - the file checks (3 photos max, PDF, non-image);
  - parsing (JSON, code fences, `no_text`, blurry);
  - the request shape and the photo counter;
  - no photo data in localStorage;
  - one shared resize helper;
  - transcription never triggers scoring;
  - only timeouts are retried, exactly once.
- **Real Gemini check (owner approved, 3 requests):** two computer-made pages in a handwriting-style font, with 8 deliberate mistakes. These were not real handwriting.
  - Clear page: exact, all 8 mistakes kept, 9.2 s.
  - Blurred and tilted page: the first try timed out at the Worker's 22 s limit; sent again, it came back in 4.7 s with all 8 mistakes kept, but it also included one crossed-out word. That is why the retry was added.

No Worker change (no redeploy needed), no CSP change, no new JS file.

## Thai font, simpler Settings, first-run guide, auto cache version (2026-11-05)

- **Thai font:** "Noto Sans Thai" (400/500/700, `display=swap`, with `preconnect`) from Google Fonts; the font stack is `"Noto Sans Thai", "Sarabun", system-ui, sans-serif`. The service worker keeps the font files in their own cache (`buddy-fonts-v1`, not removed on updates) and saves them at install, so Thai text keeps its font offline.
- **Settings in two parts:** "ทั่วไป" (language and level, voice speed, auto-send, notifications, profile, how corrections are shown, custom buddy, memory, theme, your data) and a collapsed "ขั้นสูง" `<details>` (server address, server password, AI choice, daily quota, D1 sync). Technical words are replaced with plain Thai (the original term stays in brackets) and every field has a short hint tied to it with `aria-describedby`. The Worker field is empty by default and says "กำลังใช้เซิร์ฟเวอร์เริ่มต้น" (the built-in server is still used when it is empty). The jump buttons open the advanced part before scrolling to it.
- **Tighter CSP:** `connect-src` is now `'self'`, the Worker (`language-buddy.mastergameguide.workers.dev`), Google Fonts and `localhost` (for `wrangler dev`), instead of any `https:`. `style-src` and `font-src` allow Google Fonts only. Using another Worker now needs its domain added to `connect-src` in `index.html` (Settings warns about this when saving).
- **Cache version from the commit:** `.github/workflows/pages.yml` runs the tests, replaces `buddy-v23` in `sw.js` with `buddy-<short SHA>` and deploys to Pages on every push to `main`. The file in the repo is left alone, so opening the app locally needs no Action. One-time setup: Settings → Pages → Source: GitHub Actions.
- **First-run guide:** `js/views/onboarding.js`, a modal `<dialog>` with three steps (what the app does → language and level → pick a buddy and start chatting). "ข้าม" is on every step, Escape also skips, focus moves to the step heading, and the browser keeps Tab inside the dialog. One flag, `lb_onboarded`, remembers it was shown. People who already have chats, words or mistakes never see it.
- **Share links and search:** description, `og:*` and `twitter:*` tags, canonical link, and `og-image.png` (1200×630, app name and the six buddies).
- **Accessibility pass:** the audit (`tests/browser/ui-audit.js`) finds no unnamed buttons, no contrast below 4.5:1 and no horizontal overflow on any page at 390×844 and on desktop, in dark and light themes. The advanced `<details>` opens with Enter or Space.
- **Tests:** `tests/site.test.mjs` checks the CSP, fonts, share tags, offline file list, workflow and Settings structure.

Service worker cache is now set by the deploy workflow (`buddy-v23` locally). No prompt or Worker changes.

## Review fixes (2026-11-04)

These come from the owner's app review.

- **Works on first open:** the Worker link defaults to the owner's Worker (`DEFAULT_WORKER` in `store.js`), so a new learner can chat without visiting Settings. An empty saved link also falls back to it. The Settings field still lets anyone use their own Worker.
  - Note: the Worker has no access code (the owner's choice), so anyone with the site link uses the owner's Gemini quota. The per-IP limit (40 requests a minute) still applies.
- **Calmer chat header:**
  - The role and mode pickers are folded into one summary button ("เพื่อน · 💬 คุยธรรมชาติ ▾") that opens them. The open/closed choice is remembered on this device.
  - The quota line shows only when Gemini is used up or 80% of the daily limit is reached. Today's count is shown in Settings → การเชื่อมต่อ.
- **Five menu buttons instead of six:** สถานการณ์, ฝึกเสียง and คอร์ส/IELTS share one "ฝึก" button. A row of three links at the top of each of those pages switches between them. The menu now marks "ฝึก" on the courses page, where it used to mark สถานการณ์.

Service worker cache `buddy-v23`. No prompt or Worker changes.

## Phase 6 — Professional UX and QA (2026-11-04)

### Audit tool
- New `tests/browser/ui-audit.js` runs in the app (loaded as a module, since the app's CSP blocks `eval`). On every page it reports:
  - horizontal overflow;
  - controls under 44 px;
  - controls with no accessible name;
  - the number of `<h1>`;
  - images without alt;
  - text below WCAG AA contrast.
- Decorative content marked `aria-hidden` (avatar initials, emoji badges) is skipped.

### Accessibility
- **Contrast (light theme):** these tokens were below 4.5:1 and are darkened in both the light and "auto" themes:
  - `--muted`: 4.40 → about 5.3
  - `--accent`
  - `--good`: 3.77
  - `--warn`: 2.87
  - `--bad`: 4.31

  The dark theme already passed.
- **Headings:** every page now has exactly one `<h1>`. Home, Me and Chat had none; the chat header's character name is now the `<h1>`.
- **Touch targets:**
  - 44 px for buttons, icon buttons, round composer buttons and tabs;
  - 40 px for small buttons and chips on touch screens;
  - 36 px for the reply-replay button.
  - Nothing is under the WCAG 2.2 AA minimum of 24 px. Dense rows of small buttons and chips stay at 40 px, below 44.
- **Screen readers:** the message list is no longer a live region. It was redrawn on each reply, which made screen readers re-read it. It is now `role="log"` with `aria-live="off"`, and each new reply is announced once ("Name: text") through a separate polite live region (`#srLive`, `ui.announce`).
- **Keyboard:**
  - a "ข้ามไปเนื้อหา" button, the first stop for the Tab key, moves focus to the current page's heading;
  - the focus ring is visible on all controls;
  - the Settings section buttons move focus to the chosen section's heading.
- The Me page avatar is marked decorative.

### Consistency
- New `js/views/ui.js`: `pageHead`, `sectionHeader`, `emptyState`, `errorBox` and `announce`. Empty states and section headers on Home, Me, Review, Scenarios and Voice now use them.
- The Settings page has a sticky row of section buttons (Profile, Language, AI friend, Memory, Notifications, Appearance, Connection, Sync, Data), built from the cards' headings.
- A test now fails if the mistake-category labels (`store.CATEGORIES`) and the AI category list (`response.CATEGORY_IDS`) drift apart (audit item TD7).

### Updates
- **"มีเวอร์ชันใหม่แล้ว · โหลดใหม่" bar:** when a new service worker takes over a page that already had one, this bar appears. It reloads only when the learner taps, so nothing they are typing is lost. The app also checks for updates when it comes back to the screen.
- `manifest.json` colours now match the dark UI (they were an old green and beige).

### Fixes found during QA
- **Raw JSON in the chat:** a reply from the AI with broken JSON used to show the raw JSON in the chat. It happened once in about 20 replies in the regression run. Now `salvageMessage` shows just the message text whenever it can be read.
- **"undefined" in results:** a scenario result with no summary text showed the word "undefined" in the results list.
- **IELTS live check:** the check now also accepts "tell me about…" prompts, not only questions ending in "?".
- **Regression from Phase 1, found by the full live run:**
  - The Phase 1 wording of the empty character-memory line ("admit you do not know yet") made a character ignore the learner facts it had been given. The failing case: James said he did not know the learner's background despite "nurse at Bangkok Hospital, wants to work in Australia".
  - The line now says the learner facts are still true and should be used, and that only shared history is unknown.
  - Re-check: shared facts used 5/5.
- **Stray control characters:** a few came from shell patches (`\b` written as a backspace character) and were removed. A scan confirmed there are none left in the code.

Prompt change: only the empty-memory line in `engine/prompt.js`.

Service worker cache `buddy-v22`. No prompt or Worker changes.

## Phase 5 — IELTS and courses (2026-11-04)

Owner decision applied: **original practice material only.** No content is taken from official or published test books. Every band is labelled as a practice estimate.

### IELTS engine — `js/engine/ielts.js` (pure)
- Practice material, written for this app:
  - 8 Part 1 topics × 4 questions;
  - 10 Part 2 cue cards, each with 4 points, 3 Part 3 questions and topic vocabulary;
  - 8 Writing Task 2 prompts (opinion, discussion, advantages/disadvantages, problem/solution);
  - 3 Task 1 tables with made-up data, labelled as such;
  - 4 listening scripts with 4 questions each (gap-fill and multiple choice), read aloud by the device voice.
- Bands:
  - `cleanBand` accepts 0–9 in half steps only.
  - `overallBand` uses IELTS-style rounding (.25 → .5, .75 → next whole band).
  - **The overall band is always computed by the app from the criteria, never taken from the model.**
- `analyseWriting`: an instant check with no AI. It counts words against the minimum, paragraphs, sentences and average sentence length, and finds linking words and over-repeated words. It also gives notes (too short, paragraphing, a missing Task 1 overview or Task 2 conclusion).
- `buildSpeakingPrompt` / `buildWritingPrompt`:
  - examiner-style practice feedback per official criterion name, for a chosen target band;
  - Thai notes, improvements and useful vocabulary;
  - a sample answer (Speaking) or a rewritten paragraph (Writing);
  - pronunciation is never judged, and instructions inside the learner's text are ignored.
- `parseIeltsFeedback` validates every field. If any criterion is missing, the feedback is rejected rather than shown with a guess.
- Listening checking accepts listed spellings and number words. Listening shows a raw score only (x/4), because a short set cannot be converted into a band honestly.

### Courses — `js/engine/courses.js` (pure)
- 4 courses built from existing activities:
  - ordering food and drinks (6 steps);
  - travel (7);
  - English for work (6);
  - IELTS starter (7, English only).
- A step is done only with evidence dated after the course started: a scenario result, voice-practice and review counts, or IELTS attempts by part/task.
- Stored as `state.courses = { id: { start } }`.

### Screen — "คอร์สและ IELTS" (`#learn`)
- Opened from Home, the scenario page and the Me page.
- **คอร์ส:** start, a progress bar, the steps with ✅, the next step highlighted, a "ไป" button that opens the right activity, and restart.
- **Speaking:**
  - Part 1/2/3 and a target band;
  - hear the question, or get another one;
  - a Part 2 timer (1 minute to prepare, then 2 minutes);
  - typed or spoken answers (speech recognition keeps listening during the Part 2 talk);
  - no AI request below the minimum words (15 / 60 / 25).
- **Writing:**
  - Task 1 (table) and Task 2;
  - live analysis while typing;
  - the draft is saved on the device;
  - an AI request only from half the minimum word count.
- **Listening:** play normally or slowly, answer, check, see the script.
- Feedback card: overall ≈ band, per-criterion bars, the disclaimer on every result, strengths, improvements, vocabulary, and the model answer (which can be played aloud).
- Recent attempts are listed on each tab.

### Data
- `state.ielts` holds attempts (up to 300, validated on load: bands cleaned, text clipped, listening keeps only its score).
- Each attempt syncs as an `i:<time>` row; courses sync as `x:courses`.
- `ai.js askIelts` makes one separate request per feedback; nothing is added to the chat.

Service worker cache `buddy-v21`. The Worker is unchanged (v12).

## Phase 4 — Learning analytics (2026-11-04)

### Metric registry (4.1) — `js/engine/analytics.js` (pure)
- There are 13 metrics, each with a Thai name, a unit, a written **source**, a kind (`count` = exact tally, `rate` = share or average) and which direction is good.
- The metrics: study time, active days, messages, grammar accuracy, reviews, recall in review, new words, hint use, shadowing, words caught by the recogniser, listening accuracy, scenarios finished, average scenario score.
- Rates are only shown with a minimum sample (`minN`). Below it they read "ข้อมูลยังไม่พอ".
- Confidence labels are low / medium / high, at 1×, 3× and 10× the minimum. Counts are labelled "นับจริง".
- New data collected from now on: review grades (`reviewsGraded`, `reviewForgot`) for the recall metric. Older reviews still count as reviews.

### Weekly report (4.2)
- This week (the last 7 days) against the 7 days before, for every metric: value, previous value, ▲▼, and whether the change is good (for hints, fewer is good).
- Mistake types are compared week against week (style tips are not counted).
- 2–5 plain-Thai highlights, built only from metrics with enough data.
- A 30-day learning history, one line per active day.
- A "ตัวเลขแต่ละตัวมาจากไหน" section lists every source. It states that there is no pronunciation score.

### Weak spots and recommendations (4.3)
- Rules, each with the evidence shown to the learner:
  - a mistake type ≥3 times in 14 days;
  - cards forgotten 2+ times;
  - 10+ cards due;
  - ≥50% of messages sent after opening a hint;
  - a scenario criterion averaging ≤2.5/5 over 2+ attempts;
  - listening accuracy below 60%;
  - the recogniser catching below 70% of words;
  - no voice practice this week;
  - no chat in 3 days.
- `recommendations()` picks the top 3, one per kind of action. Each has a button: practise in chat, open review, replay the scenario, open the voice page on the right tab, or open the chat.

### Personal 7-day plan (4.4) — `js/engine/plan.js` (pure)
- Built from the daily goals (messages, reviews) and the weak spots: every day has chat + review, plus one practice task that rotates through the focus areas (listening, shadowing, scenarios, words).
- Task progress comes only from what was really done that day.
- The learner can raise or lower targets, remove tasks, add tasks (up to 5 a day, no duplicates), and start a new plan.
- Stored as `state.plan`, validated by `cleanPlan` and synced as the `x:plan` row.

### Screens
- New page "รายงานและแผนเรียน" (`#progress`), opened from Home and the Me page.
- Home: "วันนี้ทำอะไรดี" now shows today's plan tasks with progress, plus the top recommendations with their evidence. These replace the old fixed rules.

### Fixes found by the new tests
- Lowering a plan target to 0 reset it to the default instead of the minimum, because 0 was treated as "missing".
- Plan rows were cramped on a phone, so the edit controls moved to their own line.

Service worker cache `buddy-v20`. No AI or Worker changes.

## Phase 3 — Voice and shadowing (2026-11-04)

Owner decision applied: browser-only speech, no paid pronunciation provider. **No pronunciation score is shown anywhere.**

### Provider interfaces (3.1) — `js/voice/`
- `tts.js`: a TTS provider interface (`speak → Promise`, `cancel`, `speaking`, `unlock`, `available`) and `browserTts`. Capabilities: accents yes; voice gender **no**; rate and pitch yes; word timing no.
- `stt.js`: an STT provider interface (`start({lang, onText, onEnd(text, confidence), onError})`, `stop`) and `browserStt`. Capabilities: `pronunciationScore: false`.
- `setTtsProvider` and `setSttProvider` let another engine be plugged in without touching the learning features; invalid providers are ignored.
- `js/speech.js` is now a thin layer over the providers with the same exports, so the chat and review pages are unchanged. `speak()` returns a promise and has a `slow` option (×0.7).
- `recorder.js`: records the learner's voice with MediaRecorder (mp4 on Safari, webm elsewhere). The audio is kept in memory only (`blob:` URL); it is never uploaded or saved. It stops by itself after 30 s.

### Shadowing (3.2, 3.3) — new page "ฝึกเสียง" (`#voice`, new nav item)
- Sentences come from the learner's own data, most useful first:
  - corrected mistakes (with the Thai translation);
  - word-bank examples;
  - lines the characters said in chat (split into sentences; emoji removed);
  - phrases from scenarios that fit the learner's level.
- Source filter chips.
- Buttons: 🔊 ฟัง, 🐢 ฟังช้า, and "ทีละท่อน" (phrase by phrase, highlighted).
- **"พูดตาม (ให้เครื่องฟัง)"** uses speech recognition, then marks each word as heard or missed. It shows "จับคำได้ x/y คำ (z%)", what was heard, and extra words. A note says this is the browser recogniser catching words, not a pronunciation score.
- **"อัดเสียงตัวเอง"** records the learner, then plays back their recording next to the model sentence.
- Without speech recognition (for example on some iPhones), the word check is hidden and "✓ พูดตามแล้ว" marks the sentence done.
- A capability line shows what this device can do.
- Corrections in the chat have a new "🎙️ ฝึกพูดประโยคนี้" button that opens the page with that sentence first.

### Listening (3.4)
- **Gap-fill:** a word-bank example is spoken and the learner types the missing word.
- **Dictation:** the learner types a short sentence they heard.
- Checking ignores case and punctuation and accepts "I'm" = "I am" and "five" = "5". One typo in a longer word counts as "≈ เกือบถูก". Dictation shows which words were right.
- Only the first check of an item per visit counts toward the stats.

### Tracking
- `state.voice`: best result, attempts and time per sentence (up to 400 kept, validated on load).
- Days now record `shadow`, `shadowWords`, `shadowHeard`, `listen` and `listenOk`.
- The Me page has a "พูดและฟัง" card, and the home plan suggests voice practice.
- Sync: one `v:<key>` row per sentence. One combined row could have passed the Worker's 20,000-character row limit and made every sync fail. Two devices merge by keeping the better record.

### Engine — `js/engine/shadowing.js` (pure)
- `compareWords` (an order-aware LCS alignment, with contractions and numbers normalised), `splitPhrases`, `practiceItems`, `listeningItems`, `checkAnswer`, `recordAttempt` and `itemKey`.

Service worker cache `buddy-v19`. No AI or Worker changes.

## Phase 2 — Scenario learning (2026-11-04)

### Schema v2 (2.1) — `js/engine/scenarios.js`
- 13 categories instead of 5 groups.
- New fields:
  - `title_en`
  - `cefr: [min, max]`
  - `expressions` (whole useful phrases, separate from `vocab`)
  - `flowTh` (Thai stage names)
- Derived `steps` (`s1…sN`) and `description`.
- `upgradeScenario()` keeps v1 entries (with `group`, no range) working, and `validateScenario()` checks the new fields.
- New helpers: `searchScenarios`, `fitsLevel`, `attemptsOf`, `progressOf`, `matchCriteria`.
- New generic roles: `support_agent`, `landlord`, `neighbour`, `pharmacist`.

### Content (2.5) — 17 → 25 scenarios
- New:
  - โทรหาฝ่ายบริการลูกค้า (support)
  - แจ้งเจ้าของห้องว่าแอร์เสีย (landlord)
  - คุยกับเพื่อนบ้านเรื่องเสียงดัง (neighbour)
  - ขอโทษเพื่อนที่ลืมวันเกิด (apology)
  - สัมภาษณ์วีซ่า (visa)
  - ขอเลื่อนส่งงานกับอาจารย์ (teacher)
  - วันแรกที่ทำงานใหม่ (firstday)
  - ซื้อยาที่ร้านขายยา (pharmacy)
- Every one of the 13 categories now has at least one scenario.

### Difficulty variants (2.1)
- ง่าย / ปกติ / ยาก (`VARIANTS`), chosen before starting. Each one changes how cooperative and fast the other person is, and whether a complication happens.

### Step progress (2.2)
- During a scenario the prompt lists stage ids and asks for `scenario_step` and `scenario_done`.
- The app only accepts valid ids and only moves forward.
- The chat's scenario bar shows the difficulty, a progress bar and "ขั้น 2/5 · stage name".
- When the scene is done it turns green ("✅ ทำครบตามเป้าหมายแล้ว") and highlights the end button.
- Saved scenes get `variant`, `total`, `step` and `done`, validated by `cleanScene` in `store.js`. Older saved scenes get safe defaults.

### Results and history (2.4)
- At the end, the app note asks for `criteria_scores` using the scene's exact criterion names; IELTS asks for them too.
- Results now store `variant`, steps reached, `done`, and per-criterion scores (1–5).
- The details panel shows past attempts: date, character, difficulty, steps, score, criteria. It also shows the trend versus the previous attempt and a "เล่นอีกครั้งกับ …" button.
- The activity log notes the change ("+2 จากครั้งก่อน").

### Library UI (2.3) — `views/roleplay.js`
- Search covers Thai and English titles, the description, vocabulary and phrases.
- Category chips scroll sideways on phones; there is also a "🎯 ระดับฉัน" filter.
- Cards show the CEFR range and "✅ N ครั้ง · ดีสุด x".
- The details show stages in Thai, phrases, vocabulary, the difficulty picker and recommended characters.
- The home-page plan opens the suggested scenario directly (`openScenario`). Suggestions now prefer scenarios that fit the learner's level.

### Fixes found by the new tests
- A result with no score (`null`) was counted as 0 in best score and trends (`Number(null) === 0`). Fixed in `progressOf` and in the conversation's "+N from last time".

Service worker cache `buddy-v18`. The Worker is unchanged (v12).

## Phase 1 — Core AI experience (2026-11-04)

### Structure (1.1)
- New `js/conversation.js` (no DOM) holds sending turns, applying replies, greetings, scenes, practice and quiz. It talks to the chat view through events (`chat:busy`, `chat:sent`, `chat:waiting`, `chat:reply`, `chat:failed`, `chat:error`, `chat:open`).
- `views/chat.js` now only draws and handles input.
- App-note prompts moved to `engine/prompt.js` (`appNotes`).
- The double re-render after each reply is gone: the conversation emits `chat:reply` + `badges` instead of `state`.
- Building the prompt no longer changes memory. The "used" time is stamped after the reply arrives.

### Conversation modes + preferences (1.2, 1.7)
- `engine/modes.js` defines four modes, picked from the chat bar and synced as `settings.mode`:
  - คุยธรรมชาติ (natural)
  - เรียนไปคุยไป (learning)
  - เน้นแก้ภาษา (correction: turns on detailed feedback)
  - ฝึก IELTS (IELTS, English only; practice questions, never a band)
- While a scenario runs, role-play replaces the mode and the picker is locked.
- New settings: response length (short / normal / long) and teaching intensity (low / medium / high).

### Feedback v2 + correction timing (1.3, 1.4)
- Each correction has a `type`:
  - `error`
  - `unnatural`: not wrong, but not native-like
  - `style`: optional
- A Thai translation (`translation_th`) is shown as "แปล".
- Style tips are labelled "ทางเลือก (ไม่ผิด)". They are not added to the Mistake Book and do not lower grammar accuracy.
- Older corrections get a type from their category.
- Setting "แสดงคำแก้เมื่อไร":
  - **immediate**: the explanation is open.
  - **after_turn**: folded (the default, same as before).
  - **end**: corrections are hidden and collected. A "✏️ คำแก้ N" button in the chat bar opens a summary card.
- Only corrections collected in end mode carry `seen: false`, so older data never shows up as unseen.

### Hint ladder (1.5)
- Each reply carries `hints`: a Thai clue, 2–4 words with meanings, a sentence pattern, and a full example with its Thai meaning.
- "🆘 ไม่รู้จะตอบยังไง — ขอคำใบ้" reveals the steps one by one:
  - tapping a word adds it to the input;
  - tapping the pattern puts it in the input;
  - the full example can be heard or used.
- Usage is tracked from real taps: the highest hint level is saved on the learner's message (`hint` 1–4, and a 💡 tag); per-day `hints` and `hintFull`. Tapping a reply idea counts as level 4.
- The Me page shows "การใช้ตัวช่วย".

### Thai → English helper (1.6)
- When the input contains Thai, a "🇹🇭→EN" button appears.
- It makes one small separate request (`askHelper`, `buildHelperPrompt`) and shows 3 options (simple / casual / polished, each with a Thai note). Tapping one replaces the input. Nothing is added to the chat history.
- Messages sent this way are tagged (`helper`) and counted.
- Live testing led to prompt fixes:
  - keep time words (วันนี้ was turned into "yesterday");
  - do not guess gender (แฟน → partner);
  - the parser accepts a bare JSON array.

### Reply quality checks (1.8)
- `engine/checks.js` flags a reply without changing it:
  - sentences too long for A1/A2;
  - "you mentioned / last time / that same…" with nothing to remember;
  - more than 2 questions;
  - malformed output.
- Counters are kept in `state.quality` and shown on the Me page.

### Other
- Bot messages have a real replay button (keyboard accessible).
- Service worker cache `buddy-v17`; `conversation.js`, `modes.js` and `checks.js` are added to the offline shell.
- The Worker is unchanged (still v12).

## Phase 0.5 — Hardening (2026-11-04)

Approved by the owner: everything in Phase 0.5 except access control (R-H1). The Worker stays open; this is the owner's decision.

Owner decisions recorded:
- Data retention: raise the caps and never drop data silently.
- Pronunciation: honest browser-only practice; no paid provider for now.
- IELTS content: original material only.
- CI: yes.

### Data (R-H3)
- Chat history is capped **per character**: the latest 500 messages for each character. It used to be 300 for all characters together, plus a 120-day limit. The 120-day limit is removed.
- Vocabulary and the Mistake Book have a safety cap of 5,000 each (previously 500 and 300). Role-play results: 500 (previously 50). Daily stats: 730 days (previously 180).
- Anything trimmed at a cap is counted in `state.trimmed` and shown in Settings. Nothing is removed silently any more.
- Settings → "ข้อมูลของคุณ" shows a storage meter: space used out of the browser's ~5 MB, and how many items of each kind are kept.
- Files: `js/store.js` (`LIMITS`, `capList`, `capMessages`, `addResult`, `storageReport`), `js/stats.js`, `js/views/settings.js`, `index.html`, `css/app.css`.

### Import safety (R-M4)
- Before an import replaces the data, the current data is saved as a snapshot. A "ย้อนการนำเข้าล่าสุด" button restores it for 7 days. If the snapshot cannot be saved (storage full), the app asks before continuing. The Worker link and access code are not changed by an undo.
- Files: `js/views/settings.js`, `index.html`.

### IELTS labels (R-H4)
- IELTS results show "≈ band x.x (ประมาณการ)" instead of "x/10". The scenario details and the result summary say it is a practice estimate from typed answers, not an official IELTS score, and that pronunciation is not assessed. The examiner prompt now starts its feedback with that statement.
- Older results without a scenario id are recognised by name.
- Files: `js/engine/scenarios.js` (`scoreLabel`, `bandFromScore`, `resultNote`, `IELTS_NOTE_TH`), `js/views/roleplay.js`, `js/views/chat.js`.

### Push messages (R-M1, R-M3) — Worker v12
- The push profile carries the character id. The Worker stores it with each pending message, and the app files the message in that character's chat. Messages from older Workers still go to the active character.
- The push prompt now says it is a fictional AI character that never claims to be human. The old line "Do not say you are an AI" is removed. It also must not invent shared history.
- Cron logs contain only counts and status, never message text. `/push/run` returns only `{sent, status, error}` per user.
- `cleanProfile` validates the character id. This fixes a bug found by the new test: a missing id was stored as the string "undefined".
- Files: `worker/worker.js`, `js/push.js`.

### Tests and CI (R-H2)
- The Worker, sync and push tests moved from a temp folder into `tests/`, with no npm dependencies. The push-decryption check now uses `node:crypto` instead of the `http_ece` package.
- New `tests/store.test.mjs` covers migration of old data, per-character caps, trim counting and the storage report. A new engine test covers the IELTS labels.
- `node tests/run-all.mjs` runs every `*.test.mjs` file.
- `.github/workflows/tests.yml` runs the offline suite on every push and pull request. It needs no secrets and uses no AI quota.

### Updates arrive consistently
- The service worker now revalidates every app file with the server (`cache: 'no-cache'`, a quick 304 when unchanged). Its install step bypasses the HTTP cache. It no longer stores error responses.
- Before this, GitHub Pages' 10-minute browser cache could mix a new `index.html` with old scripts right after a deploy.
- Cache `buddy-v16`.

### Other
- README: the scenario count, the IELTS disclaimer, where data is stored, the caps and how to run tests.
- `views/chat.js`: removed an unused variable.

### Not changed
- Access control (R-H1): owner's decision.
- Sync encryption (R-M2): not in Phase 0.5 scope.
