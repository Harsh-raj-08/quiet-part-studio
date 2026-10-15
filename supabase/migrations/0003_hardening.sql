-- 0003: least privilege for the public (anon) role. Idempotent: safe to run more than once.
-- RLS already limits every table to the studio owner; this removes the anon role's grants as a second layer,
-- so a leaked anon key cannot even reach the tables or the write function.

-- write_doc: only signed-in users (RLS inside still requires studio_owner). The worker uses the service role.
revoke execute on function public.write_doc(text, text, jsonb, int, boolean) from public;
revoke execute on function public.write_doc(text, text, jsonb, int, boolean) from anon;
grant execute on function public.write_doc(text, text, jsonb, int, boolean) to authenticated;
grant execute on function public.write_doc(text, text, jsonb, int, boolean) to service_role;

-- Tables, sequences and functions in public: nothing for anon, now or in the future.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
