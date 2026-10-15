# Setup

## 1. Supabase

1. Create a Supabase project. Auth > Providers: enable Email (magic link). **Disable sign-ups** (Auth > Sign In / Providers > "Allow new users to sign up" off) and create your own user from the dashboard (Auth > Users > Add user).
2. In the SQL editor, run the migrations in order (or `supabase db push`):
   - `supabase/migrations/0001_init.sql`: tables, RLS, `write_doc`, realtime, the private `studio` bucket.
   - `supabase/migrations/0002_account.sql`: the `account` table (follower counts). The app still runs without it (Insights shows an empty follower chart), but the worker's read-profile job needs it.
   - `supabase/migrations/0003_hardening.sql`: removes every grant from the `anon` role and limits `write_doc` to signed-in users. Idempotent.
3. Sign in once, then run this with your user id (Auth > Users):
   `insert into studio_owner (user_id) values ('<your-user-uuid>');`
   Until then the login screen says "Signed in, but this account isn't the studio owner".

## 2. Vercel

Env vars (names only, see `.env.example`):

| Name | Where it is used |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | build time, shipped to the browser. The anon key must be a publishable key (`sb_publishable_…`) or an anon JWT; the build refuses anything else. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (`/api/fire`, `/api/worker`) |
| `WORKER_TOKEN` | server only. At least 32 random characters (`openssl rand -hex 32`); shorter counts as not configured. |
| `ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN` | server only. The routine's API trigger (step 3). |

Deploy. `vercel.json` installs with `npm install --ignore-scripts`, builds with `npm run build` into `dist`, rewrites every non-`/api` path to the SPA and sets the security headers (CSP, nosniff, referrer and permissions policy). If you edit the inline script in `index.html`, run `node scripts/csp.mjs` to update its CSP hash (a test checks it).

## 3. The worker (a scheduled Claude Code routine)

The worker is a Claude Code routine that works the job queue through the Worker API, following `playbooks/runner.md` from this repo.

1. Create the routine on this repository with a schedule (for example every few hours) and the prompt: "Work the Studio job queue: follow playbooks/runner.md."
2. Its cloud environment:
   - **Network access: custom allowlist** with only `quiet-part-studio.vercel.app` and `github.com` (plus whatever the environment needs to clone the repo). Don't use full internet access: everything the worker reads is treated as data, but a narrow allowlist is the real control on where data can go.
   - **Environment variable / secret** `WORKER_TOKEN`: the same value as in Vercel. `STUDIO_URL` defaults to `https://quiet-part-studio.vercel.app` in the playbook.
3. Add an **API trigger** to the routine. Put its URL in Vercel as `ROUTINE_FIRE_URL` and its token as `ROUTINE_FIRE_TOKEN`. "Run worker now" and every queued job then fire the routine through `/api/fire` (owner only, at most once a minute).
4. Check it: queue a job from the studio, then watch System > Jobs; `settings/studio.workerSeenAt` updates on every pass ("Worker online").

Playbooks are pinned by `playbooks/HASHES.txt` (first 16 hex of sha256). After editing a playbook, run `node scripts/hash-playbooks.mjs`; a test fails until you do. Owner data (`taste-profile`, `learnings`) stays in the database, not the repo.

## 4. Importing an export of the old studio

`node scripts/import-artifact-export.mjs <exportDir> --dry-run` prints counts and problems. Without `--dry-run` it upserts with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (ids kept, version 1); `--files <dir>` uploads files to the `studio` bucket at the same relative paths.

## Modes

`STUDIO_MODE=supabase` (default when the Supabase vars are set), `demo` (in-memory invented fixtures, "Demo, changes aren't saved"; this is what GitHub Pages serves), `mock` (tests).

Token rotation and the threat model: see [SECURITY.md](SECURITY.md).
