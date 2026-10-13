# Quiet Part Studio v2: build spec (Phase 3)

The goal is to rebuild the studio as a deployable web app:
- React + TypeScript single-page app, bundled with esbuild
- Vercel serverless functions for the API
- Supabase for Postgres, Auth, Realtime and Storage

The UI is a faithful port of the owner's Claude Design file. Behaviour is a port of the current studio, a single-file vanilla app at `/home/claude/quiet-part-studio/index.html` whose specs are SPEC.md–SPEC6.md in the same folder.

## Constraints of this workspace
- **No npm registry access here.** Locally use only what's in `/opt/npm-tools/node_modules`:
  - react 19.2, react-dom 19.2
  - esbuild 0.28 (`/opt/npm-tools/node_modules/.bin/esbuild`)
  - typescript 6
  - zod
  - playwright (Node library; Chromium at `/opt/pw-browsers`; never run `playwright install`)

  Set `NODE_PATH=/opt/npm-tools/node_modules` for local scripts.
- `@supabase/supabase-js` is NOT available locally. All Supabase use goes through `src/data/supabaseAdapter.ts`, which imports it. The local test build aliases `@supabase/supabase-js` to `test/stubs/supabase.ts` and runs the app in **mock mode** (see Data layer).
- `package.json` must still declare the real dependencies, because Vercel and GitHub Actions run `npm install`:
  - deps: react, react-dom, @supabase/supabase-js, zod
  - devDeps: esbuild, typescript, @types/react, @types/react-dom, @types/node, @vercel/node, playwright

  Pin exact, well-known versions.
- Type definitions for React aren't installed locally. Write code that will typecheck in CI (`tsc --noEmit`), but don't block on local typecheck.

## Repository layout (repo root = /home/claude/qps-repo)
```
index.html                 # app shell; loads /assets/app.js and /assets/app.css
src/
  main.tsx                 # boot: picks adapter (supabase | mock), renders <App/>
  app/App.tsx              # shell: Sidebar <-> CommandBar, theme, routing (hash), drawer host, toasts
  design/tokens.css        # Night + Paper tokens, fonts, grain, vignette, keyframes (from the design file)
  design/primitives.tsx    # Pill, Stamp, Chip, Seg (segmented), Hairline, Eyebrow, Headline (two-part + lilac underline), MarginNote, Toast
  screens/ideas/*          # Board, Card, Column, Drawer, StageStrip, ListView, filters, DnD
  screens/{discover,library,studio,insights,system}/*   # later phases; placeholders now
  data/types.ts            # zod schemas + TS types for every collection
  data/store.ts            # React hooks: useCollection(name), useDoc(coll,id); a write API (set/update with ifVersion)
  data/adapter.ts          # interface Adapter { subscribe, get, set, update, uploadFile, signedUrl, fireWorker, user }
  data/mockAdapter.ts      # in-memory, seeded from test/fixtures/*.json; also used for the public demo
  data/supabaseAdapter.ts  # real adapter
  lib/headlines.ts, lib/pages.ts (page-overlap), lib/format.ts, lib/stages.ts (stage rules shared by buttons + DnD)
api/
  fire.ts                  # POST, owner-only: fires the Claude routine
  worker/[action].ts       # worker API (later phase; stub that returns 501 now)
  _lib/auth.ts             # verify Supabase JWT, owner check
supabase/migrations/0001_init.sql
test/                      # node:test + playwright library; fixtures; stubs
scripts/build.mjs          # esbuild bundle (prod) + copy index.html to dist
scripts/build-test.mjs     # mock-mode bundle for tests (alias supabase-js to the stub)
.github/workflows/ci.yml   # npm ci, typecheck, build, run tests (installs Chromium in CI)
vercel.json                # buildCommand "npm run build", outputDirectory "dist", SPA rewrite to /index.html, /api untouched
.env.example               # names only, no values
docs/                      # this spec, architecture, decisions
```

## Database (Supabase Postgres): `supabase/migrations/0001_init.sql`
- **Document-style tables**, one per collection. This keeps the worker playbooks and the migration simple:
  - Collections: books, booknotes, ideas, packs, posts, jobs, runs, reports, qa, metrics, chats, ratings, playbooks, settings
  - Columns: `id text primary key, data jsonb not null default '{}', version int not null default 1, created_at timestamptz default now(), updated_at timestamptz default now()`
- **Indexes:**
  - ideas: `data->>'status'`, `data->>'bookId'`
  - packs: `data->>'ideaCode'`
  - jobs: `data->>'status'`, `data->>'node'`
  - booknotes: `data->>'bookId'`
  - ratings: `data->>'packId'`
  - reports: `data->>'type'`
- **`studio_owner(user_id uuid primary key references auth.users)`.** RLS on every table is: `select/insert/update/delete using (exists (select 1 from studio_owner o where o.user_id = auth.uid()))`. `studio_owner` itself: select own row only, no client writes.
- **`write_doc(p_table text, p_id text, p_data jsonb, p_if_version int, p_merge boolean) returns table(id text, version int)`**, `security invoker`:
  - Whitelist `p_table` against the 14 names and raise on anything else; use `format('%I')`.
  - `p_if_version` null → insert, and fail if the row exists.
  - Otherwise update `where version = p_if_version`, merge if `p_merge` (`data || p_data`), `version = version + 1`, `updated_at = now()`.
  - Raise `'version_conflict'` when 0 rows are affected.
