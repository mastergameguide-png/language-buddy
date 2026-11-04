# Language Buddy — Phase 0 Audit Report

- Audit date: 2026-11-04
- Commit audited: `a8124fe` (branch `main`, clean)
- Scope: every source file in the repo was read:
  - `index.html`, `css/app.css` (skimmed for focus, motion and touch targets)
  - all of `js/`, `js/engine/`, `js/views/`
  - `sw.js`, `manifest.json`
  - `worker/worker.js`, `worker/wrangler.toml`, `worker/schema.sql`
  - `tests/`, `README.md`
- No production source file was changed during this audit.

Related documents: [ARCHITECTURE.md](ARCHITECTURE.md) · [FEATURE_MATRIX.md](FEATURE_MATRIX.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)

> Product direction note: the brief names Hibay as inspiration. This audit and roadmap use only the capability list written in the brief. Nothing here is based on Hibay's code, UI, branding or private behaviour.

---

## 1. Tests run during the audit (real output, no AI quota used)

| Suite | Where it lives | Result | Notes |
|---|---|---|---|
| `tests/engine.test.mjs` (characters, roles, emotion, memory, response validation, prompt) | repo | **30 / 30 passed** | |
| Worker routing / provider fallback | scratchpad only (`pushtest/route-test.mjs`) | **13 / 13 passed** | mocks Gemini/Groq |
| Push schedule | scratchpad only (`pushtest/schedule-test.mjs`) | **22 / 22 passed** | |
| Worker security (access code, rate limit, size limits, timeout fallback) | scratchpad only (`pushtest/security-test.mjs`) | **10 / 10 passed** | |
| Web Push crypto + routes | scratchpad only (`pushtest/test.mjs`) | **18 / 18 passed** | |
| D1 sync | scratchpad only (`sync-test.mjs`, uses `node:sqlite` fake D1) | **passed** (prints "ALL SYNC TESTS PASSED") | |
| `node --check` on every `js/` file | — | no syntax errors | |
| Browser pass (mock Worker, 375 px wide) | manual | no horizontal overflow on any page; every control has an accessible name | see section D |
| `tests/live-characters.mjs` (real AI) | repo | **not run in this audit** | it uses quota; the last run (earlier today, before the audit) was 19/19 |

**Not tested:**
- real iPhone (Safari PWA, push, speech)
- screen readers
- large-data performance
- the D1 sync against the real deployed database (only the fake D1)

---

## A. Current architecture (summary)

See [ARCHITECTURE.md](ARCHITECTURE.md) for full data flows.

- A static PWA (vanilla ES modules, no build) on GitHub Pages, plus one Cloudflare Worker.
- The Worker proxies to Gemini, falling back to Groq, and also handles D1 sync, KV and Web Push.
- All learner data lives in `localStorage`. It is validated on every load by `normalizeState`, and can optionally sync to D1.
- The AI logic is split well:
  - **pure, testable engine modules** (`js/engine/*`): characters, roles, emotion, memory, scenarios, response validation and the prompt builder;
  - **DOM views** (`js/views/*`).
- **The system prompt is built in the browser and sent to the Worker.** The Worker only checks its size.

---

## C. Technical debt

| # | Item | Where | Impact |
|---|---|---|---|
| TD1 | `views/chat.js` (495 lines) mixes rendering, AI orchestration (`run`, `applyAI`), scene start/end, practice/quiz prompts, photo handling and input wiring | `js/views/chat.js` | Adding modes, hints and correction timing here will make it fragile. Extract `conversation.js` (orchestration) from the view. |
| TD2 | App-note prompts (`maybeGreet`, `startScene`, `endScene`, `practice`, `quiz`) are inline English strings inside the view | `chat.js` | Hard to test and version; move them to `engine/prompt.js` |
| TD3 | The push message path has its own legacy prompt and profile format, separate from the character engine | `worker.js nudgePrompt`, `push.js pushProfile` | Inconsistent identity and honesty rules (see R-M1) |
| TD4 | Double render after each AI reply: `renderChat()` then `emit('state')`, which renders again | `chat.js applyAI`, `main.js` | Wasted work; whole-thread rebuild every message |
| TD5 | `promptContext()` mutates memory objects (`m.used = Date.now()`) while building a prompt | `ai.js:57` | A side effect hidden in a builder; it also creates sync churn |
| TD6 | Hard caps silently drop the oldest data | `store.js normalizeState/persist`, `addWord`, `addMistake` | See R-H3 |
| TD7 | Category list duplicated: `CATEGORIES` (labels) in `store.js` and `CATEGORY_IDS` in `response.js` | | Can drift apart |
| TD8 | Unused variable `last` in `renderChat` (left over from the suggestion change) | `chat.js:98` | Trivial |
| TD9 | Whole state is a single `localStorage` JSON value, rewritten on every message and every 60 s of study time | `store.js persist` | Fine at today's caps (~0.3–1 MB); will not scale if caps are lifted. IndexedDB would be needed for "keep everything" |
| TD10 | Only engine tests are in git; Worker, sync and push tests live in a temp folder; no CI | `tests/` | Regressions will not be caught; those tests can be lost |
| TD11 | README contains stale statements: "11 scenarios", "Sam" as the only buddy, "data stays on your phone" (not true once sync is on) | `README.md` | Misleading docs |
| TD12 | Settings import trusts value types but not enum values (e.g. any string for `theme`/`ai`) | `settings.js importData`, `sync.js applyRow` | Low; most readers fall back safely |

