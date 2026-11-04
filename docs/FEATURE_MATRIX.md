# Language Buddy — Feature Matrix

> **Update after Phase 1 (2026-11-04).** These are now **IMPLEMENTED**:
> - conversation modes;
> - correction timing;
> - response length and teaching intensity;
> - feedback type (error / unnatural / style) and Thai translation;
> - the graded hint ladder with use/speak and hint tracking;
> - the Thai→English helper;
> - push character identity (Phase 0.5);
> - the IELTS practice-estimate label (Phase 0.5);
> - Worker/sync/push tests in the repo (Phase 0.5).
>
> The tables below are the original Phase 0 audit and are kept for reference.

Audit date: 2026-11-04 · Commit `a8124fe`

Status values:
- **IMPLEMENTED**: works end to end and was checked in code and by a test or a browser run.
- **PARTIALLY_IMPLEMENTED**: a real piece exists but the target behaviour is incomplete.
- **BROKEN**: exists but does not work.
- **MISSING**: no code.
- **NEEDS_REFACTORING**: works, but must be restructured before it can grow.
- **NOT_APPLICABLE**: not sensible for this product or stack right now.

README text was not counted as evidence.

Evidence key: **T** = an automated test passed during this audit · **B** = checked in the browser against the mock server · **L** = live-AI test in this session (before the audit) · **C** = code reading only.

## 1. AI Partner System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Six characters with a stable core personality | IMPLEMENTED | `engine/characters.js`, `engine/prompt.js` | T, L | Personalities differ only through the prompt; the free model sometimes flattens them | Add per-character few-shot lines in Phase 1 |
| Distinct behaviour per character | PARTIALLY_IMPLEMENTED | `characters.js` (style, humor, vocabulary, learning) | L | No measurable check that replies differ (only manual reading) | Add a live "distinctiveness" check (opt-in quota) |
| Multiple contextual roles + priority | IMPLEMENTED | `engine/roles.js`, `views/chat.js` | T, B, L | — | Keep |
| Emotion engine (8 states, intensity) | IMPLEMENTED | `engine/emotion.js` | T, B | Effect on wording depends on the model | Keep |
| CEFR adaptation A1–C2 | IMPLEMENTED | `prompt.js` `CEFR_GUIDE` | L (A1 avg 3.7 vs C1 23 words) | Rules are prompt-only; nothing checks the output | Optional post-check (sentence length) for A1–A2 |
| Character memory (isolated) | IMPLEMENTED | `engine/memory.js` | T, L | A character may still invent shared history (~1 in 6 in a stress test) | Keep the prompt rule; add an output check for "last time/you mentioned" |
| Configurable language / accent | PARTIALLY_IMPLEMENTED | `store.js LANGS`, `speech.js` | C | Accent depends on voices installed on the device; personas are English-centric | Document clearly; per-language character notes |
| Configurable speaking speed | IMPLEMENTED | `speech.js` (rate × level × emotion) | C | Browser TTS only | Keep |
| Configurable correction preference | PARTIALLY_IMPLEMENTED | `settings.feedback` gentle/detailed | C | No timing options (immediate / after turn / end of session) | Phase 1 |
| Configurable response length / teaching intensity | MISSING | — | — | — | Phase 1 setting → prompt field |
| Voice gender per character | NOT_APPLICABLE (now) | `speech.js` | C | Browser voices cannot guarantee gender | Revisit only with a cloud TTS provider |
| Avatars without fake images | IMPLEMENTED | `views/avatar.js`, `assets/characters/` | B | Initials + emoji only | Keep (brief forbids new images) |

## 2. AI Conversation System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Context (last 24 turns + session summary) | IMPLEMENTED | `ai.js buildContents`, `prompt.js` | C, L | Summary only when the model sends one | Keep |
| Follow-up questions, no repeats | PARTIALLY_IMPLEMENTED | `prompt.js` HOW TO TALK | L | Prompt-only | Keep; measure in live tests |
| Thai ↔ English code-switching | PARTIALLY_IMPLEMENTED | `prompt.js` ("unless stuck and asks for Thai") | C | No explicit "say this in English for me" flow | Phase 1: "ช่วยพูดเป็นอังกฤษ" helper |
| Help expressing ideas the learner cannot form | PARTIALLY_IMPLEMENTED | reply ideas (`suggested_replies`) | T, L, B | Ideas are generic; not built from the learner's Thai intent | Phase 1 hint ladder + Thai→English helper |
| Modes: Natural / Learning / Correction / Roleplay / IELTS | PARTIALLY_IMPLEMENTED | Roleplay = scenes; IELTS = one scene; no mode switch | C | Natural/Learning/Correction modes do not exist as settings | Phase 1: a `mode` field in the session + prompt block |
| Correction timing (immediate / after turn / end of session) | MISSING | — | — | Corrections are always shown immediately under the message | Phase 1 |
| Character messages first (greeting) | IMPLEMENTED | `chat.js maybeGreet` | B | — | Keep |
| Push "texts first" | NEEDS_REFACTORING | `worker.js nudgePrompt`, `push.js` | T (schedule/crypto) | Uses an old persona prompt (no character engine, says "do not say you are an AI", no memory isolation); inbox messages are tagged to whichever character is active when fetched | Phase 1: send the character id + its short brief in the profile |
| Photo conversation | IMPLEMENTED | `chat.js preparePhoto`, Worker `cleanParts` | C, T (route) | Gemini only; photos are not kept | Keep |

