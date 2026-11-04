# Language Buddy — Development Roadmap

Status:
- **Phase 0.5: DONE (2026-11-04)**, approved without access control (R-H1). Details in [CHANGELOG.md](CHANGELOG.md), test results in [TEST_REPORT.md](TEST_REPORT.md).
- Phase 1 and later are **waiting for owner approval**. No phase starts before approval.

Owner decisions (2026-11-04):
- Keep the Worker open (no access code).
- Raise the data caps and never drop data silently.
- Pronunciation: browser-only and honest (no paid provider).
- IELTS content: original material only.
- CI: on.

Principles for every phase:
- small, reviewable commits;
- tests before and after each change;
- backward-compatible data;
- no new dependencies without a reason;
- the docs (`CHANGELOG.md`, `TEST_REPORT.md`, this file) are updated at the end of each phase.

A phase does not start while the previous one has an open CRITICAL or HIGH defect.

Complexity: **S** ≈ under a day, **M** ≈ 1–3 days, **L** ≈ a week or more of focused work.

---

## Phase 0.5 — Hardening (before new features)

| Item | Fixes | Files | Size | Depends on |
|---|---|---|---|---|
| Move the Worker, sync, push and schedule tests into `tests/`, add `tests/run-all.mjs` | R-H2 | `tests/*` | S | — |
| Add browser smoke tests: a mock-Worker script plus checklist runs at 375/768/1280 | R-H2 | `tests/browser/*` | M | — |
| Stop silent data loss: per-character message caps, vocab/mistakes never auto-dropped (archive), visible storage meter | R-H3 | `store.js`, `views/settings.js` | M | owner decision 2 |
| IELTS disclaimer + band display | R-H4 | `scenarios.js`, `roleplay.js`, `chat.js` | S | — |
| Push: character id end-to-end, honest prompt, no message text in logs | R-M1, R-M3 | `push.js`, `worker.js` | S | Worker deploy |
| Pre-import automatic snapshot | R-M4 | `settings.js` | S | — |
| README cleanup | TD11 | `README.md` | S | — |
| Access control | R-H1 | Worker secret / `worker.js` | S–M | owner decision 1 |

## Phase 1 — Core AI experience

Scope:
- conversation modes;
- correction timing;
- feedback severity and translation;
- graded hints;
- Thai→English helper;
- configurable response length and teaching intensity;
- a refactor of the chat orchestration.

| Step | Detail | Files | Size |
|---|---|---|---|
| 1.1 Refactor | Extract `js/conversation.js` (run / applyAI / scene / practice) from `views/chat.js`; move app-note prompts into `engine/prompt.js`; remove the double render. No behaviour change. | `chat.js`, new `conversation.js`, `prompt.js` | M |
| 1.2 Modes | `session.mode`: `natural`, `learning`, `correction`, `roleplay`, `ielts`, each a prompt block plus defaults; picker in the chat bar | `engine/modes.js` (new), `prompt.js`, `chat.js` | M |
| 1.3 Correction timing | `immediate` (today) / `after_turn` (collapsed chip) / `end_of_session` (corrections queued, shown in a summary card); stored per message so nothing is lost | `conversation.js`, `chat.js`, `store.js` | M |
| 1.4 Feedback v2 | Add `type: error / unnatural / style` and `translation_th`; the UI styles them differently; style tips are not counted as mistakes for accuracy | `response.js`, `prompt.js`, `chat.js`, `stats.js` | S–M |
| 1.5 Hint ladder | The reply includes `hints {clue, vocab[], structure, example, example_th}` (no extra AI call); "💡 ช่วยหน่อย" reveals hints 1→4; use/edit/🔊 speak; record which level was used | `response.js`, `chat.js`, `stats.js` | M |
| 1.6 Thai→English helper | Typing Thai with "ช่วยพูดเป็นอังกฤษ" returns 2–3 options at the learner's level | `prompt.js`, `chat.js` | S |
| 1.7 Settings | Response length (short/normal/long) and teaching intensity (low/medium/high) → prompt | `store.js`, `settings.js`, `prompt.js` | S |
| 1.8 Output checks | Cheap post-checks: A1/A2 sentence length; "invented history" phrases with an empty memory → log a metric (no rewrite) | `engine/checks.js` (new) | S |

Tests: unit tests for modes, timing, feedback v2 parsing, hints parsing and tracking, and the migration of old messages; browser smoke tests; an opt-in live test set (asks before using quota).

