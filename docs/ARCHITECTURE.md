# Language Buddy — Current Architecture

Audit date: 2026-11-04 · Commit audited: `a8124fe` (main) · Worker version 11 · Service worker cache `buddy-v14`

This describes what the code does today, read from the source files (not from README).

## 1. Technology stack

| Layer | What is actually used | Files |
|---|---|---|
| Frontend | Vanilla JavaScript ES modules, no framework, no build step, no npm dependencies | `index.html`, `js/**`, `css/app.css` |
| Hosting | GitHub Pages (static) | repo root |
| Offline / install | PWA: `manifest.json` + service worker (network-first, cache fallback) | `sw.js`, `manifest.json` |
| Local storage | `localStorage` keys `lb_settings`, `lb_state`, `lb_usage`, `lb_push`, `lb_sync` | `js/store.js`, `js/ai.js`, `js/push.js`, `js/sync.js` |
| Backend | One Cloudflare Worker (`worker/worker.js`, ~530 lines), placed in `aws:us-east-1` | `worker/` |
| AI providers | Google Gemini (`gemini-3.5-flash-lite` default) first, Groq (`openai/gpt-oss-120b`) as fallback | `worker/worker.js` |
| Server data | Cloudflare KV `BUDDY` (push subscriptions, profile, pending messages); Cloudflare D1 `language-buddy-db` (sync rows) | `worker/wrangler.toml`, `worker/schema.sql` |
| Rate limit | Workers rate-limit binding `LIMITER`, 40 requests / 60 s per IP | `wrangler.toml` |
| Scheduler | Cron `*/10 * * * *` → `SELF` service binding → `/push/run` | `worker.js` |
| Speech | Browser Web Speech API only (`speechSynthesis`, `SpeechRecognition`) | `js/speech.js` |
| Tests | Plain Node scripts using `node:assert` (no framework) | `tests/` |

## 2. Module map

```
index.html ── js/main.js (router, badges, boot)
               ├─ js/store.js      settings + state, migration/validation (normalizeState), event bus
               ├─ js/ai.js         prompt context, request building, Worker call (chat + Thai→English helper), quota counter
               ├─ js/conversation.js  (Phase 1) turn orchestration without DOM; emits chat:* events to the chat view
               ├─ js/speech.js     TTS + speech recognition (browser)
               ├─ js/stats.js      per-day counters, streak, accuracy, due cards
               ├─ js/srs.js        simplified SM-2 spaced repetition
               ├─ js/sync.js       D1 sync client (row hashing, push/pull)
               ├─ js/push.js       Web Push subscribe, profile upload, inbox
               ├─ js/engine/       PURE logic, no DOM (testable in Node)
               │    characters.js  6 characters + custom "buddy", ROLES, EMOTIONS
               │    roles.js       role priority (scenario > manual > auto > default), session idle reset
               │    emotion.js     emotion state machine, expression + voice tone mapping
               │    memory.js      dedupe, sensitive-text filter, recall, expiry
               │    scenarios.js   17 scenarios as data (5 groups)
               │    response.js    untrusted AI JSON → validated object
               │    prompt.js      system prompt builder, app notes, helper prompt
               │    modes.js       conversation modes, response length, teaching intensity, correction timing
               │    checks.js      reply quality flags (counted, never rewritten)
               └─ js/views/        DOM per page: home, chat, characters, review, roleplay, me, settings, avatar
```

Pages (hash routes): `#home`, `#chat`, `#characters`, `#review`, `#roleplay`, `#me`, `#settings`.

## 3. Entry points

- **Browser**: `index.html` loads `js/main.js` (`type="module"`). `boot()` migrates stored data, applies the theme, wires the chat and settings, starts the router, time tracking, inbox fetch, push profile sync and auto-sync, and registers `sw.js`.
- **Worker `fetch`**: `GET /` (status), `POST /` (chat), `POST /sync`, `POST /sync/delete`, `/push/key|subscribe|sync|inbox|test|unsubscribe`, `POST /push/run` (internal key only).
- **Worker `scheduled`**: every 10 minutes, calls `/push/run` through `SELF`.

## 4. AI request lifecycle (chat)

1. `views/chat.js send()` → `run(text)`: pushes the user message into `state.messages` (tagged with `char`), persists, renders it, shows the typing indicator.
2. `ai.js askAI()`:
   - `promptContext()` gathers settings, level, the active character, its session (`sessionOf`), recalled character memories (`memory.recall`, top 6), shared facts, the last 8 mistakes, weak categories, the last 30 words, and the active scenario.
   - `engine/prompt.js buildSystemPrompt()` builds the whole system prompt **in the browser** (about 7–10k characters).
   - `buildContents()` sends the last 24 messages of this character's thread. User text starting with `[app note` is defused. A photo is sent only on its first turn.
   - `POST` to the Worker with a 45 s timeout and one retry on network error.
3. **Worker**:
   - Checks the origin, then the optional `ACCESS_CODE`, then the per-IP rate limit.
   - Validates sizes (system ≤ 24 000 chars, ≤ 60 turns, body ≤ 1.5 MB, image types).
   - `callAI()` tries Gemini then Groq. Gemini times out after 22 s, Groq after 18 s. Photos go to Gemini only. It returns `{ text, usage, provider, fellBack }`.