## 3. Scenario Learning System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Scenario data model | PARTIALLY_IMPLEMENTED | `engine/scenarios.js` (17) | T | Has id, group, roles, objectives, vocab, flow, completion, criteria, cast, difficulty. Missing: description (EN), CEFR range, useful expressions vs vocab, optional hints, multiple difficulty variants | Phase 2 schema v2 (backward compatible) |
| Categories | PARTIALLY_IMPLEMENTED | 5 groups | C | Target lists 13 categories | Phase 2 |
| Guided steps / progress through flow | MISSING | — | — | `flow` exists only as prompt text; no step tracking or completion detection | Phase 2: the model returns `scenario_step`; the app tracks it |
| Free roleplay / custom scenario | IMPLEMENTED | `roleplay.js`, `chat.js startScene` | B | — | Keep |
| Scenario result + score | PARTIALLY_IMPLEMENTED | `state.results` (50) | B | Score is the AI's estimate with no label; no history per scenario; no replay comparison | Phase 2 |
| Catalogue UI for 100+ scenarios | NEEDS_REFACTORING | `views/roleplay.js` | B | A flat card grid, no search, filter or level filter | Phase 2 |
| 100+ scenarios | MISSING (by design) | — | — | — | Grow in quality batches (Phase 2) |

## 4. Smart Hint and Translation System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Reply ideas (3–4 kinds, tap to edit) | IMPLEMENTED | `response.js suggestionsOf`, `chat.js suggestBox` | T, B, L | Generated with every reply (costs output tokens) | Keep |
| Graded hints 1–4 (clue → vocab → structure → full example) | MISSING | — | — | — | Phase 1. Can be generated with no extra AI call by asking for a `hints` object in the same reply |
| Thai translation of hints / replies | MISSING | — | — | — | Phase 1 (on demand) |
| Speak the suggested answer | MISSING | — | — | TTS exists, so this is cheap | Phase 1 |
| Hint usage tracking | MISSING | — | — | — | Phase 1 → feeds analytics |

## 5. Language Feedback System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Correction with original / corrected / natural / explanation / example | IMPLEMENTED | `response.js feedbackOf`, `chat.js feedbackCard` | T, L | One correction per turn | Keep |
| Thai translation field | MISSING | — | — | Explanation is in Thai; sentence translation is not | Phase 1 field `translation_th` |
| Error vs unnatural vs optional style | PARTIALLY_IMPLEMENTED | category `naturalness` | C | No `severity` field; style tips look like errors | Phase 1: `type: error | unnatural | style` |
| Grammar / vocabulary / naturalness / fluency scores | PARTIALLY_IMPLEMENTED | `state.skills`, `me.js` | C | AI self-reported 1–5 from text; labelled as such; low confidence | Keep the label; add a confidence note |
| Sentence structure / task completion criteria | MISSING | — | — | — | Phase 2 (scenario criteria) |
| Mistake Book + SRS review | IMPLEMENTED | `review.js`, `srs.js` | C, B | Exact-match check only for typed answers | Keep; fuzzy compare later |
| Pronunciation feedback | MISSING (correctly hidden) | `me.js` shows "ยังวัดไม่ได้" | B | No audio analysis | Phase 3, provider decision needed |