- **Realtime:** `alter publication supabase_realtime add table …` for all 14 tables.
- **Storage:** private bucket `studio` (50 MB file size limit), with owner-only policies via `studio_owner`.
- **Seed:** none. Data migration is a later phase.

## Data layer
- `Adapter.subscribe(coll, cb)` delivers the full current list, then live changes. Supabase uses an initial select plus a `postgres_changes` channel; it keeps a local map and calls `cb` with the array. One subscription per collection for the app's lifetime (the same rule as before).
- **Writes:**
  - `set(coll, id, data)` creates.
  - `update(coll, id, patch, {ifVersion})` merges.
  - `replace(coll, id, data, {ifVersion})`.
  - A version conflict surfaces a typed error. The UI then re-reads and retries once for history appends, which are the same fresh-get pattern as now.
- **Mock adapter:** the same interface, in memory, seeded from `test/fixtures/*.json`.
  - Expose `window.__mock` (`writes` log, `reset()`, `seed()`) only when `import.meta`/build flag `MOCK=1`.
  - The public demo build uses the mock adapter with demo fixtures and writes kept in memory, with a small "Demo, changes aren't saved" pill.
- `main.tsx` chooses the adapter: `VITE`-style globals are not available, so the build injects `window.__QPS_CONFIG = {mode:'supabase'|'mock'|'demo', supabaseUrl, supabaseAnonKey}` via esbuild `define` from env vars at build time. The anon key is public by design; RLS protects the data.

## Auth
- Supabase magic link. The login screen is in the design's language: wordmark, one email field, "Send link".
- Sign-ups are disabled in the Supabase dashboard (documented in `docs/SETUP.md`). After first login, the owner runs one SQL line to insert their `user_id` into `studio_owner`; it's documented, and the login screen shows "Signed in, but this account isn't the studio owner" until then.

## Phase 3a scope (THIS build)
Foundation plus the shell plus the complete Ideas screen. Everything below must match the design exactly.

### Design sources
- `/home/claude/redesign/src/Quiet Part Studio.dc.html`. Its `<helmet>` styles, templates, and the script with the component logic are the source of truth for sizes, fonts, colours, spacing and motion. It uses React underneath, so port its markup and inline styles into TSX components (keep the inline-style objects or move them to CSS with identical values).
- `/home/claude/redesign/AUDIT.md` lists every measurement and the known differences.
- Screenshots of the design: `/home/claude/redesign/audit/design-*.png`.
- To render the design: http server on 127.0.0.1:8765 serving `/home/claude/redesign/src` (start one if `curl 127.0.0.1:8765` fails), plus Python Playwright with `add_init_script(open('/home/claude/redesign/shim/react-umd.js').read())`, aborting non-127.0.0.1 requests. Scripts to copy from: `/home/claude/redesign/nav2.py` and `/home/claude/redesign/cmd.py`.

### Shell
The owner's rule: **the Sidebar is the default; hiding it (⌘\ / Ctrl+\ or the collapse button) shows the Command bar; showing it again returns to the Sidebar.** Copy the design exactly:
- Easing `cubic-bezier(.65,0,.25,1)`.
- Shell grid `gridTemplateColumns` 264px ↔ 0, transition .5s.
- Aside: opacity 1↔0 (.3s; delay .15s when appearing, 0 when hiding), translateX 0↔-24px .5s, `visibility` switched after .5s when hiding, `pointer-events` none when hidden.
- Command bar wrapper: sticky top, `grid-template-rows` 0fr↔1fr .5s, opacity 0↔1 (.35s; delay .15s when appearing), translateY(-10px)↔0 .5s.
- Utility row (breadcrumb + search) height 64↔0 .5s, opacity .25s, border colour .3s.
- Everything else as in the design: wordmark with the lilac seed dot; centred 560 search pill "Jump to an idea, book, pack or run" with ⌘K hint; status "● N running"; Night/Paper segmented toggle; the mono step tabs row with the lilac dot on the active tab, plus System.
- Remember the collapsed state in localStorage (try/catch).
- `prefers-reduced-motion` → no transitions.
- Night/Paper theme exactly from the design's token objects, set on `body[data-theme]` (not `<html>`), remembered.
- Grain and vignette layers as in the design.
- Hash routing: `#ideas`, `#discover`, … plus sub-tabs `#studio/script`. The default route is Ideas, as in the design.
- Global search: keep the current app's behaviour (books, ideas, packs, notes, scouted; keyboard; groups). Style the results panel per AUDIT §5: same width as the pill, `sf`, `line2`, r16, shadow.
- Toasts as an ink pill.

