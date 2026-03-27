Yep. Let’s plant the flag and make this concrete.

I’m going to resolve the one tension like this:

- **v1 persists a lesson as a project/workspace**
- but there is **no cross-lesson learner memory**, no global mastery model, and no universal graph yet
- each lesson owns its own graph, nodes, uploads, extracted problems, and practice history
- later, you can promote repeated patterns/evidence into a **user-level personalized universal graph**

That bends the PRD’s “session-only / no saved graph state” slightly, but keeps the spirit of “no persistent learner profile or cross-session adaptation” intact. The PRD’s core product shape still holds: graph + problem breakdown + lesson unit + practice, math-first, no chat UI, and original generated content.

## The core modeling decision

For **v1**, do **not** make a global `skills` table the heart of the system.

Instead, make the durable root object:

- `lessons` as the user’s persistent workspace/project

Then hang everything else off it:

- `lesson_inputs`
- `lesson_graphs`
- `lesson_nodes`
- `lesson_edges`
- `source_documents`
- `source_problems`
- `node_lessons`
- `practice_problems`
- `practice_attempts`

Then add a few **future-proof bridge columns** so you can later map local lesson nodes into a universal personal graph without ripping out the floorboards.

---

# Recommended Supabase schema

## 1) `lessons`

The top-level workspace/project.

```sql
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),

  entry_mode text not null check (entry_mode in ('topic', 'problem_set', 'mixed')),
  goal_text text,
  subject_domain text not null default 'math',

  -- future bridge to user-level graph later
  future_graph_mode text not null default 'lesson_local'
    check (future_graph_mode in ('lesson_local', 'candidate_for_personal_graph')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Why:** this becomes the stable container the user returns to. It replaces the slippery “session” concept with a product object you already said feels more like a project.

---

## 2) `lesson_inputs`

Messy text or pasted prompts that helped create or extend the lesson.

```sql
create table public.lesson_inputs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  input_type text not null check (input_type in ('text', 'topic_prompt', 'notes', 'problem_prompt')),
  raw_text text not null,

  created_at timestamptz not null default now()
);
```

**Why:** the PRD emphasizes starting from rough notes, pasted topics, copied problem text, and messy inputs.

---

## 3) `source_documents`

Uploaded artifacts: image, PDF, maybe pasted file-backed content.

```sql
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  storage_path text,              -- Supabase Storage path
  mime_type text,
  file_name text,

  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'ready', 'failed', 'ambiguous')),

  extracted_text text,
  extraction_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Why:** the PRD explicitly requires text, image, and PDF input, plus OCR/parsing and graceful failure when extraction quality is poor.

---

## 4) `source_problems`

Individual extracted problems beneath one source document.

```sql
create table public.source_problems (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  problem_index integer not null,
  problem_label text,             -- e.g. "3(a)"
  original_text text,
  normalized_text text,

  page_number integer,
  bbox jsonb,                     -- {x, y, width, height} if useful later
  crop_storage_path text,         -- optional cropped problem image

  decomposition_status text not null default 'pending'
    check (decomposition_status in ('pending', 'processing', 'ready', 'failed', 'ambiguous')),

  learner_status text not null default 'unaddressed'
    check (learner_status in ('unaddressed', 'prereqs_identified', 'ready_to_retry', 'solved')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source_document_id, problem_index)
);
```

**Why:** you said the main stored object is **one source document with extracted problems beneath it**. This is the spine for the problem-driven workflow.

---

## 5) `lesson_graphs`

The graph container inside a lesson.

```sql
create table public.lesson_graphs (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,

  status text not null default 'active'
    check (status in ('active', 'superseded', 'archived')),

  generation_reason text not null
    check (generation_reason in ('initial_topic', 'initial_problem_set', 'expand_from_input', 'manual_regen')),

  source_summary jsonb not null default '{}'::jsonb,
  graph_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index one_active_graph_per_lesson
on public.lesson_graphs (lesson_id)
where status = 'active';
```

**Recommendation:** store **one active graph per lesson**.
When the user adds more input, mutate the active graph rather than snapshotting every little tremor.

**Why:** cheaper, simpler, faster. If later you want history, add an audit log table instead of versioning everything now.

---

## 6) `lesson_nodes`

These are your lesson-sized “skills.”

