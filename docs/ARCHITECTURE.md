# Architecture (Phase 3a–3d)

- `src/app` shell (Sidebar <-> Command bar, theme, hash routing, search, auth gate); every tab (`src/screens/*`) is a full screen.
- `src/data`: `Adapter` interface; `mockAdapter` (tests, demo), `supabaseAdapter` (the only importer of supabase-js); `Store` holds one subscription per collection; writes use `mutate()` = fresh get + ifVersion update, retried once on conflict.
- `src/lib/stages.ts` is the single rule set for stage moves (buttons, drawer, keyboard menu, drag and drop).
- Tests: `node scripts/test.mjs` bundles unit tests and runs them plus the Playwright suite against the mock-mode bundle.

Deliberate behaviour choices: "waiting on you" uses the current studio's rule (so it can differ from the design's mock, which counts only Idea-stage); moving to Scripted needs a pack; a posted idea cannot be dropped; dragging is otherwise free in both directions.

## Phase 3b: Studio and Library

- Routes carry an id: `#studio/{script|frames|qa|posts}/{packId}` opens a pack (no id = the pack grid); `#library/{shelf|notes|bank}/{bookId}`.
- The bundle is ES modules with esbuild code splitting; each screen except Ideas is a lazily loaded chunk (`src/app/screens.tsx`).
- Files live in the private `studio` bucket and documents store only the path: `media/{code}/…` (voice, video), `books/{bookId}/…` (PDF/EPUB), `frames/…` and `qa/…` (written by the worker). `useSignedUrl()` asks the adapter for a 1-hour signed URL and caches it for 50 minutes. The mock adapter serves uploads as object URLs and draws a stand-in for fixture images.
- Studio writes: new pack versions (`{code}-v{n+1}`, from the fresh current doc; voiceover recomputed from beats; `idea.packCurrent` moved), `ratings/{packId}` (every fifth rating queues `taste`), `packs.captionFinal`, `ideas.posted`, `posts.postedAt`, uploads on the idea. Every owner edit to a pack or post (caption, hook swap, revert, posted date) also writes `editedAt` (ISO) and `editedBy: "owner"`; worker versions carry `createdAt` / `createdBy`. Adapters expose the row's `created_at` / `updated_at` as `Doc.createdAt` / `Doc.updatedAt`; the UI shows "Written …" from the document's `createdAt` (else the row) and "Edited …" only when `editedAt` is over a minute later.
- Claude in the page does not exist on Vercel, so every Claude action is a worker job: prompt box quick edit = `writer` + `kind:"edit"`, needs research = `writer`; "Get 3 hook options" = `writer` + `kind:"hooks"`; Write carousel / story set = `writer` + `kind`; Make frames = `art`; Run QA = `qa`; Run Research = `research` (`full` / `notes only`). Each is followed by `fireWorker()`.
- New optional fields read by the UI: `books.topic`, `books.filePath/fileName/fileSize/uploadedAt`, `booknotes.summary`, `jobs.progress {step, of, label}`, `packs.beats[].visual`, `packs.frames[].path`, `qa.checks[].t`, `qa.measurements.safeZonePct/firstWordSec`, `qa.images[].path`. All are jsonb fields, so no migration was needed.

## Phase 3c: Discover, Insights, System

No Claude runs in the page. Every Claude step is a worker job; the page shows its live status and the result when the worker writes it.

Worker contracts added in 3c (job fields the page writes → what the worker must write back):

