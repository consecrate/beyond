-- Firstly — durable lesson workspace schema (graphs, practice, ingestion).
-- Source of truth: apps/firstly/SCHEMA.md

-- ---------- helper: updated_at ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- lessons ----------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),

  entry_mode text not null check (entry_mode in ('topic', 'problem_set', 'mixed')),
  goal_text text,
  subject_domain text not null default 'math',

  future_graph_mode text not null default 'lesson_local'
    check (future_graph_mode in ('lesson_local', 'candidate_for_personal_graph')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_user_updated on public.lessons (user_id, updated_at desc);

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

alter table public.lessons enable row level security;

create policy "lessons_select_own"
  on public.lessons for select
  using (auth.uid() = user_id);

create policy "lessons_insert_own"
  on public.lessons for insert
  with check (auth.uid() = user_id);

create policy "lessons_update_own"
  on public.lessons for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lessons_delete_own"
  on public.lessons for delete
  using (auth.uid() = user_id);

-- ---------- lesson_inputs ----------

create table public.lesson_inputs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  input_type text not null check (input_type in ('text', 'topic_prompt', 'notes', 'problem_prompt')),
  raw_text text not null,

  created_at timestamptz not null default now()
);

create index lesson_inputs_lesson_created on public.lesson_inputs (lesson_id, created_at desc);

alter table public.lesson_inputs enable row level security;

create policy "lesson_inputs_all_own_lesson"
  on public.lesson_inputs for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- source_documents ----------

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  storage_path text,
  mime_type text,
  file_name text,

  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'ready', 'failed', 'ambiguous')),

  extracted_text text,
  extraction_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger source_documents_updated_at
  before update on public.source_documents
  for each row execute function public.set_updated_at();

alter table public.source_documents enable row level security;

create policy "source_documents_all_own_lesson"
  on public.source_documents for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- source_problems ----------

create table public.source_problems (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  problem_index integer not null,
  problem_label text,
  original_text text,
  normalized_text text,

  page_number integer,
  bbox jsonb,
  crop_storage_path text,

  decomposition_status text not null default 'pending'
    check (decomposition_status in ('pending', 'processing', 'ready', 'failed', 'ambiguous')),

  learner_status text not null default 'unaddressed'
    check (learner_status in ('unaddressed', 'prereqs_identified', 'ready_to_retry', 'solved')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_document_id, problem_index)
);

create trigger source_problems_updated_at
  before update on public.source_problems
  for each row execute function public.set_updated_at();

alter table public.source_problems enable row level security;

create policy "source_problems_all_own_lesson"
  on public.source_problems for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- lesson_graphs ----------

create table public.lesson_graphs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  status text not null default 'active'
    check (status in ('active', 'superseded', 'archived')),

  generation_reason text not null
    check (generation_reason in (
      'initial_topic', 'initial_problem_set', 'expand_from_input', 'manual_regen'
    )),

  source_summary jsonb not null default '{}'::jsonb,
  graph_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index one_active_graph_per_lesson
  on public.lesson_graphs (lesson_id)
  where status = 'active';

alter table public.lesson_graphs enable row level security;

create policy "lesson_graphs_all_own_lesson"
  on public.lesson_graphs for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- lesson_nodes ----------

