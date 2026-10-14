# Architecture (Phase 3a + 3b)

- `src/app` shell (Sidebar <-> Command bar, theme, hash routing, search, auth gate); `src/screens/ideas`, `src/screens/studio` and `src/screens/library` are full screens; Discover, Insights and System are placeholders.
- `src/data`: `Adapter` interface; `mockAdapter` (tests, demo), `supabaseAdapter` (the only importer of supabase-js); `Store` holds one subscription per collection; writes use `mutate()` = fresh get + ifVersion update, retried once on conflict.
- `src/lib/stages.ts` is the single rule set for stage moves (buttons, drawer, keyboard menu, drag and drop).
- Tests: `node scripts/test.mjs` bundles unit tests and runs them plus the Playwright suite against the mock-mode bundle.

Deliberate behaviour choices: "waiting on you" uses the current studio's rule (so it can differ from the design's mock, which counts only Idea-stage); moving to Scripted needs a pack; a posted idea cannot be dropped; dragging is otherwise free in both directions.

## Phase 3b: Studio and Library

- Routes carry an id: `#studio/{script|frames|qa|posts}/{packId}` opens a pack (no id = the pack grid); `#library/{shelf|notes|bank}/{bookId}`.
- The bundle is ES modules with esbuild code splitting; each screen except Ideas is a lazily loaded chunk (`src/app/screens.tsx`).
- Files live in the private `studio` bucket and documents store only the path: `media/{code}/…` (voice, video), `books/{bookId}/…` (PDF/EPUB), `frames/…` and `qa/…` (written by the worker). `useSignedUrl()` asks the adapter for a 1-hour signed URL and caches it for 50 minutes. The mock adapter serves uploads as object URLs and draws a stand-in for fixture images.
- Studio writes: new pack versions (`{code}-v{n+1}`, from the fresh current doc; voiceover recomputed from beats; `idea.packCurrent` moved), `ratings/{packId}` (every fifth rating queues `taste`), `packs.captionFinal`, `ideas.posted`, `posts.postedAt`, uploads on the idea.
- Claude in the page does not exist on Vercel, so every Claude action is a worker job: prompt box quick edit = `writer` + `kind:"edit"`, needs research = `writer`; "Get 3 hook options" = `writer` + `kind:"hooks"`; Write carousel / story set = `writer` + `kind`; Make frames = `art`; Run QA = `qa`; Run Research = `research` (`full` / `notes only`). Each is followed by `fireWorker()`.
- New optional fields read by the UI: `books.topic`, `books.filePath/fileName/fileSize/uploadedAt`, `booknotes.summary`, `jobs.progress {step, of, label}`, `packs.beats[].visual`, `packs.frames[].path`, `qa.checks[].t`, `qa.measurements.safeZonePct/firstWordSec`, `qa.images[].path`. All are jsonb fields, so no migration was needed.
