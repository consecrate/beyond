-- Sessions contain many lessons. Migrate existing lessons to one session each.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_updated on public.sessions (user_id, updated_at desc);

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;

create policy "sessions_select_own"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "sessions_insert_own"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_delete_own"
  on public.sessions for delete
  using (auth.uid() = user_id);

alter table public.lessons add column session_id uuid;

do $$
declare
  r record;
  sid uuid;
begin
  for r in select id, user_id, title, status, created_at, updated_at from public.lessons loop
    insert into public.sessions (user_id, title, status, created_at, updated_at)
    values (
      r.user_id,
      coalesce(nullif(trim(r.title), ''), 'Session'),
      r.status,
      r.created_at,
      r.updated_at
    )
    returning id into sid;

    update public.lessons set session_id = sid where id = r.id;
  end loop;
end $$;

alter table public.lessons alter column session_id set not null;

alter table public.lessons
  add constraint lessons_session_id_fkey
  foreign key (session_id) references public.sessions(id) on delete cascade;

create index lessons_session_updated on public.lessons (session_id, updated_at desc);