| Job | Page writes | Worker writes |
|---|---|---|
| Ask Scout | `jobs {node:"scout", kind:"chat", chatId, request}`; the user turn is already appended to `chats/{chatId}.turns` | appends `{role:"assistant", content, at, sources?: string[], ideas?: [{bookTitle, hook}], books?: [{title, author, year, lane, why}]}` to `chats/{chatId}.turns`, sets `updatedAt`, then the job `status: done` (or `failed` + `error`) |
| Research run from a chat | `jobs {node:"scout", chatId, request: <brief>}` (no kind) | `reports/{id} {type:"scout", mode:"briefs", request, jobId, at, summary, candidates, sources}` |
| Read screenshots | `jobs {node:"review", kind:"read-screenshots", ideaCode, files: [paths], request}`; the files are also appended to `metrics/{code}.screenshots` | appends a snapshot `{at, day, views, reach, avgWatchSec, watchThroughPct, likes, comments, saves, shares, follows, profileVisits, skipRatePct, source:"screenshot", note}` to `metrics/{code}.snapshots` and sets `latest`, `updatedAt` |
| Read profile | `jobs {node:"review", kind:"read-profile", files: [path], request}` | `account/{id} {at, followers, source:"screenshot"}` |
| Weekly review | `jobs {node:"review", request:"Weekly review"}` | `reports/{id} {type:"review", weekOf, headline?, note?, summary?, scorecard, wins, misses, patterns, experiments, nextActions, sources?}` and optionally `playbooks/learnings-proposed {text, at, basedOn}` |
| Heartbeat | — | `settings/studio.workerSeenAt` (ISO) on every pass; under 13 h old reads as "online" |
| Runs log | — | `runs/{id} {node, jobId?, target?, summary, status, startedAt, finishedAt?, at}` |

Settings the page now writes to `settings/studio`: `writerLane` (careful|quick), `cadence`, `autoArt`, `notifyQa`, `spacePhilosophy`.
Migration `0002_account.sql` adds the `account` table (same shape, RLS, realtime) and allows it in `write_doc`.

## Phase 3d: time zone, Worker API, fire, playbooks, import

**Time zone.** Every date and clock time renders in the viewer's local zone (`src/lib/format.ts`: `parseWhen` reads date-only strings as local midnight; `hhmm`, `fmtWhen`, `whenText`, `shortDay` use local getters). Stored values stay ISO UTC. Tests pin `TZ=Asia/Kolkata` (scripts/test.mjs, CI) and the browser `timezoneId`; the fixed clock is 2026-10-11 12:00 IST. Fixture generators write IST wall-clock times and convert to UTC.

**Worker API** (`api/worker/[action].ts` → `api/_lib/worker-core.ts`, DB adapter `api/_lib/worker-db.ts`). The only way the scheduled worker touches the Studio. POST only, `Content-Type: application/json`, body ≤ 1 MB, `Authorization: Bearer $WORKER_TOKEN` (constant-time compare). 503 when `WORKER_TOKEN` is unset or shorter than 32 characters; otherwise 401 on a wrong token before anything else (including a missing service role, 503) is revealed. Runs server-side with the service role key; responses are `no-store`. Errors are `{ok:false, error}`.

| Action | Body | Returns |
|---|---|---|
| `next` | `{}` | on Mondays (Asia/Kolkata) first inserts `jobs/{scout,trends,review}-YYYY-MM-DD` (`createdBy:"schedule"`) for each node with no job created in the last 6 days; then atomically claims the oldest queued job (review and taste jobs last) (versioned write; a lost race moves to the next one), sets `status:"running"`, `startedAt`, `runId`, records `settings/studio.workerSeenAt` → `{job, runId}` or `{job:null}` |
| `heartbeat` | `{}` | sets `settings/studio.workerSeenAt` |
| `get` | `{table, id}` | `{doc}` (`{id, version, data}` or null) |
| `query` | `{table, where?:[[field, op, value]], orderBy?:{field, dir}, limit?}` | `{docs}`; ops `eq neq gt gte lt lte in`; limit ≤ 100 (default 50) |
| `write` | `{table, id, data, ifVersion?, merge?, runId?}` | `{id, version}`; 409 on version conflict or when the doc exists and neither `ifVersion` nor `merge` is given |
| `file-url` | `{path}` | 10-minute signed download URL from bucket `studio`; path under `books/`, `media/`, `frames/`, `stats/` or `exports/` |
| `upload-url` | `{path}` | signed upload URL; path must match `^(media\|frames\|exports)/[A-Za-z0-9._/-]+$`, no `..` |

Readable tables: books, booknotes, ideas, packs, posts, jobs, runs, reports, qa, metrics, chats, ratings, playbooks, settings, account. Write rules (nothing is ever deleted; there is no delete action):