create table public.lesson_nodes (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null references public.lesson_graphs(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  title text not null,
  slug text,
  summary text,

  node_status text not null default 'active'
    check (node_status in ('active', 'known', 'deleted', 'completed')),

  node_kind text not null default 'lesson_skill'
    check (node_kind in ('lesson_skill', 'target_problem_bridge')),

  canonical_skill_candidate_key text,
  domain_tags text[] not null default '{}',
  future_transfer_metadata jsonb not null default '{}'::jsonb,

  display_order_hint integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lesson_nodes_updated_at
  before update on public.lesson_nodes
  for each row execute function public.set_updated_at();

alter table public.lesson_nodes enable row level security;

create policy "lesson_nodes_all_own_lesson"
  on public.lesson_nodes for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- lesson_edges ----------

create table public.lesson_edges (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null references public.lesson_graphs(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  from_node_id uuid not null references public.lesson_nodes(id) on delete cascade,
  to_node_id uuid not null references public.lesson_nodes(id) on delete cascade,

  edge_status text not null default 'active'
    check (edge_status in ('active', 'deleted')),

  created_at timestamptz not null default now(),

  check (from_node_id <> to_node_id),
  unique (graph_id, from_node_id, to_node_id)
);

alter table public.lesson_edges enable row level security;

create policy "lesson_edges_all_own_lesson"
  on public.lesson_edges for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- problem_node_links ----------

create table public.problem_node_links (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  source_problem_id uuid not null references public.source_problems(id) on delete cascade,
  node_id uuid not null references public.lesson_nodes(id) on delete cascade,

  link_role text not null default 'required'
    check (link_role in ('required', 'helpful', 'target_bridge')),

  rationale text,
  confidence numeric(5,4),

  created_at timestamptz not null default now(),

  unique (source_problem_id, node_id)
);

alter table public.problem_node_links enable row level security;

create policy "problem_node_links_all_own_lesson"
  on public.problem_node_links for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- node_lessons ----------

create table public.node_lessons (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null unique references public.lesson_nodes(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  intro_markdown text not null,
  worked_example_markdown text not null,
  progression_markdown text,

  content_status text not null default 'ready'
    check (content_status in ('draft', 'ready', 'failed')),

  generator_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger node_lessons_updated_at
  before update on public.node_lessons
  for each row execute function public.set_updated_at();

alter table public.node_lessons enable row level security;

create policy "node_lessons_all_own_lesson"
  on public.node_lessons for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- practice_problems ----------

create table public.practice_problems (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  node_id uuid not null references public.lesson_nodes(id) on delete cascade,

  family_key text,
  generation_round integer not null default 1,

  prompt_markdown text not null,
  problem_format text not null
    check (problem_format in ('multiple_choice', 'numeric', 'symbolic')),

  options jsonb,
  correct_option_index integer,

  worked_solution_markdown text not null,

  solver_language text not null default 'javascript'
    check (solver_language in ('javascript')),
  solver_code text,
  solver_inputs jsonb not null default '{}'::jsonb,
  solver_outputs jsonb not null default '{}'::jsonb,

  canonical_answer jsonb,
  difficulty text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

alter table public.practice_problems enable row level security;

create policy "practice_problems_all_own_lesson"
  on public.practice_problems for all
  using (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

-- ---------- practice_attempts ----------

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  practice_problem_id uuid not null references public.practice_problems(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  node_id uuid not null references public.lesson_nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  submitted_answer jsonb not null,
  is_correct boolean not null,

  time_spent_seconds integer,
  submitted_at timestamptz not null default now()
);

alter table public.practice_attempts enable row level security;

create policy "practice_attempts_select_own"
  on public.practice_attempts for select
  using (auth.uid() = user_id);

create policy "practice_attempts_insert_own"
  on public.practice_attempts for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

create policy "practice_attempts_update_own"
  on public.practice_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "practice_attempts_delete_own"
  on public.practice_attempts for delete
  using (auth.uid() = user_id);

-- ---------- node_progress ----------

create table public.node_progress (
  node_id uuid primary key references public.lesson_nodes(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  lesson_opened_at timestamptz,
  first_completed_at timestamptz,

  total_attempts integer not null default 0,
  correct_attempts integer not null default 0,

  mastery_state text not null default 'not_started'
    check (mastery_state in ('not_started', 'in_progress', 'proficient')),

  updated_at timestamptz not null default now()
);

create trigger node_progress_updated_at
  before update on public.node_progress
  for each row execute function public.set_updated_at();

alter table public.node_progress enable row level security;

create policy "node_progress_select_own"
  on public.node_progress for select
  using (auth.uid() = user_id);

create policy "node_progress_insert_own"
  on public.node_progress for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id and l.user_id = auth.uid())
  );

create policy "node_progress_update_own"
  on public.node_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "node_progress_delete_own"
  on public.node_progress for delete
  using (auth.uid() = user_id);
