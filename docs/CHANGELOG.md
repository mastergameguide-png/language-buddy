# Changelog

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

### Other
- README: the scenario count, the IELTS disclaimer, where data is stored, the caps and how to run tests.
- `views/chat.js`: removed an unused variable.
- Service worker cache `buddy-v15`.

### Not changed
- Access control (R-H1): owner's decision.
- Sync encryption (R-M2): not in Phase 0.5 scope.