- reports, qa, runs, account: free (use `ifVersion` or `merge` for existing docs).
- packs: new versions are inserts; an existing pack takes only merges of `hooks`, `frames`, `critic`. `captionFinal` is never writable.
- ideas: inserts allowed (research). An existing idea takes only merges of `packCurrent`, `hookStyle`, `qaLast`, `updatedAt`, `status` (only Approved → Scripted) and an append-only `history`. Never `posted` or `dropReason`.
- posts, booknotes: inserts; existing docs are merge-only.
- metrics: append-only. A new doc is fine; an existing doc may only grow: `snapshots` and `screenshots` keep every existing entry as a prefix; `latest`, `updatedAt` may change.
- jobs: only the job this run claimed (`runId` must match and status must be `running`), only `status/progress/result/error/finishedAt`, merge. The only job a worker may create is an auto-art job: a plain insert with `node:"art"`, `status:"queued"`, `createdBy:"worker"`, a `packId` that exists, `settings/studio.autoArt` not false, and no queued/running art job for that pack (the server sets `createdAt`, `request` = "Frames for <packId>" and `ideaCode` from the pack, ignoring what the worker sent).
- books: only `topic/status/summary/digest/notesCount/researchedAt/updatedAt`, merged.
- chats: only append to `turns` (new turns must be `role:"assistant"`), plus `updatedAt`.
- playbooks: only `learnings-proposed` and `taste-proposed`.
- settings: only `studio.workerSeenAt`. ratings: never.

```sh
STUDIO_URL=https://quiet-part-studio.vercel.app
api() { curl -sS -X POST "$STUDIO_URL/api/worker/$1" -H "Authorization: Bearer $WORKER_TOKEN" -H "Content-Type: application/json" -d "${2:-{\}}"; }

api next                                   # {"ok":true,"job":{"id":"job-…","version":2,"data":{…}},"runId":"run-…"}
api get '{"table":"packs","id":"IK-07-v5"}'
api query '{"table":"ideas","where":[["status","eq","Approved"]],"orderBy":{"field":"updatedAt","dir":"desc"},"limit":20}'
api write '{"table":"jobs","id":"job-123","runId":"run-abc","merge":true,"data":{"progress":{"step":6,"of":13,"label":"Reading chapter 6 of 13"}}}'
api write '{"table":"jobs","id":"job-123","runId":"run-abc","merge":true,"data":{"status":"done","finishedAt":"2026-10-11T06:40:00Z"}}'
api file-url '{"path":"books/bk-ikigai/book.pdf"}'
api upload-url '{"path":"frames/IK-07/01.png"}'   # then: curl -X PUT --upload-file 01.png "<signedUrl>"
api heartbeat
```

`playbooks/runner.md` is the worker's contract for all jobs. Unit tests (`test/unit/worker.test.ts`) run the core against an in-memory DB.

**Fire** (`api/fire.ts`): owner only (Supabase JWT → `auth.getUser` → `studio_owner` row). Checks the caller before revealing configuration (503 `not_configured` only to the owner). Rate limit: refuses (429) if `settings/studio.lastFireAt` is under 60 s old, otherwise claims the slot with a versioned `write_doc` at the version it read (a lost race is 429; any database error is 503, so it never fails open) and POSTs `{"text": …}` to `ROUTINE_FIRE_URL` with `Authorization: Bearer ROUTINE_FIRE_TOKEN`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01`.

**Playbooks** live in `playbooks/*.md` (brand, runner, scout, trends, research, writer, critic, art, qa, review, taste). Owner data (`taste-profile`, `learnings`) stays in the database. `node scripts/hash-playbooks.mjs` rewrites `playbooks/HASHES.txt` (first 16 hex of sha256 per file); a test fails when they differ (`--check` to verify).

**Import** (`scripts/import-artifact-export.mjs <exportDir> [--dry-run] [--files <dir>]`): reads `<exportDir>/<collection>/<id>.json` (a plain document or an `{id, version, data}` wrapper), upserts each into the table of the same name with the id kept and `version` 1, using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. `--files` uploads a directory to bucket `studio` at the same relative paths. `--dry-run` prints counts and problems only. The owner runs it; CI never does.
