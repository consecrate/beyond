-- One skill graph per session; edges are prerequisite links between lessons (session-scoped).

create table public.session_graphs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,

  graph_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_graphs_session_id_idx on public.session_graphs (session_id);

create trigger session_graphs_updated_at
  before update on public.session_graphs
  for each row execute function public.set_updated_at();

alter table public.session_graphs enable row level security;

create policy "session_graphs_select_own"
  on public.session_graphs for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "session_graphs_insert_own"
  on public.session_graphs for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "session_graphs_update_own"
  on public.session_graphs for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "session_graphs_delete_own"
  on public.session_graphs for delete
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Prerequisites: from_lesson_id -> to_lesson_id (from must be completed before to).

create table public.session_graph_edges (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null references public.session_graphs(id) on delete cascade,

  from_lesson_id uuid not null references public.lessons(id) on delete cascade,
  to_lesson_id uuid not null references public.lessons(id) on delete cascade,

  created_at timestamptz not null default now(),

  check (from_lesson_id <> to_lesson_id),
  unique (graph_id, from_lesson_id, to_lesson_id)
);

create index session_graph_edges_graph_id_idx on public.session_graph_edges (graph_id);

alter table public.session_graph_edges enable row level security;

create policy "session_graph_edges_select_own"
  on public.session_graph_edges for select
  using (
    exists (
      select 1 from public.session_graphs sg
      join public.sessions s on s.id = sg.session_id
      where sg.id = graph_id and s.user_id = auth.uid()
    )
  );

create policy "session_graph_edges_insert_own"
  on public.session_graph_edges for insert
  with check (
    exists (
      select 1 from public.session_graphs sg
      join public.sessions s on s.id = sg.session_id
      where sg.id = graph_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.lessons l
      join public.session_graphs sg on sg.session_id = l.session_id and sg.id = graph_id
      where l.id = from_lesson_id and l.user_id = auth.uid()
    )
    and exists (
      select 1 from public.lessons l
      join public.session_graphs sg on sg.session_id = l.session_id and sg.id = graph_id
      where l.id = to_lesson_id and l.user_id = auth.uid()
    )
  );

create policy "session_graph_edges_update_own"
  on public.session_graph_edges for update
  using (
    exists (
      select 1 from public.session_graphs sg
      join public.sessions s on s.id = sg.session_id
      where sg.id = graph_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.session_graphs sg
      join public.sessions s on s.id = sg.session_id
      where sg.id = graph_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.lessons l
      join public.session_graphs sg on sg.session_id = l.session_id and sg.id = graph_id
      where l.id = from_lesson_id and l.user_id = auth.uid()
    )
    and exists (
      select 1 from public.lessons l
      join public.session_graphs sg on sg.session_id = l.session_id and sg.id = graph_id
      where l.id = to_lesson_id and l.user_id = auth.uid()
    )
  );

create policy "session_graph_edges_delete_own"
  on public.session_graph_edges for delete
  using (
    exists (
      select 1 from public.session_graphs sg
      join public.sessions s on s.id = sg.session_id
      where sg.id = graph_id and s.user_id = auth.uid()
    )
  );