## D. UX/UI audit

Checked at 375 px against the mock Worker, plus code reading.

| Area | What is good | Problems |
|---|---|---|
| Navigation | 5-tab bottom bar (side bar on desktop), `aria-current`, badges for due reviews and unread messages | The Characters page has no tab (only reached via the chat header or Home); Settings sits under "Me" |
| Chat | Per-character threads, typing indicator, retry on failure, inline correction card, reply ideas, role/emotion bar, quota bar | Correction appears under every corrected message (no timing choice); tapping a bubble to hear it is not keyboard-accessible (a `div` with a click handler); `aria-live="polite"` on a container that is fully rebuilt can make screen readers re-read |
| Characters | Clear cards, profile, per-character memory with delete | Long page when profiles expand; no comparison between characters |
| Scenarios | Detail panel with goals, vocabulary and recommended cast; custom scene | Flat grid of 17 cards; no search, level filter or progress; will not scale to 100+ |
| Review | SRS session, vocab bank, Mistake Book with filters, empty states | Typed answers need an exact match |
| Dashboard (Home / Me) | Honest metrics (time measured only while active, "ข้อมูลยังไม่พอ" when too little data), pronunciation shown as "ยังวัดไม่ได้" | Home and Me have no `<h1>`; the weekly report is a plain list |
| Settings | Every option is functional; clear sync and backup texts | Long single form; 7 touch targets under 32 px (checkbox rows); access-code field shown to everyone |
| Loading states | Typing dots in chat; buttons disabled while busy | No skeletons on other pages (not needed; they render instantly) |
| Empty states | Present for review, vocab, mistakes, memories, weak areas, first chat (intro card) | — |
| Error states | Specific Thai messages for timeout, offline, 401, 429 (rate vs daily), 413, 504, location errors; global error toast | Sync errors only show in Settings |
| Mobile | No horizontal overflow on any page; safe-area aware; reduced-motion respected; focus-visible outline | Not yet verified on a real iPhone in this audit |

## E. Risk assessment

### CRITICAL
None found. No secret is in the repo or the frontend. AI output cannot run actions and is only rendered with `textContent`. No data-corrupting defect was found.

### HIGH

| ID | Issue | Impact | Recommended fix |
|---|---|---|---|
| R-H1 | **The Worker is an open AI proxy** while `ACCESS_CODE` is unset (the owner chose not to set it). The `Origin` check can be faked outside a browser, and the client supplies the whole system prompt. | Anyone who finds the Worker URL can use the Gemini/Groq free quota for any prompt (40 requests/min per IP), which can exhaust the owner's daily quota. `/sync` can likewise be used to store data in D1. | Owner decision. Options: (a) set `ACCESS_CODE` (zero code change); (b) move prompt assembly to the Worker, so the client sends only structured context; (c) per-device tokens. Recommend (a) now and (b) in Phase 1. |
| R-H2 | Worker, sync, push and browser tests are **not in the repository** (temp folder only) and there is no CI. | Future changes can break sync or security with nothing to catch it; those tests may be lost. | Phase 1, first task: move them into `tests/` with a single `node tests/run-all.mjs`. Optionally add a GitHub Actions workflow (needs approval). |
| R-H3 | **Silent data loss at caps**:<br>• `messages` 300 in total across all 7 characters, plus a 120-day limit<br>• `vocab` 500<br>• `mistakes` 300<br>• `results` 50<br>• `days` 180<br>• `activity` 40<br>The oldest items are dropped with no notice. | A learner who uses several characters loses chat history quickly. Vocabulary (a learning asset) disappears once there are over 500 words, including mastered ones. This contradicts the brief's rule against silently discarding data. | Phase 1:<br>• raise the caps where storage allows;<br>• keep per-character message caps;<br>• never drop vocabulary or mistakes without asking — archive them instead;<br>• show a storage meter.<br>Longer term: IndexedDB. |
| R-H4 | **IELTS band estimates are not labelled** as practice estimates. The prompt asks for a band and the UI shows `x/10`. | A learner may treat it as an official-like score. | Phase 1 (small): a disclaimer in the result UI and prompt; show the band, not /10, for IELTS. |

### MEDIUM