## Phase 2 — Scenario learning

| Step | Detail | Size |
|---|---|---|
| 2.1 Schema v2 | Add `title_en`, `description`, `category` (13 categories), `cefr: [min, max]`, `expressions[]`, `hints[]`, `steps[] {id, goal}`, `variants {easy, normal, hard}`; the v1 fields stay valid; a validator plus tests | M |
| 2.2 Step progress | The reply carries `scenario_step` (an id from the list, validated); a progress bar; auto-suggest "end scene" when the completion condition is met | M |
| 2.3 Catalogue UI | Search, category and level filters, a "done / best score" badge, replay | M |
| 2.4 History per scenario | Attempts with criteria scores, a comparison with the previous attempt | S–M |
| 2.5 Content | Grow from 17 to about 40 scenarios in reviewed batches of 5–8, each checked by the validator plus one live run | L (ongoing) |

## Phase 3 — Voice and shadowing

| Step | Detail | Size |
|---|---|---|
| 3.1 Provider interfaces | `speech/tts.js` and `speech/stt.js` interfaces; the browser implementation is the default; capabilities are declared (`hasGender`, `hasWordTiming`, `hasPronunciationScore`) and the UI shows only what is supported | M |
| 3.2 Recording | MediaRecorder record + play back your own voice (kept in memory only unless the user saves) | S–M |
| 3.3 Shadowing | Sentence/phrase list from the chat, mistakes or scenario; listen → repeat → see which words were recognised. Label it "จับคำได้ x/y คำ", never "pronunciation score"; slow playback; completion tracking | M |
| 3.4 Listening practice | TTS dictation and gap-fill from the learner's own vocabulary; answer checking | M |
| 3.5 (Optional) Pronunciation assessment | Only if the owner approves a provider: Worker endpoint, audio size limits, no audio storage, scores labelled with the provider name | L + cost |

## Phase 4 — Learning analytics

| Step | Detail | Size |
|---|---|---|
| 4.1 Metric registry | Every metric declares its source, minimum sample and confidence; the UI shows "วัดจาก…" and hides metrics with too little data | M |
| 4.2 Weekly report | This week vs last week, strongest and weakest areas, scenarios done, hints used, listening/shadowing done | M |
| 4.3 Weakness detection + recommendations | Rules over mistakes, hint levels, scenario criteria and SRS lapses → the next 3 activities | M |
| 4.4 Personal plan | A 7-day plan from goals and weaknesses; the learner can edit it | M |

## Phase 5 — IELTS and courses

| Step | Detail | Size |
|---|---|---|
| 5.1 IELTS hub page | Speaking, Listening and Writing tabs; a disclaimer on every score | S |
| 5.2 Speaking | An original cue-card bank (Parts 1/2/3), a timer for Part 2, spoken or typed answers, feedback per criterion, sample answers at the target band | M–L |
| 5.3 Writing Task 2 (then Task 1) | Structure analysis, grammar/lexis feedback, improved version, practice band estimate | M |
| 5.4 Listening | Original scripts read by TTS, questions, answer checking, transcript, vocabulary review (no copyrighted test material) | L |
| 5.5 Courses | Short paths (for example "Café English 7 days", "IELTS Speaking 6.5") built from existing scenarios, hints and reviews | L |

## Phase 6 — Professional UX and QA

- Shared components: card, list item, section header, empty/error state, sheet.
- Consistent spacing and type scale.
- Characters reachable from the nav.
- Settings split into sections.
- Accessibility pass: keyboard replay button, targeted `aria-live`, headings, 44 px targets, contrast check.
- A "new version available" prompt in the service worker.
- `manifest` colours.
- Full regression run plus a test on a real iPhone.

## Dependencies overview

```
0.5 Hardening ──> 1.1 Refactor ──> 1.2–1.8 ──> 2.x Scenarios ──> 4.x Analytics ──> 6 UX/QA
                                  └──> 3.x Voice ─────────────┘        ▲
                                                5.x IELTS (needs 1.2 modes, 2.1 schema, 3.1 voice)
```

## Not planned (unless the owner decides otherwise)

- Numeric pronunciation scores without a provider.
- Generated character images.
- Framework or database migration.
- Server-side accounts and logins.
- Copyrighted IELTS material.
- 100 low-quality scenarios.
