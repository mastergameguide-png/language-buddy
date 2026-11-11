# Changelog

## 📖 Book: page view like a note app (2026-11-11)

The owner found the book page slow, because every scanned page waited for the AI to turn it into text. They asked for something like GoodNotes.

- **📄 หน้าจริง (the new default):** the PDF page is drawn on the device straight away (`js/views/booksheet.js`), with no AI and no waiting. The next page is drawn ahead.
  - Zoom 100/150/200/300% with scrolling. At 100%, swipe left or right to turn the page.
- **Writing:** ✏️ pen (black, red, blue) and 🖍️ highlighter (yellow, pink, orange, see-through), by finger or Apple Pencil (pointer events, coalesced points). Also 🧽 an eraser that removes whole strokes, ↶ undo, and 🗑 clear page.
  - Strokes are stored per page in IndexedDB (`ink` store, DB v3) as 0–1 coordinates, so they fit at any zoom. They are not synced.
- **🔍 วงคำ:** drag a box around a word or sentence.
  - Only that piece is cut from a sharp 2400 px drawing of the page and sent to the AI (`REGION_PROMPT`). It returns the text, the dictionary form, the part of speech, the Thai meaning, and a Thai translation of longer text.
  - It is shown with the cut-out picture, saved to the book's words, and can be added to the word bank.
- **📝 ข้อความ (the old view) still works:** the AI turns a scanned page into text only there, or when "❓ คำถามท้ายหน้า" needs it (the page is read first, then the questions are asked). The page view never reads whole pages automatically.
- **Files:**
  - Every new import keeps the PDF on the device, because the page view draws from it.
  - Books added earlier as text PDFs show a note to pick the file again for the page view.
  - Removing a book also removes its marks.
- **Fixed during testing:** switching tools within 0.3 s of drawing lost the stroke, because the redraw read the older saved copy. The page's marks now live in memory first and are saved shortly after.
- **Tests:** `book.test.mjs` 17 (+3), covering ink cleaning, eraser hits, crop box and the boxed-word reply.
  - **Browser check, mock Worker, 375 px, a 3-page image-only PDF:**
    - The page picture showed on opening, with no OCR request.
    - The pen and highlighter drew and were saved. Undo removed a line.
    - Boxing a sentence sent one 22 KB picture and showed the meaning with the cut-out picture.
    - A left swipe turned to page 2.
  - **Real AI test (Gemini through the live Worker, 3 requests):** boxes cut from a realistic scanned test page, with the cut-off letters at the edges a finger-drawn box makes. All three were read correctly, and the cut-off letters were ignored.
    - **One word:** 4 KB, 1.8 s. "teenagers" → teenager (n) วัยรุ่น.
    - **A phrase:** 7 KB, 3.5 s. "replaced by technology" → replace (v) แทนที่, translated as ถูกแทนที่ด้วยเทคโนโลยี.
    - **A whole line:** 19 KB, 3.0 s. The text was exact, the word picked was replace (v), and the Thai translation was correct.
  - **Not tried yet:** a real iPhone and Apple Pencil.

## 📥 My words: import a word-list file, random 10 a day (2026-11-10)

The owner asked to bring in all their orange and pink words from the Oxford 5000 PDF they shared, and to get a random 10 a day to learn.

- **The list:** all 8 pages were read with the app's own method, run on the computer.
  - The highlights were found by colour (938 boxes), cut into 30 numbered-strip images, and each image was read by real Gemini with `MOSAIC_PROMPT`. That took 34 requests, including retries after 3 × 503 "high demand" and 2 × 504.
  - Several images returned far fewer words than boxes. Checking them showed those boxes were Thai handwriting in orange or pink ink, which the AI correctly skipped.
  - Five misreads were fixed after checking the page images: "pul" was removed; "young" (half of "youngster") and "yellow" (pieces of "yell") were removed; "eptional" became "exceptional" and "indulg" became "indulge". The words of each image stay in alphabetical range page by page.
  - **Result: 795 words (orange 312, pink 483)** in `my-words-oxford.txt`, one "word<TAB>colour" per line. It was given to the owner only, not put in the repo: the repo is public and the list is personal.
