# Setup

1. Create a Supabase project. Auth > Providers: enable Email (magic link). **Disable sign-ups** (Auth > Sign In / Providers > "Allow new users to sign up" off) and create your own user from the dashboard (Auth > Users > Add user).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
3. Sign in once, then run this with your user id (Auth > Users):
   `insert into studio_owner (user_id) values ('<your-user-uuid>');`
   Until then the login screen says "Signed in, but this account isn't the studio owner".
4. Vercel env vars (names only, see `.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (build time, public), `SUPABASE_SERVICE_ROLE_KEY`, `ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN`, `WORKER_TOKEN` (server only).
5. Deploy. `vercel.json` builds with `npm run build` into `dist` and rewrites every non-`/api` path to the SPA.

Modes: `STUDIO_MODE=supabase` (default when the Supabase vars are set), `demo` (in-memory fixtures, "Demo, changes aren't saved" pill), `mock` (tests).