| ID | Issue | Impact | Recommended fix |
|---|---|---|---|
| R-M1 | Push "texts first" uses a separate prompt:<br>• "do not say you are an AI";<br>• no character engine;<br>• the active character's persona only;<br>• inbox messages are tagged with whichever character is active when the app opens. | Mixed identities: a message can land in the wrong character's thread, and the honesty rule is inconsistent. | Send `charId` in the profile, have the Worker return it with the message, and reuse a short character brief. |
| R-M2 | Sync data is stored as plaintext JSON in D1. The code is the only credential and is not end-to-end encrypted. | The chat, facts and memories of the owner are readable by anyone with database access or the code. | Optional: client-side encryption with a key derived from the sync code (backward-compatible flag). |
| R-M3 | The Worker logs the cron result, including the generated message text (`console.log('cron', …)`), with observability on. | Conversation content in Cloudflare logs. | Log only counts and status. |
| R-M4 | Import replaces all data after one confirm, with no automatic backup first. | One wrong file wipes the current progress. | Auto-export a snapshot before replacing, or offer a merge. |
| R-M5 | Prompt rules are the only guard for level, no invented history and one question per turn. | A free model drifts, e.g. James invented shared history in about 1 of 6 runs in a stress test today. | Cheap output checks plus regression live tests (opt-in). |
| R-M6 | `chat.js` coupling (TD1). | Every Phase 1–3 feature touches it, so regressions are likely. | Extract orchestration before adding features. |
| R-M7 | Scenario progress is not tracked; completion only happens when the user presses "end". | No progress or replay data for analytics. | Phase 2. |

### LOW
- Keyboard and screen-reader gaps: bubble tap-to-speak, `aria-live` re-reads, missing `<h1>` on Home and Me, small touch targets in Settings.
- `manifest.json` `theme_color`/`background_color` do not match the dark UI.
- README is stale (TD11).
- Unused variable (TD8); duplicated categories (TD7).
- No "new version available" prompt; users must reopen the app.

## F. Final audit summary

1. **What is already good**
   - Clean module split: the pure engine is testable in Node and the views are separate.
   - Untrusted-AI handling is solid: a field whitelist, length caps, `textContent` only, and the model cannot change its character id or rules.
   - Real provider fallback with timeouts.
   - Size limits and a rate limit.
   - Secrets only on the Worker.
   - Honest metrics: no pronunciation score, "not enough data" states.
   - Careful data migration (`normalizeState`) with backward-compatible fields.
   - A working sync with hashed codes.
   - Characters, roles, emotion and memory engines already exist and are tested.
2. **What should be preserved**
   - The vanilla, no-build stack and the Cloudflare Worker, KV and D1.
   - The engine/view split and the response validator.
   - `normalizeState` migration and the data formats and row keys.
   - The six characters and their configurations.
   - The SRS, the honesty rules, and the "show nothing that was not measured" principle.
3. **What must be fixed** (before or at the start of Phase 1)
   - R-H2: tests into the repo.
   - R-H3: silent data loss at caps.
   - R-H4: IELTS disclaimer.
   - R-M1: push identity.
   - R-M3: log content.
   - R-H1: needs the owner's decision.
4. **What should be added**
   - Conversation modes and correction timing.
   - A graded hint ladder with Thai help and hint tracking.
   - Feedback severity (error / unnatural / style) and a Thai translation.
   - A scenario v2 schema with step progress and a searchable catalogue.
   - Provider interfaces for TTS/STT; a shadowing mode based on honest word matching.
   - Weekly reports with source and confidence.
   - An IELTS area: a cue-card bank, a Writing Task 2 checker, original listening items.
5. **What should not be built yet**
   - Numeric pronunciation scores without a real assessment provider.
   - 100+ scenarios generated at once.
   - Licensed IELTS listening content without a licence; official-looking band scores.
   - A framework migration, a build step or a server-side user-account system.
   - Generated character images (forbidden by the brief).
   - Paid speech APIs before the owner approves the cost and keys.
6. **Recommended sequence:** Phase 0.5 (hardening) → 1 Core AI → 2 Scenarios → 3 Voice → 4 Analytics → 5 IELTS → 6 UX/QA. See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).
7. **Complexity and dependencies:** estimated per phase in the roadmap. The main external dependency is the Phase 3 pronunciation provider, which is an owner decision. Everything else fits the current free stack.

## Decisions needed from the owner

1. **R-H1 access control:** set `ACCESS_CODE` / move prompt assembly to the Worker / leave as is.
2. **Data retention (R-H3):** OK to raise caps and archive instead of drop? Is moving large data to IndexedDB acceptable (no user-visible change, needs a migration)?
3. **Pronunciation:** stay with honest browser-only practice (word matching, no scores), or approve a cloud pronunciation-assessment provider (needs an account, a key on the Worker and a cost/quota limit)?
4. **IELTS content:** original AI/TTS-generated practice material only (recommended), or a licensed source?
5. **CI:** add a GitHub Actions workflow that runs the offline tests on every push?
