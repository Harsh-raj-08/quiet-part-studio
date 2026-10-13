# Architecture (Phase 3a)

- `src/app` shell (Sidebar <-> Command bar, theme, hash routing, search, auth gate); `src/screens/ideas` is the full Ideas screen; other tabs are placeholders.
- `src/data`: `Adapter` interface; `mockAdapter` (tests, demo), `supabaseAdapter` (the only importer of supabase-js); `Store` holds one subscription per collection; writes use `mutate()` = fresh get + ifVersion update, retried once on conflict.
- `src/lib/stages.ts` is the single rule set for stage moves (buttons, drawer, keyboard menu, drag and drop).
- Tests: `node scripts/test.mjs` bundles unit tests and runs them plus the Playwright suite against the mock-mode bundle.

Deliberate behaviour choices: "waiting on you" uses the current studio's rule (so it can differ from the design's mock, which counts only Idea-stage); moving to Scripted needs a pack; a posted idea cannot be dropped; dragging is otherwise free in both directions.
