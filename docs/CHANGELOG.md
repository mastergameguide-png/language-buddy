# Changelog

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