- **Import:** a new "📄 นำเข้าไฟล์รายการคำ" button on the My words page, which uses no AI.
  - `parseImport` reads "word<TAB>colour", "word, colour" or "word;ส้ม/ชมพู". Lines starting with # are skipped, other lines are read as when pasting, and at most 5,000 words are read.
  - Known and queued words are skipped as before.
- **Order:** "คำแต่ละวัน" has two choices:
  - 🎲 สุ่ม (the new default): a random draw from the whole queue, seeded by the date, so the preview is exactly what gets released and stays the same all day.
  - 🟧 ส้มก่อน: the old order, orange first.
  - The choice is saved and synced in `mywords.order`.
- **Tests:** `mywords.test.mjs` 10 (+2).
  - **Browser check:** the 797-word file (before the last fixes) was imported with the right counts. Releasing today's 10 gave exactly the 10 previewed, mixed orange and pink, into the word bank.

## 📘 Today's words: B2–C1, never repeated, and an article to write (2026-11-10)

The owner asked for:
- today's words at B2–C1, never repeated;
- example sentences, as before;
- an article on any topic that uses the day's words, scored for grammar, order and more;
- the correct, complete article after scoring.

- **Level:** every learner now gets B2–C1. The prompt asks for B2 and C1 only, and words the AI labels A1–B1 or C2 are dropped. `ASK_COUNT` is 8, so 5 still remain after filtering.
- **Never repeated:**
  - `state.dailySeen` keeps every word given (up to 3,000). It syncs as the `x:dailyseen` row, merged as a union.
  - Words in the word bank and in this list are never kept. The latest 300 are also named in the prompt.
- **✍️ Article:** inside the card, a "แต่งบทความด้วยคำวันนี้" section.
  - Write 80–400 words. Chips show which of today's words are already used (regular forms such as -s, -ed, -ing and -ment count, and phrases too).
  - The draft is saved on the device as you type. Sending with a word missing asks first.
  - One AI request (`buildEssayPrompt`) scores 0–10 in half points on four criteria: use of today's words, grammar, order of ideas, and content. The overall score is their average.
  - The result also gives a note per word, up to 10 corrections with a Thai reason, what was done well, the next step, and **the whole article corrected**, keeping the learner's ideas and all of today's words.
  - Results show score bars, the corrections, and the corrected article with today's words in bold, plus "ฟัง" (listen) and "คัดลอก" (copy). "เขียนใหม่" starts again from the old text.
  - The article and result are kept with the day's set, on this device only. Sending counts one message in the day's stats.
- **Tests:** `daily.test.mjs` 12 (+6).
  - **Browser check, mock Worker:**
    - A word given on an earlier day was dropped.
    - The level chip shows B2–C1, and the word chips updated while typing.
    - The draft was saved, the scores, corrections and corrected article showed, and the result stayed after a reload.
    - The layout fits a 375 px screen.
  - **Real AI test (live Worker, which answered with Groq both times):**
    - **Words:** 5.0 s. The AI gave 8 words, all labelled B2 or C1. It repeated "prevalent" from the exclude list, and the app dropped it. 5 words were kept: exacerbate, sustainable, disparity, implement, mitigation. All have correct Thai meanings and examples that contain the word.
    - **Article:** a 97-word test article that misused every word on purpose, plus typical grammar mistakes. 10.6 s. Scores were vocab 1, grammar 2, organisation 3, content 2 (overall 2), with a fair note for every word.
      - 9 corrections were all right, but one Thai reason contained Japanese ("副詞形"). The prompt now says Thai only, never Chinese or Japanese.
      - The corrected article kept the ideas and the four paragraphs and fixed every error.
      - It wrote "sustainably", which the app's word check missed, so -able → -ably now counts.

## Worker v13: Cloudflare Workers AI as the third AI (2026-11-09)

The owner asked for a third, free spare AI. Workers AI won over OpenRouter, AIMLAPI, Mistral, Z.ai, Cohere and NVIDIA, because the Worker already runs on Cloudflare: no new account, no key, and data stays with Cloudflare.

