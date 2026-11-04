# Test Report

## Phase 0.5 — 2026-11-04

Every result below is real output from this session. Nothing is estimated.

### Offline suite: `node tests/run-all.mjs` (Node v24.16.0, Windows)

| File | Result | Covers |
|---|---|---|
| `engine.test.mjs` | **31 passed** | characters, roles, emotion, memory, AI-response validation, prompt, IELTS labels |
| `store.test.mjs` | **11 passed** | v1→v2 migration, per-character chat cap, no silent loss, trim counters, storage report |
| `push.test.mjs` | **40 passed** | RFC 8291 payload decryption, VAPID JWT, schedule rules, character id on inbox messages, honest push prompt, cron output without message text |
| `sync.test.mjs` | **8 passed** | push/pull, deletes, paging, isolation, validation, hashed codes, server delete |
| `worker-route.test.mjs` | **14 passed** | Gemini/Groq order, fallback, photos, Groq JSON-mode retry, GET / |
| `worker-security.test.mjs` | **15 passed** | origin check, access code (when set), rate limit, size and turn limits, bad JSON, timeout fallback, internal key |
| **Total** | **119 passed, 0 failed** (6/6 files) | |

The new tests found one real defect, which is fixed: `cleanProfile({})` stored the character id as the string `"undefined"`.

### Browser checks (built-in browser, 375 × 812, app served by the local mock Worker)

| Check | Result |
|---|---|
| IELTS result shows "≈ band 6.5 (ประมาณการ)"; another scene shows "8/10"; an old result without an id is recognised | PASS |
| IELTS details and result summary show the "not an official score" note; no stray "null" text | PASS |
| Settings storage meter shows space used, counts and the 500-per-character rule | PASS |
| Import replaces the data → undo button appears → undo restores 23 messages and the previous theme; the Worker link is kept; the button hides | PASS |
| No horizontal overflow on the Settings page | PASS |
| Service worker registration on `localhost` in the built-in browser | **FAILED in this environment.** It also fails with an unchanged `sw.js`. On the live GitHub Pages site, registration in the same browser succeeds. It is checked again after deploy (below). |

### Deployment checks

| Check | Result |
|---|---|
| Worker deployed; `GET /` reports `version: 12`, push and sync on, both AIs | PASS |
| `POST /` from another origin → 403 | PASS |
| GitHub Pages serves `buddy-v15` | see the commit notes for this phase (checked after push) |

### Not tested
- Real iPhone: PWA update, push delivery with the new character tag, storage meter on Safari.
- Real AI quality: `tests/live-characters.mjs`. No prompt behaviour changed in the chat path, so it was not run, to save quota.
- The IELTS examiner prompt change with the real model: the result labels are computed by the app, so they do not depend on the model.
- The GitHub Actions run itself: it runs on GitHub after the push.