```sql
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

  -- future-proofing
  canonical_skill_candidate_key text,
  domain_tags text[] not null default '{}',
  future_transfer_metadata jsonb not null default '{}'::jsonb,

  display_order_hint integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Important behavior

- `known` = visually greyed/pruned, but still stored
- `deleted` = user removed it, and downstream branch is cut
- `completed` = learner finished the node’s lesson/practice sufficiently for v1 UI

**Why:** this matches your product controls better than hard-deleting the row every time a user changes their mind.

---

## 7) `lesson_edges`

Prerequisite edges only.

```sql
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
```

**Semantics:** `from_node_id -> to_node_id` means **from is prerequisite of to**.

No typed edges in v1. Clean and sharp.

---

## 8) `problem_node_links`

Connect extracted source problems to prerequisite lesson nodes.

```sql
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
```

**Why:** this powers the “solve a hard problem set” entry. The PRD explicitly wants prerequisite skills identified and tied back to the target problem.

---

## 9) `node_lessons`

The generated lesson content for one node.

Since one skill equals one lesson, this is a 1:1 payload table.

```sql
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
```

**Why:** the PRD gives a very explicit instructional cadence: introduction, worked example, practice, progression.

---

## 10) `practice_problems`

AI-generated but solver-backed practice questions.

```sql
create table public.practice_problems (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  node_id uuid not null references public.lesson_nodes(id) on delete cascade,

  family_key text,          -- "quadratic_factoring_mcq_v1"
  generation_round integer not null default 1,

  prompt_markdown text not null,
  problem_format text not null
    check (problem_format in ('multiple_choice', 'numeric', 'symbolic')),

  options jsonb,            -- array for MCQ
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
```

### Notes

- `family_key` lets you group “more questions of the same form”
- `generation_round` gives you batches without needing a separate batch table yet
- `solver_*` stores the machine-checked truth source, which matters because bad math is poison ivy for trust. The PRD calls mathematically incorrect examples a critical failure.

---

## 11) `practice_attempts`

Final learner submissions.

```sql
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
```

**Why:** you said v1 only really needs submitted answer, correctness, timestamp, and time spent. Keep it lean.

---

## 12) `node_progress`

A small summary table for cheap reads.

```sql
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
```

**Why:** not required, but useful. You do not want every UI load spelunking through raw attempt history like a raccoon in a scrapyard.

---

# What I would _not_ build yet

## Skip these in v1

- global `skills`
- global `skill_edges`
- `misconceptions`
- true spaced repetition scheduling
- cross-lesson memory
- multi-domain ontology
- collaborative lessons
- graph versioning/snapshots
- separate canonical problem bank

You already know where this ship wants to sail, but v1 should not wear a future architecture as a Halloween costume.

---

# The future-proof bridge

Even though v1 is lesson-local, add these now:

## On `lesson_nodes`

- `canonical_skill_candidate_key`
- `domain_tags`
- `future_transfer_metadata`

## On `practice_problems`

- `family_key`

## On `practice_attempts`

- stable `user_id`, `node_id`, and `lesson_id`

That gives you a migration path later:

### Future tables

```sql
personal_skills
personal_skill_edges
personal_skill_state
personal_misconceptions
transfer_links
```

### Migration logic later

Repeated local nodes across lessons can be clustered into a user’s personal graph by:

- title similarity
- shared `family_key`
- common solver / concept signature
- repeated performance evidence
- domain tagging

So the lesson-local graph is your **larval form** 🐛
The universal personal graph is the later butterfly, assuming it survives taxonomy.

---

# Recommended status semantics

## Node status

- `active`: part of the current path
- `known`: greyed out, retained, visually pruned
- `deleted`: explicitly removed by learner, downstream branch removed
- `completed`: lesson/practice complete enough for UI

## Problem learner status

- `unaddressed`
- `prereqs_identified`
- `ready_to_retry`
- `solved`

## Document extraction status

- `pending`
- `processing`
- `ready`
- `failed`
- `ambiguous`

That last one matters because the PRD explicitly wants refusal when extraction or ambiguity is too shaky.

---

# Recommended relational flow

## Topic-driven lesson

1. create `lessons`
2. insert `lesson_inputs`
3. create active `lesson_graphs`
4. insert `lesson_nodes` + `lesson_edges`
5. generate `node_lessons`
6. generate initial `practice_problems`

## Problem-set-driven lesson

1. create `lessons`
2. insert `source_documents`
3. OCR/parse into `source_problems`
4. create `lesson_graphs`
5. insert prerequisite `lesson_nodes` + `lesson_edges`
6. link via `problem_node_links`
7. generate `node_lessons`
8. generate `practice_problems`
9. as learner succeeds, advance `source_problems.learner_status` toward `ready_to_retry` / `solved`

---

# Suggested Supabase Storage layout

```text
/source-documents/{user_id}/{lesson_id}/{file_name}
/problem-crops/{lesson_id}/{source_problem_id}.png
/generated-assets/{lesson_id}/{node_id}/...
```

Keep blobs in Storage, metadata in Postgres. Classic division of labor, fewer tears.

---

# RLS shape

## User-owned tables

Enable RLS and restrict by lesson ownership:

- `lessons`
- `lesson_inputs`
- `source_documents`
- `source_problems`
- `lesson_graphs`
- `lesson_nodes`
- `lesson_edges`
- `problem_node_links`
- `node_lessons`
- `practice_problems`
- `practice_attempts`
- `node_progress`

Pattern:

- user can access rows where `lesson_id` belongs to a lesson with `user_id = auth.uid()`
- `practice_attempts.user_id = auth.uid()`

Since everything is user-owned in v1, this stays pleasantly boring.

---

# My opinionated recommendation on a few choices

## 1. Persist lessons, not sessions

You already drifted toward “project/workspace.” Lean into it.

## 2. Use soft delete for nodes

Even if downstream UI disappears, keep rows with `node_status='deleted'` and set related edges to `edge_status='deleted'`.
This will save you during debugging and analytics.

## 3. Keep lesson content normalized enough

Do **not** store the whole lesson as one giant JSON blob.
At minimum, separate:

- intro
- worked example
- progression

## 4. Store solver code/output

For a math-first app, correctness evidence matters more than aesthetic purity.

## 5. One active graph per lesson

Do not version every graph mutation yet.

---

# The one schema tweak I would make to your current thinking

You said “a skill is actually a lesson.”

For product language, yes. For database language, I would still model it as:

- `lesson_nodes` = the skill-ish unit in the graph
- `node_lessons` = the generated lesson content for that node

That separation keeps the graph stable even if lesson content is regenerated. It also avoids the cursed future where a graph node _is_ a Markdown blob.

---

# Minimal MVP table set

If you want the smallest viable slice, start with just these:

- `lessons`
- `lesson_inputs`
- `source_documents`
- `source_problems`
- `lesson_graphs`
- `lesson_nodes`
- `lesson_edges`
- `problem_node_links`
- `node_lessons`
- `practice_problems`
- `practice_attempts`

That is enough to ship the core loop promised in the PRD: ingest messy input, generate a graph, open lessons, do practice, and map back to original problems.