### Ideas screen (design default screen)
- Eyebrow with the date, two-part headline from `lib/headlines.ts` (port the current HEADLINES logic), margin note.
- **Stage strip:** seven columns with counts; zero counts dimmed. Clicking one smooth-scrolls the board to that column (the design's behaviour), not a filter.
- **Filter row:** book chips with counts, evidence select, "Show dropped" dashed pill, Board | List segmented control. The "Showing X of Y" mono text at the right end of the chip row when filtered.
- **Board columns:** italic Newsreader title, mono two-digit count, dashed vertical rules, horizontal scroll. Equal column widths as in the design; cards sorted by score desc within a column.
- **Cards**, exactly per the design: code, score `n/20`, hook, hairline, `¹ FROM · BOOK` + evidence stamp (Tilted by default), and the design's action set per stage:
  - Idea: Approve / Drop
  - Approved: Write pack (with the writer running line)
  - Scripted: Open pack vN / Upload voice / Mark voiced
  - Voiced: Upload video / Mark produced
  - Produced: Run QA, plus a caution "Last QA said FIX" line
  - QA passed: Open pack / Mark posted
  - Posted: date + compact views
  - Dropped: Restore

  Upload buttons open a file picker; the real upload works through the adapter. All actions use the stage rules in `lib/stages.ts`.
- **Drag and drop (the owner specifically wants this, exactly as designed):**
  - HTML5 drag on cards, using the design's `onDragStart` / `onDragOver` / `onDragLeave` / `onDrop`.
  - While dragging: the source card fades to .35 opacity; the hovered column highlights per the design; a dashed "Drop here" placeholder the same height as the dragged card appears at the index where it will land (score-sorted position).
  - Drop moves the idea to that stage through the same `lib/stages.ts` rules as the buttons, with a fresh-get + history append:
    - dropping into Voiced without a voiceover asks inline (upload or "Mark voiced without file")
    - Produced without a video does the same
    - Posted asks for the date and link
    - dropping onto Dropped asks for a reason
    - an invalid move shows a toast and returns the card
  - Keyboard alternative: focus a card, then "m" opens a "Move to…" menu (accessibility).
  - Reduced motion: no fade animation.
- **List view** per the design.
- **Drawer**, per the design and AUDIT §2.1:
  - No page dim; 480px; header with code · stage and a Close pill; FROM line with pages; big hook; THE QUIET PART italic; 4-up score row with bars directly under it; labelled sections; history as a timeline with dots, oldest→newest with dates.
  - Footer: "Drop idea" + "Move to <next> →" (Voiced/Produced prompt for files as above), plus "Move back one stage" as a quiet text button.
  - Keep the current app's drawer extras (sources links, book notes for these pages, files & QA chip, latest stats), styled with the design's patterns (AUDIT §5).

### Other tabs in 3a
Each shows the hero for that screen and a quiet "Arrives in the next build" empty block in the design's empty-state language, so navigation and the transition can be tested on every tab.

### API in 3a
- `api/fire.ts`: verifies the Supabase JWT from the `Authorization` header (supabase-js `auth.getUser(token)` with the service key) and checks `studio_owner`. Then it POSTs to `process.env.ROUTINE_FIRE_URL` with `Authorization: Bearer ${ROUTINE_FIRE_TOKEN}`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01`, body `{text: "jobs queued"}`.
  - Debounce: refuse if fired within 60 s (keep the last fire time in the `settings` table).
  - Return `{ok, sessionUrl?}`. Never return or log tokens.
- The client's `fireWorker()` calls `/api/fire` with the session token. On failure: toast "Queued. It runs at the next scheduled check."

## Tests (node:test + playwright library, run against the mock-mode build served by a tiny static server)
- Shell:
  - Sidebar is the default.
  - ⌘\ hides it and shows the command bar.
  - Capture frames at 0, 150, 300, 500 ms: no element overlaps the content area, no layout jump of the content's left edge beyond the animated width.
  - The state is remembered.
  - The reduced-motion emulation switches instantly.
- Theme toggle and persistence.
- Ideas:
  - Counts, headline templates, strip scroll, book/evidence filters.
  - Cards per stage with the right actions.
  - Drag and drop: placeholder index for each score position, highlight, the source fades, drop writes stage + history, Voiced/Produced/Posted/Dropped prompts, invalid move reverts.
  - Keyboard move menu.
  - Drawer contents and footer moves.
- Visual parity: screenshots of the app vs the design at 1440×1000 for Ideas (Sidebar and Command bar, Night and Paper) and the drawer, saved side by side to `test/output/parity-*.png`. Report the pixel-diff percentage per pair. Use the same mock data in both if feasible (you may feed the design's mock dataset into fixtures for the parity run).
- Console clean. No body x-scroll at 1440 or 1024.
- CI workflow runs the same tests (`npx playwright install --with-deps chromium` there).

## Rules
- Never put secrets in the repo. `.env.example` lists names only:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN`
  - `WORKER_TOKEN`, `STUDIO_MODE`
- No `innerHTML` with data; React escaping only. Links: https only, with `rel="noopener noreferrer"`.
- Commit nothing; leave the work tree for review. The owner's identity is already configured.
- Report: what's built, the test counts, the parity percentages, and anything that couldn't match.