- **Binding:** `[ai] binding = "AI"` in `worker/wrangler.toml`. The model is `@cf/google/gemma-4-26b-a4b-it` (on the free allocation per Cloudflare's 2026-07-28 changelog), and `CF_AI_MODEL` can change it.
- **Order:**
  - Auto: Gemini → Groq → Workers AI.
  - Groq mode: Groq → Gemini → Workers AI.
  - "Gemini only" stays Gemini only.
  - Photos (scanned pages, handwriting) still go only to Gemini.
  - The cron buddy message is Groq → Gemini → Workers AI.
- **Handling:**
  - JSON mode is used, with a retry without it if the model rejects it.
  - Both the `choices[0].message.content` and the older `response` shapes are read.
  - There is a 20 s timeout.
  - "Daily free allocation used up" becomes 429, and capacity errors become 503.
- **Health:** `GET /` lists `cloudflare` in `ai` when bound. `WORKER_VERSION` is 13.
- **Tests:** `worker-route.test.mjs` has 25 checks (+11).
- **App unchanged:** a reply from Workers AI shows no provider label, and today's usage counts it under Gemini. Labelling it needs a change in `js/ai.js`, which was not asked for.
- **Not deployed yet:** the deploy from this session was blocked by the permission check, so the owner runs `npx wrangler@4 deploy` in `worker/`.

## 📖 Book reading: scanned PDFs (2026-11-09)

The owner's 168-page book turned out to be a scanned PDF (pictures of pages, no text), and the first version refused it. The owner chose to have the AI read the pages.

- **Import:** a PDF where fewer than 20% of pages have text is treated as scanned.
  - The file itself is also kept on the device, in a separate IndexedDB store (`files`), so saving a page's text never rewrites the big file.
  - Scanned pages start as `null`. Pages that do have text are used as they are.
  - The id comes from the file's bytes, so the same file gives the same id on another device and progress continues.
  - Picking the same file again keeps pages already converted.
- **Converting, one page at a time:**
  - The page is drawn with pdf.js (2000 px on the long side, JPEG, about 70 KB) and sent with `OCR_PROMPT`: printed main text only, one string per paragraph, hyphen joins, no page numbers, headers or handwriting, `[?]` for unreadable words, and no corrections.
  - This happens automatically for the page being read (when opening the book or after "อ่านหน้านี้จบ"). Flipping pages with ◀ ▶ only shows a "🪄 แปลงหน้านี้" button, so browsing does not spend AI requests.
  - "⬇️ เตรียม N หน้าถัดไป" converts up to 5 pages ahead, so they can be read offline.
  - "🖼️ ดูภาพต้นฉบับ" shows the original picture of the page.
  - Converted text is saved on this device only.
- **Fix found while testing:** pdf.js normally waits for screen frames before drawing, and those stop while the app is in the background. Pages are now drawn with `intent: 'print'`, which does not wait.
- **Tests:** `book.test.mjs` 14, covering scan detection, pending pages, the bytes id and the OCR parser. All 22 test files pass.
  - **Browser check, mock Worker:** a 4-page image-only PDF made in the browser was imported and marked 📷 สแกน. Page 1 was converted on opening, and "เตรียม 3 หน้าถัดไป" converted the rest. The server received 4 JPEG images (about 71 KB each). The original image showed, "อ่านหน้านี้จบ" moved on, and picking the file again kept the same book with all 4 pages still converted.
  - **Real AI test (Gemini through the live Worker):** one realistic scanned page made for the test (Times text, a slight tilt, grey paper, noise, blur, JPEG, with a running header and page number).
    - The first try got a temporary 503 ("high demand"); the retry 30 s later worked.
    - 2.8 s, 1,495 tokens. All 169 words came back in order (100%), in 3 correct paragraphs plus the heading, and the page number was left out.
    - The running header "POLICING IN PRACTICE" was kept, against the prompt. It shows as one short extra line at the top of the page.

## 📖 Book reading (2026-11-09)

The owner wants to read a 168-page English book (a PDF whose text can be selected) inside the app. The page is `#book`, the fifth practice tab "📖 หนังสือ", and Home shows a "📖 อ่านต่อ" strip while a book is unfinished.

- **The book stays on the device:**
  - The learner picks the PDF once. Its text is read on the phone with pdf.js 4.10.38 (`vendor/pdfjs`, Apache-2.0, legacy build, `isEvalSupported: false`). It is loaded only when a PDF is picked, so it is not in the offline shell and the CSP is unchanged.
  - The text (paragraphs per page) is saved in IndexedDB (`js/bookdb.js`), never in the repo, never uploaded and never synced. Nothing is published, so there is no copyright problem.
  - Synced: only progress (`x:library` row: pages read, current page, looked-up words). On another device, picking the same PDF finds its progress, because the book id comes from the text.
  - Scanned PDFs (almost no text), password-protected and broken files get a clear Thai message.
- **Reading:** one page at a time, with page jump, a 🔊 button per paragraph, and a daily goal of 1, 2 (default), 3 or 5 pages. Blank or picture pages say so.
- **Tap a word:**
  - The word under the finger is found from the tap position (`caretPositionFromPoint` / `caretRangeFromPoint`). There is also a box to type a word.
  - Words already looked up in this book, or already in the word bank, are shown without AI.
  - Otherwise one short AI request sends only the word and its sentence. It returns the dictionary form, part of speech and Thai meaning for this sentence. A short Thai note was dropped after the real test (see below).
  - "+ คลังคำ" adds it to the word bank with the book sentence as the example, so normal spaced review picks it up.
- **End-of-page questions (optional):** one AI request sends that page only (up to 5,000 characters) and gets 3 multiple-choice questions (main idea, detail, word in context) with Thai explanations. They are checked on the device. Pages under 300 characters have no questions.
- **XP:** a new rule "อ่านหนังสือ" gives 5 XP per page read, up to 40 a day. A day with a page read counts as an active day for the streak.
- **Tests:** `tests/book.test.mjs` (11), including real text extraction from a generated PDF with the bundled pdf.js.
  - **Browser check, mock Worker, 375 px:** a 5-page sample PDF was imported. Paragraphs, hyphen joins and page-number removal were correct, and a blank page was handled. Tapping "supervisor", "neighbours → neighbour" and "radio" found the right words. A second tap used no AI. "+ คลังคำ" saved the sentence. The book reopened from IndexedDB after a reload. Marking pages read moved to the next page, and the goal toast, home strip and Lv. XP (10 XP for 2 pages) all appeared.
  - **Real AI test (Gemini through the live Worker, 2 requests):**
    - **Lookup:** "details" in a sample sentence came back in 1.9 s as base "detail", n, "รายละเอียด", which is correct. The Thai note was garbled ("พหูวจฎ", "กลาหิง", "ยิยอย"), so the owner chose to remove the note; only the meaning is asked for and shown.
    - **Quiz:** 2.0 s, 3 valid questions (main idea, detail, "lost property"), all answerable from the page, with sensible Thai explanations.
  - A bug found in the browser check was fixed: the reader did not move to the next page after "อ่านหน้านี้จบ", because of a stale copy of the progress.

## 📥 My words (2026-11-09)

The owner shared their Oxford 5000 (B2–C1) list, about 2,000 words over 8 pages, with handwritten Thai meanings. They highlighted words they could not remember: **pink** means "studied, still forgot", and **orange** means "studied again after pink, still forgot". This page is for exactly those words. It is on its own route `#mywords`, linked from the Review page header and from the Home "📘 คำศัพท์วันนี้" card.

- **Adding words:**
  - **Typing or pasting:** one word per line. "word – Thai", "word = Thai", tab-separated, and the list's own "n. C1" marks all work, and Thai meanings keep their commas.
  - **Photographing or exporting highlighted pages:** up to 3 per time. The highlights are found **on the device, by colour** (`js/engine/highlights.js`).
    - It looks for orange and pink word-sized boxes. Thin red handwriting is ignored, and a highlight cut by a blue pen line is joined back together.
    - The pieces are laid out as numbered strips (up to 40 per image), and the AI only reads the printed words (`MOSAIC_PROMPT`). The colour therefore never depends on the AI.
    - If fewer than 3 highlights are found (another pen colour, or a dark camera photo), the whole page goes to the AI instead (`EXTRACT_PROMPT`).
    - The learner checks the chips and removes any wrong ones before adding.
  - Photos are resized to 2000 px and never stored.
- **Queue:**
  - Orange words come before pink, older first.
  - Words already queued, released or in the word bank are skipped.
  - Words can be removed from the queue.
- **Daily release:** 5, 10 (default) or 15 words a day. One AI request returns, for the day's batch:
  - a corrected Thai meaning;
  - the part of speech;
  - one example of at most 18 words in a police, law or public-safety context, which must contain the word;
  - the usual phrase and the related forms;
  - a look-alike word to avoid (for example adhere ≠ adjacent);
  - a short Thai memory tip.

  The words then go into the word bank, so the existing spaced review brings them back. If the AI cannot be reached, the batch can still be added with the learner's own Thai.
- **🧩 Gap-fill practice:** 5 questions built from the released words' examples (RPCA-TEP Vocabulary style), with four options taken from the learner's own words of the same part of speech. Checked offline.
- **Storage and sync:** `state.mywords = { perDay, queue, done }`, checked by `cleanMyWords`. It is synced as `x:mywords`; merging keeps every released word once and drops queued words the other device already released.
- No change to the Worker, `js/ai.js` or `js/engine/prompt.js`: the page uses `askTranscribe` for photos and `askIelts` for the batch.
- **Tests:** `tests/mywords.test.mjs`, 8 checks. They cover pasted lists, queue order and repeats, the daily limit, both prompts and parsers, gap-fill, merge and wiring.
- **Checked in the browser** at 390×844 with a fake AI: paste, photo, the duplicate check, orange first, today's release, the word bank and the quiz all worked. ui-audit is clean on mywords, review and home in both themes.
- **Real Gemini test of the first approach (1 request, owner approved):** the whole of page 1 was sent and asked for the highlighted words (HTTP 200, 4.7 s).
  - The result was **not usable**. 23 words came back, all marked orange.
  - Many of them were words in blue pen boxes rather than highlighted words (accountant, accusation, assert, amend…).
  - It missed most of the pink words (abstract, accent, accordance, acquisition…).
  - This is why colour detection moved onto the device.
- **On-device colour detection** on the owner's 8 pages found about 940 highlights: orange 372 and pink 566.
  - On page 1 the crops match the page: absent, accommodate, additionally… are orange; abstract, accent, accordance, accused, acquisition… are pink.
  - Leftover problems: a word cut by a box's top line can come out as two pieces (alleg + legation), and a few strips show only handwriting. The prompt joins clear pieces and skips the rest.
  - In the browser, page 1 became 3 strip images: orange 38 in 1, and pink 66 in 2.
- **Real Gemini test of the strip reading (3 requests, owner approved):** each strip image took 2.0–2.5 s.
  - **Orange: 38 of 38 words correct.**
  - **Pink: 62 words came back for 63 highlighted words on the page.**
    - The cut-up allegation was joined correctly.
    - Strips with only handwriting were skipped.
    - Missed: advocate (only "vocat" was visible).
    - Doubtful: "broad", which is probably a piece of a longer word. The learner can remove it before adding.
  - Overall about 97% correct, against the unusable whole-page result.

## RPCA-TEP: Structure and Vocabulary in the mock-test style (2026-11-09)

The owner shared the RPCA-TEP Mock Test (7 July 2026). It shows that **Structure** (grammar) and **Vocabulary** items are all one-gap sentences with four options, mostly in policing contexts. The mock has no error-identification items. Its questions were used as a guide to format and level only, and none of them were copied: a test checks that the mock's sentences do not appear in the bank.

- **+20 Structure items** (grammar 24 → 44). They test the same kinds of points as the mock:
  - passive in different tenses;
  - word form (noun, adverb);
  - conditionals (unless, third conditional);
  - future perfect;
  - verb + to-V or V-ing (remind, deny, be used to);
  - causative have + V3;
  - agreement (neither … nor);
  - relative pronouns (whose), indirect questions and linkers.
- **+20 Vocabulary items** (vocabulary 22 → 42) of the new type `gap`: choose the word that fits the sentence, for example verify, issue a warning, exceed the speed limit, cordon, prohibit … from, trigger an alarm.
- Every new item has a Thai explanation.
- **Sets now follow the mock:**
  - `TYPE_CAP` keeps at most 2 error-identification items in a grammar set, and at most 2 "meaning in context" items plus 1 cloze text in a vocabulary set. The rest are gap-fill.
  - The police share is now held to 40% (it was 45–50%): a single item may no longer go over the target.
- The part descriptions on the TEP page now mention the mock-test style.
- **Not done yet:** the mock's Listening section starts with "Question and response" items (one spoken question, three spoken replies A–C, with nothing printed). The app has no item type like this yet.
- **Tests:** `tests/tep.test.mjs` now has 10 checks. New ones cover the share of each type in a set, four different options, a gap in every Structure item, Thai explanations, and that no mock sentence was copied.
- **Checked in the browser** at 390×844: grammar and vocabulary sets render the new items, and nothing is saved until the learner checks the set.

## 👮 RPCA-TEP practice (2026-11-08)

This is a page of its own (`#tep`), opened from a new "👮 TEP" tab on every practice page. The owner chose: level B1–B2, about 40% policing contexts, and a separate page.

- **Format sources:**
  - The 2026 standard-setting study by the RPCA English department: 120 multiple-choice items (Listening 40, Grammar 20, Vocabulary 20, Reading 40), about 40% in policing contexts.
  - The official site rpca-tep.rpca.ac.th: pass marks of 60/120 for the bachelor's degree and 65/120 for the master's.
  - Item types come from the CU-TEP-style description the owner shared.
  - The owner's text said there are 3 parts. The study, written by the test's own department, says 4, so the app uses 4.
- **Original question bank** (`js/engine/tep.js`, 82 questions, every one with the answer and a Thai explanation):
  - 🎧 Listening (18): short dialogues, long dialogues and monologues. They are read by the device voice, with the two speakers told apart by pitch. Each dialogue can be played twice; after checking, the script is shown.
  - ✏️ Grammar (24): error identification with A–D underlined (subject-verb agreement, tense, passive, parallel structure, gerund or infinitive), plus sentence completion. The wrong part is spread over A–D, so there is no "always B" pattern.
  - 📘 Vocabulary (22): meaning in context, and two cloze texts with 4 blanks each.
  - 📖 Reading (18): short texts (a notice, an email, an advertisement) and two long academic passages that ask about main idea, detail, vocabulary in context, inference and tone.
  - About 40–50% of the bank is in policing contexts. Each set aims for 4 police questions in 10.
- **Practice sets:**
  - Each set has 8–10 questions from one part, drawn at random with the options shuffled.
  - Checking is offline, with no AI.
  - The score is shown as raw marks and a percent, and is never turned into a score out of 120.
- **Saving:** each set is saved as an attempt `{kind: 'tep', part, score, total}`. It:
  - counts for XP (the rule is now "ฝึก IELTS / RPCA-TEP");
  - shows on the Dashboard in a new card with percent correct per set and an average per part;
  - counts toward 2 new steps in the cadet course (Listening and Grammar sets).
- **Tests:** `tests/tep.test.mjs` (9 checks). They cover structure, bank coverage and police share, 4 options, Thai explanations, long-passage paragraph references, the A–D spread, set building, scoring, saving, the course and wiring.
- **Checked in the browser** at 390×844:
  - all four parts, two plays per dialogue, and the script shown after checking;
  - attempts are saved;
  - the four practice tabs fit without scrolling (tab padding reduced slightly);
  - ui-audit is clean on the TEP, Dashboard and Learn pages in both themes.
  - Note: in the preview pane, color transitions do not finish, which gave false low-contrast readings in the light theme. With transitions turned off, the audit is clean.

## 📊 Dashboard (2026-11-06)

This is option 1 from the owner, a personal dashboard. It is one page (`#dashboard`) with long-term progress drawn from data already on this device. It makes no AI call and needs no Worker change. Existing pages are unchanged; Home ("สัปดาห์นี้" header) and Me link to it.

- **Range filter** 7 / 30 / 90 days, set once above the charts. 90 days is shown as 13 full weeks.
- **Tiles for the range:** time, practice days, XP and current Lv., messages and reviews.
- **🔥 Calendar (always 12 weeks):**
  - Monday-first, one blue ramp. The 4 steps are active minutes 1+, 10+, 20+ and 40+, and a legend explains them.
  - Future days are dashed.
- **🏅 XP:** per day for 7 and 30 days, per week for 90. It uses the same per-day XP as the Lv. system (`totalXp().perDay`, new).
- **🎯 IELTS:** two charts, never one chart with two axes.
  - Speaking/Writing practice band, on a 0–9 axis.
  - Reading/Listening percent correct of the short sets. These are never turned into a band.
- **📘 Word bank:** words held at the end of each day or week, plus how many are known and how many are still being learned.
- **✏️ Mistakes:** the top categories in this range, with the count and the change from the same length of time before, written as text with ▲ ▼.
- **Charts:**
  - Plain SVG and HTML, no library.
  - The two series colors are a validated pair, blue and orange, picked for each theme. The dataviz validator passes in both themes: CVD ΔE at least 24.7, and every mark at least 3:1 on the surface.
  - Thin bars with rounded tops, 2px lines, and dots with a surface ring.
  - Each series is named by a legend and a direct label.
  - Hover, tap and keyboard focus show a tooltip, and every chart has "ดูเป็นตาราง" (table view).
- **Files:** `js/engine/dashboard.js` (data, pure) and `js/views/dashboard.js` (page), both added to `sw.js`.
- **Tests:** `tests/dashboard.test.mjs`, 9 checks. They cover calendar alignment, buckets, XP, vocabulary, IELTS, mistakes, totals, axis and wiring.
- **Checked in the browser** at 390×844 with 80 days of test data:
  - all ranges;
  - tooltips;
  - end labels stay inside the card;
  - ui-audit is clean in both themes, and text is at least 5.6:1.

## 📘 Today's words (2026-11-06)

The owner wrote a vocabulary prompt with Gemini. This feature is built on it, with these choices from the owner: the level follows the learner, and there are 5 words a day.

- **Card "📘 คำศัพท์วันนี้" on Home** (English only).
  - The learner taps "✨ สร้างคำศัพท์วันนี้". That makes one AI request, which returns 5 words.
  - The set is kept for the rest of the day, so reopening the app does not ask the AI again.
- **Level:** words are one CEFR step above the learner's level, for example B1 → B2, and C2 stays C2. When an IELTS band is set, the prompt also names the band half a step up, for example 6.5 → 7.0.
  - The owner's prompt fixed the level at C1–C2 (band 7.5–8.5+). That is too hard for most learners using the app.
- **Each word shows** everything the owner's prompt asks for:
  - part of speech, CEFR level and Thai meaning;
  - synonyms and collocations;
  - an IELTS Writing-style example (tap to hear it);
  - a usage note in Thai.
- Each word is folded to "word + Thai meaning" until it is tapped, so the card stays short.
- **"+ คลังคำ" or "เพิ่มทั้งหมด"** puts words into the word bank, where they are reviewed with spaced repetition in "ทบทวน". Each added word counts as a new word in the stats.
- **No repeats:** the learner's latest 150 known words go into the prompt as words to avoid, and the reply is filtered again on this device.
- **Strict parsing** (`js/engine/daily.js`):
  - accepts `{"words": [...]}`, a bare array (the owner's original format) or a ```json fence;
  - drops items with no word or Thai meaning, non-English words, and repeats;
  - trims long fields and keeps at most 5 words.
- A note says the words and meanings are made by AI and may be wrong.
- **AI path:** uses the existing `askIelts` request, so there is no change to `js/ai.js`, `js/engine/prompt.js` or the Worker.
- **Storage:** `state.daily = { day, cefr, words, added }` is checked by `cleanDaily` and stays on this device (not synced). Words added to the word bank sync as before.
- **Tests:** `tests/daily.test.mjs` (6 checks).
- **Checked in the browser** at 390×844 with a fake AI reply:
  - the card made 5 words, and adding one, then all, worked;
  - after a reload the set was still there and no second request was made;
  - the 5 words showed up as due in review;
  - contrast is at least 5.84:1 in the light theme, and the dark-theme ui-audit was clean.
- **Real Gemini test (1 request, owner approved):**
  - HTTP 200 in 3.2 s, valid `{"words": [...]}`, every field filled, Thai notes were natural, and every example used its word.
  - Levels matched (4 × B2 and 1 × C1 for a B1 learner).
  - One problem: Gemini returned "detrimental" although it was on the "do not use" list. The parser dropped it, which left 4 words, so the prompt now asks for 7 and the app keeps the first 5 new ones (`ASK_COUNT`).
  - The 7-word request has not been run live.

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