## 6. Voice and Shadowing System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| TTS playback, replay, slower speed for low levels | IMPLEMENTED | `speech.js` | C | Device voices only | Wrap in a `TtsProvider` interface |
| STT (browser) | PARTIALLY_IMPLEMENTED | `speech.js listen` | C | Not available in every browser; no confidence or word timing used | Wrap in an `SttProvider` interface |
| Microphone recording / playback of own voice | MISSING | — | — | Needs MediaRecorder + a CSP `media-src blob:` (already allowed) | Phase 3 |
| Sentence-level shadowing exercises | MISSING | — | — | — | Phase 3 (text comparison is honest; phoneme scores are not) |
| Compare learner speech with reference | MISSING | — | — | The browser can compare *words recognised*, not pronunciation quality | Phase 3: word-match % labelled "จับคำได้", not "การออกเสียง" |
| Pronunciation assessment score | MISSING | — | — | Requires a real provider (e.g. a cloud pronunciation-assessment API), keys on the Worker, audio upload, cost/quota decision | Needs user approval |
| Listening practice | MISSING | — | — | — | Phase 3 (TTS-generated dictation) |

## 7. Learning Analytics System

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| Study time (active only) | IMPLEMENTED | `stats.js startTimeTracking` | C | Counted per device; merged by max on sync | Keep |
| Messages, voice messages, reviews, words per day | IMPLEMENTED | `stats.js` | C | — | Keep |
| Grammar accuracy (messages needing no correction) | IMPLEMENTED | `stats.js accuracy` | C | Depends on the AI's correction behaviour (gentle mode = fewer corrections) | Show the source + the feedback mode |
| Streak | IMPLEMENTED | `stats.js streak` | C | — | Keep |
| Weak areas (mistake categories) | IMPLEMENTED | `store.js weakAreas` | C | — | Keep |
| Weekly report | PARTIALLY_IMPLEMENTED | `me.js weeks()` (4 rows) | B | No narrative, no comparison, no export | Phase 4 |
| Skill breakdown with confidence/source | PARTIALLY_IMPLEMENTED | `me.js` | B | The source is stated; confidence is not | Phase 4 |
| Scenario completion stats | MISSING | `state.results` only | — | — | Phase 4 (after Phase 2 data) |
| Hint-use / listening / speaking stats | MISSING | — | — | No data is collected yet | After Phases 1 and 3 |
| Recommended next activities | PARTIALLY_IMPLEMENTED | `home.js` plan | B | Three simple rules | Phase 4 |

## 8. IELTS and Courses

| Feature | Status | Files | Evidence | Limitations / risks | Recommendation |
|---|---|---|---|---|---|
| IELTS band as a level setting | IMPLEMENTED | `store.js IELTS` | C | — | Keep |
| Speaking mock (Parts 1–3 in one scene) | PARTIALLY_IMPLEMENTED | `scenarios.js ielts` | C | Typed, not spoken; one generic flow; no cue-card bank | Phase 5 |
| Band estimate labelled "practice estimate, not official" | **MISSING** | `IELTS_FEEDBACK`, `roleplay.js` results | C | The score is shown as `x/10` with no disclaimer | **Fix in Phase 1 (small)** |
| Listening (audio, transcript, questions, checking) | MISSING | — | — | Needs licensed or original content | Phase 5 (original TTS-based items only) |
| Writing Task 1/2 feedback | MISSING | — | — | Task 1 needs charts/images | Phase 5 (Task 2 first) |
| Courses / learning paths | MISSING | — | — | — | Phase 5 |

## 9. Platform (cross-cutting)

| Feature | Status | Files | Evidence | Notes |
|---|---|---|---|---|
| Data migration on load | IMPLEMENTED | `store.js normalizeState` | B | Silently drops the oldest records at caps (see audit H3) |
| Backup export / import | IMPLEMENTED | `views/settings.js` | C | Import replaces everything; no automatic pre-import backup |
| Cross-device sync (D1) | IMPLEMENTED | `sync.js`, `worker.js handleSync` | T (scratchpad) | Stored as plaintext JSON on D1; whoever has the code can read it |
| Web Push | IMPLEMENTED | `push.js`, Worker | T (scratchpad) | See push NEEDS_REFACTORING above |
| Provider fallback, timeouts, size limits, rate limit | IMPLEMENTED | `worker.js` | T (scratchpad) | — |
| Access control | PARTIALLY_IMPLEMENTED | `ACCESS_CODE` optional, **not set** (owner's choice) | T | Origin header can be forged outside browsers |
| AI output treated as untrusted | IMPLEMENTED | `response.js`, `util.el` (textContent only) | T | — |
| CSP | IMPLEMENTED | `index.html` meta | C | `style-src 'unsafe-inline'` needed for inline styles |
| Offline shell | IMPLEMENTED | `sw.js` | C | No "new version" prompt |
| Accessibility | PARTIALLY_IMPLEMENTED | — | B | Labels present; see audit section D |
| Automated tests in repo | PARTIALLY_IMPLEMENTED | `tests/` | T | Worker, sync, push and browser tests exist only in a temp folder, not in git |
