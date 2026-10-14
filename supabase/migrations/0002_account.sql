-- Phase 3c: account-level snapshots (follower count read from a profile screenshot by the Review worker).
-- Same document shape, RLS and realtime as the other studio tables. Docs: {at, followers, source}.

create table if not exists public.account (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.account enable row level security;
drop policy if exists owner_all on public.account;
create policy owner_all on public.account for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));
create index if not exists account_at_idx on public.account ((data->>'at'));

-- write_doc: allow the new table (same body as 0001, one more name in the list).
create or replace function public.write_doc(p_table text, p_id text, p_data jsonb, p_if_version int default null, p_merge boolean default false)
returns table (id text, version int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
begin
  if p_table is null or p_table <> all (array['books','booknotes','ideas','packs','posts','jobs','runs','reports','qa','metrics','chats','ratings','playbooks','settings','account']) then
    raise exception 'invalid_table: %', p_table;
  end if;

  if p_if_version is null then
    begin
      return query execute format('insert into public.%I (id, data) values ($1, $2) returning id, version', p_table) using p_id, p_data;
    exception when unique_violation then
      raise exception 'version_conflict' using errcode = 'P0001';
    end;
    return;
  end if;

  return query execute format(
    'update public.%I set data = case when $3 then data || $2 else $2 end, version = version + 1, updated_at = now() where id = $1 and version = $4 returning id, version',
    p_table) using p_id, p_data, p_merge, p_if_version;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;
end;
$$;
grant execute on function public.write_doc(text, text, jsonb, int, boolean) to authenticated;

alter publication supabase_realtime add table public.account;