4. `engine/response.js parseStructured()`:
   - Extracts or repairs the JSON.
   - Whitelists fields and clamps lengths.
   - Maps the category; checks emotion and role against known lists.
   - Malformed output becomes a plain text reply.
5. `chat.js applyAI()`:
   - Drops a correction that is not about the latest message.
   - Saves the mistake and the new word.
   - Updates memory through `applyMemoryUpdates` (respecting the toggles).
   - Gets the emotion from `nextEmotion`; the role changes through `applyRole(…,'auto')`.
   - Records topic, summary and skill scores, and the scene result.
   - Pushes the bot message, persists, re-renders, speaks it (TTS) and syncs the push profile.

## 5. Memory lifecycle

| Layer | Stored in | Written by | Limits | Read by |
|---|---|---|---|---|
| Shared learner facts | `state.facts` (strings) | AI `memory_updates` scope `learner` → `rememberFact` | 40, dedupe ≥ 0.6 Jaccard, sensitive regex | every character's prompt; push profile (20) |
| Character memory | `state.charMemory[charId]` `{id,text,t,used}` | AI scope `character` → `remember` | 25 per character, expires after 180 days unused | only that character's prompt (`recall` top 6) |
| Session memory | `state.sessions[charId]` `{role, roleSource, scenario, emotion, topic, summary, t, turns}` | `applyAI`, `setRole`, `startScene`, `endScene` | resets after 6 h idle unless a scenario is running | prompt + chat header |
| Learning records | `state.mistakes` (300), `state.vocab` (500), `state.days` (180 days), `state.results` (50), `state.activity` (40), `state.skills` (30 per skill), `state.topics` (30) | chat / review | **oldest silently dropped at cap** | dashboard, review, prompt |
| Chat history | `state.messages` | chat | **300 messages total across all characters, 120 days** | UI + last 24 to AI |

Users can view and delete facts (Me page) and character memories (Characters page), and turn either layer off (Settings). "Delete all memory" clears facts, character memory, topics and session summaries.

## 6. Speech lifecycle

- **TTS**: `speak()` picks a browser voice by language code. English characters use their own accent (en-US/GB/AU/CA when the device has it). Speed = user rate × level factor (A1 0.8 … C2 1.06) × emotion factor. Pitch comes from the emotion. iOS is unlocked with a silent utterance on the first tap.
- **STT**: `listen()` uses `SpeechRecognition` (availability varies by browser and iOS version; when it is missing, the app tells the user to use keyboard dictation). The transcript goes into the text box and is auto-sent if that setting is on. **No audio is recorded, stored or analysed.** No pronunciation scoring exists.

## 7. Storage and database structure

**Browser (`localStorage`)**
- `lb_settings`: the `DEFAULT_SETTINGS` keys (language, level, variant, character, memory toggles, push schedule, AI choice, Worker URL, access code).
- `lb_state` (version 2): `messages, facts, mistakes, vocab, scene, lastSeen, days, activity, results, charMemory, sessions, skills, topics`. Every load goes through `normalizeState()`, which validates, migrates and clamps.
- `lb_usage`: the daily Gemini/Groq request counter (Pacific day).
- `lb_push`: push id and status.
- `lb_sync`: sync code, device id, cursor, row-hash map.

**D1** (`schema.sql`)
- `accounts(id = SHA-256("lb-sync:"+code), rev, created, updated)`
- `items(account, k, d JSON text or NULL = deleted, dev, rev, updated)`, PK `(account, k)`, index `(account, rev)`.
- Row keys: `c:` message, `m:` mistake, `w:` word, `f:` fact, `r:` result, `a:` activity, `d:` day, `s:settings`, `k:<char>:<id>` character memory, `x:skills`, `x:topics`.
- Sessions, usage and push state are not synced.

**KV**: `u:<push-uuid>` → `{ sub, profile (name, persona, level, tz, schedule, 20 facts, 6 recent messages), pending[], sent, lastActive }`.

## 8. Deployment architecture

```
iPhone / browser ──HTTPS──> GitHub Pages (static app, sw.js cache)
        │
        └──HTTPS (CORS, Origin check, optional X-Buddy-Key)──> Cloudflare Worker (us-east-1)
                                     ├─> Gemini API (key = secret)
                                     ├─> Groq API (key = secret)
                                     ├─> D1 (sync)
                                     ├─> KV (push)
                                     └─> Web Push endpoints (VAPID; Apple / Google / Mozilla)
Cron */10 ──> Worker.scheduled ──SELF──> /push/run
```

- Frontend deploy = `git push` (Pages rebuilds in about 1–2 minutes). Clients update on the next load; there is no in-app "update available" prompt.
- Worker deploy = `npx wrangler@4 deploy` from `worker/`. Secrets are set with `wrangler secret put` and never stored in the repo.

## 9. External service dependencies

| Service | Used for | Failure behaviour |
|---|---|---|
| Gemini API (free tier) | chat, photos | 429/5xx/timeout → Groq (except photos) |
| Groq API | fallback chat, push messages (tried first) | error shown to the user, with a retry button |
| Cloudflare Workers / KV / D1 / Rate Limiting | backend | app works offline-only for review; chat needs the Worker |
| GitHub Pages | hosting | the cached shell works offline |
| Browser Web Speech | TTS / STT | features hidden or a toast explains |
| Web Push services | "character texts first" | the subscription is deleted on 404/410 |
