-- Quiet Part Studio v2: initial schema.
-- Document-style tables (id, data jsonb, version) so worker playbooks and the data migration stay simple.

create table public.studio_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.studio_owner enable row level security;
create policy studio_owner_select_self on public.studio_owner for select using (user_id = auth.uid());
-- No insert/update/delete policies: clients cannot write. Add the owner once from the SQL editor (docs/SETUP.md).

create table public.books (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.books enable row level security;
create policy owner_all on public.books for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.booknotes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.booknotes enable row level security;
create policy owner_all on public.booknotes for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.ideas (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.ideas enable row level security;
create policy owner_all on public.ideas for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.packs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.packs enable row level security;
create policy owner_all on public.packs for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.posts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.posts enable row level security;
create policy owner_all on public.posts for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.jobs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.jobs enable row level security;
create policy owner_all on public.jobs for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.runs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.runs enable row level security;
create policy owner_all on public.runs for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.reports (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.reports enable row level security;
create policy owner_all on public.reports for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.qa (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.qa enable row level security;
create policy owner_all on public.qa for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.metrics (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.metrics enable row level security;
create policy owner_all on public.metrics for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.chats (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.chats enable row level security;
create policy owner_all on public.chats for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.ratings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.ratings enable row level security;
create policy owner_all on public.ratings for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.playbooks (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.playbooks enable row level security;
create policy owner_all on public.playbooks for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create table public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.settings enable row level security;
create policy owner_all on public.settings for all
  using (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));

create index ideas_status_idx on public.ideas ((data->>'status'));
create index ideas_book_idx on public.ideas ((data->>'bookId'));
create index packs_idea_idx on public.packs ((data->>'ideaCode'));
create index jobs_status_idx on public.jobs ((data->>'status'));
create index jobs_node_idx on public.jobs ((data->>'node'));
create index booknotes_book_idx on public.booknotes ((data->>'bookId'));
create index ratings_pack_idx on public.ratings ((data->>'packId'));
create index reports_type_idx on public.reports ((data->>'type'));

-- Versioned write. security invoker: RLS applies to the caller.
-- p_if_version null  -> insert (fails if the row exists)
-- otherwise          -> update where version = p_if_version; merge when p_merge; raises 'version_conflict' on 0 rows.
create or replace function public.write_doc(p_table text, p_id text, p_data jsonb, p_if_version int default null, p_merge boolean default false)
returns table (id text, version int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
begin
  if p_table is null or p_table <> all (array['books','booknotes','ideas','packs','posts','jobs','runs','reports','qa','metrics','chats','ratings','playbooks','settings']) then
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

-- Realtime
alter publication supabase_realtime add table public.books;
alter publication supabase_realtime add table public.booknotes;
alter publication supabase_realtime add table public.ideas;
alter publication supabase_realtime add table public.packs;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.qa;
alter publication supabase_realtime add table public.metrics;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.ratings;
alter publication supabase_realtime add table public.playbooks;
alter publication supabase_realtime add table public.settings;

-- Storage: private bucket, 50 MB per file, owner only.
insert into storage.buckets (id, name, public, file_size_limit)
values ('studio', 'studio', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy studio_files_owner on storage.objects for all
  using (bucket_id = 'studio' and exists (select 1 from public.studio_owner o where o.user_id = auth.uid()))
  with check (bucket_id = 'studio' and exists (select 1 from public.studio_owner o where o.user_id = auth.uid()));
