# Presenter Auth and Deck CRUD Design

**Date:** 2026-03-26

## Goal

Add the first real presenter backend slice for PlayDeck: Supabase-backed presenter accounts plus authenticated deck and slide CRUD, using a data model that works cleanly with future Reveal.js presentation rendering and interactive slide types.

## Context

The current repo already has a Bootstrap pass in place:

- Next.js App Router application
- placeholder landing, host, and join routes
- a product PRD that calls out Reveal.js and Supabase as core platform choices

For this slice, the user has chosen:

- open presenter signup with email/password
- no email verification gate in v1
- immediate account usability after signup
- one presenter owns many decks
- each deck belongs to exactly one presenter
- dashboard plus separate editor pages
- simple slides only for the first editor
- slide deletion and reordering included in v1
- display name required at signup

Even though the first editor only supports simple slides, the design must leave room for future interactive features like polls, quizzes, code slides, presenter/student view differences, and live session state.

## Source Notes

Current documentation checked on 2026-03-26 via Context7:

- Supabase Next.js App Router guidance recommends `@supabase/ssr` with distinct browser and server clients plus cookie-aware middleware/proxy handling
- Supabase hosted projects require email confirmation by default; immediate-use signup requires disabling `Enable email confirmations` in the Supabase Auth provider settings
- Supabase recommends SQL-managed schema plus generated TypeScript types from the linked project schema
- Reveal.js renders slides as ordered `<section>` nodes, supports speaker notes, and cleanly maps one content record to one rendered slide

## Chosen Approach

Use Supabase Auth for presenter accounts and a normalized Postgres schema for presenter profiles, decks, and deck slides. Build a protected presenter area in Next.js App Router with dedicated auth routes, a deck dashboard route, and a deck editor route.

This is the best fit because it:

- matches the requested dashboard-first UX
- keeps ownership and RLS rules simple
- supports reliable slide reordering and deletion
- preserves a clean mapping from database slide records to future Reveal.js slides
- avoids prematurely building a block editor or interactive authoring model
- keeps the schema extensible for future slide kinds and live session features

## Alternatives Considered

### 1. Store each full deck as a JSON document

Rejected because slide reordering, per-slide updates, future session references, and ownership-aware queries all become harder than necessary.

### 2. Build a richer interactive slide schema from day one

Rejected because it would slow down the first usable presenter workflow and force product decisions that are not needed to ship simple authoring.

### 3. Use a single inline presenter page for all CRUD

Rejected because the user prefers a dashboard plus dedicated editor flow, and the separate editor route provides a better growth path for future authoring complexity.

## Product Scope

This slice adds a first functional presenter experience:

- create a presenter account
- sign in and sign out
- land on a protected presenter dashboard
- create, rename, update, and delete decks
- open a deck editor
- create, edit, reorder, and delete simple slides

The first editor is intentionally narrow:

- slide fields: title, body, speaker notes
- one linear slide list
- no nested vertical stacks yet
- no interactive editing UI yet
- no presentation runtime yet

## Route Design

Add or evolve the app around these presenter routes:

- `/presenter/sign-up`
- `/presenter/sign-in`
- `/presenter/decks`
- `/presenter/decks/[deckId]`

Behavior:

- unauthenticated users trying to access `/presenter/decks` or `/presenter/decks/[deckId]` are redirected to sign-in
- authenticated presenters visiting auth pages can be redirected to the dashboard
- the dashboard shows only the signed-in presenter’s decks
- the editor route loads only the signed-in presenter’s deck and slide data

## Authentication Design

Use Supabase email/password auth with the Next.js SSR package pattern.

### Account creation

Signup collects:

- display name
- email
- password

On successful signup:

1. create the auth user via `supabase.auth.signUp`
2. create a matching `presenter_profiles` row keyed by `auth.users.id`
3. redirect the user into the protected presenter area

### Immediate usability

To satisfy the requested v1 experience, the hosted Supabase project must disable `Enable email confirmations` in the email auth provider settings. Otherwise Supabase will require verification before a usable session is created.

### Session handling

Use cookie-backed SSR auth helpers:

- browser client for client interactions
- server client for server actions and protected data reads
- middleware/proxy layer for auth refresh and route protection

This aligns with current Supabase guidance for Next.js App Router.

## Data Model

The first schema should use three core tables in `public`.

### `presenter_profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `display_name` must be non-empty after trimming

Purpose:

- stores presenter-specific profile data that does not belong in Auth metadata alone
- provides a stable place for future presenter preferences

### `decks`

- `id uuid primary key default gen_random_uuid()`
- `presenter_id uuid not null references public.presenter_profiles(id) on delete cascade`
- `title text not null`
- `description text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `title` must be non-empty after trimming

Indexes:

- index on `(presenter_id, updated_at desc)`

Purpose:

- stores the presenter-owned deck record and dashboard metadata

### `deck_slides`

- `id uuid primary key default gen_random_uuid()`
- `deck_id uuid not null references public.decks(id) on delete cascade`
- `position integer not null`
- `slide_kind text not null default 'simple'`
- `title text not null default ''`
- `body text not null default ''`
- `speaker_notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(deck_id, position)`
- `position >= 0`
- `slide_kind in ('simple')` for v1, with the expectation this check constraint expands later

Indexes:

- index on `(deck_id, position asc)`

Purpose:

- stores ordered slide records for a deck
- provides stable IDs for future session playback, submissions, and presenter controls

## Reveal.js Alignment

The schema is intentionally shaped to work with Reveal.js later:

- each `deck_slides` row maps to one future Reveal `<section>`
- `position` preserves presentation order
- `speaker_notes` can map to Reveal speaker notes support
- `title` and `body` are enough to render simple HTML slides in v1.5 or v2

This design intentionally does not model vertical Reveal stacks yet. When needed, we can add stack/grouping metadata without replacing the current authoring model.

## Interactive-Feature Readiness

The design should stay simple while preserving a clear growth path.

### Prepared now

- `slide_kind` exists from the start
- slide IDs are stable and relational
- deck ownership is explicit
- route boundaries separate auth, dashboard, and editor concerns

### Deferred but enabled by the structure

Future migrations can add:

- new `slide_kind` values like `poll`, `quiz`, and `code`
- `teacher_view` and `student_view` fields
- structured JSON config per slide kind
- session tables that reference `decks` and `deck_slides`
- response/submission tables keyed by `deck_slides.id`

This means the first simple-slide editor is not a dead end. It is a thin vertical slice over a schema that can absorb the interactive roadmap.

## Row Level Security

Enable RLS on all three public tables.

### `presenter_profiles`

- presenters can select their own row
- presenters can insert their own row
- presenters can update their own row

### `decks`

- presenters can select their own decks
- presenters can insert decks where `presenter_id = auth.uid()`
- presenters can update their own decks
- presenters can delete their own decks

### `deck_slides`

Policies should check deck ownership through the parent deck:

- presenters can select slides only when the parent deck belongs to `auth.uid()`
- presenters can insert slides only into their own decks
- presenters can update slides only in their own decks
- presenters can delete slides only in their own decks

This keeps ownership centralized and avoids exposing cross-presenter data.

## Supabase Project Setup

The first implementation pass should include:

- `@supabase/ssr`
- `@supabase/supabase-js`
- environment variables for Supabase URL and publishable key
- SQL migration files for schema, triggers, and RLS
- generated TypeScript database types committed into the app

The project should favor SQL migrations and generated types over handwritten type guesses.

## Application Boundaries

Recommended code boundaries for this slice:

- `lib/supabase/` for client creation and auth helpers
- `features/presenter-auth/` for sign-in and sign-up actions/forms
- `features/decks/` for deck queries, mutations, and deck-specific UI
- `app/presenter/...` routes for composition and navigation

Keep mutation logic close to the presenter features instead of scattering direct client calls across route files.

## UI Design

### Presenter sign-up

Fields:

- display name
- email
- password

States:

- inline validation errors
- Supabase auth errors
- submitting/loading state

### Presenter dashboard

The dashboard should show:

- page title and presenter identity
- create-deck form or dialog
- list of existing decks
- actions to open editor or delete deck

Each deck row or card should show:

- title
- optional description preview
- updated timestamp

### Deck editor

The editor should be usable without becoming a full builder:

- deck metadata form for title and description
- ordered slide list
- button to add a new slide
- per-slide edit form for title, body, and speaker notes
- move up and move down controls for reordering
- delete control with a confirmation step

Reordering can be implemented with explicit move controls in v1 instead of drag-and-drop. That is simpler, more accessible, and enough to satisfy CRUD scope.

## Error Handling

The first implementation should handle these cases clearly:

- duplicate or failed signup
- missing presenter profile row after auth creation
- deck not found or unauthorized access
- failed slide reorder updates
- failed deck or slide deletion

UI behavior should favor inline messages over silent failure.

## Testing and Verification

This slice should be verified at three levels:

### Database

- apply the migration successfully
- confirm RLS blocks cross-user access
- confirm deck deletion cascades to slides
- confirm position uniqueness is enforced

### Auth

- signup creates usable session when email confirmations are disabled
- signup creates a matching profile row
- protected routes redirect when signed out
- sign-in and sign-out behave correctly

### Deck CRUD

- create deck from dashboard
- update deck metadata
- delete deck
- create slide
- edit slide title, body, and notes
- reorder slides
- delete slide

## Explicit Non-Goals

This design does not include:

- live sessions
- participant accounts
- student join flow
- realtime sync
- Reveal.js runtime integration
- poll, quiz, or code slide editors
- collaborative editing
- media uploads

## Risks and Mitigations

### Risk: Immediate signup reduces account trust

Mitigation: accept this for v1 because the product explicitly wants frictionless presenter onboarding. Email verification can be re-enabled later if requirements change.

### Risk: Simple text slide fields may be too limiting

Mitigation: keep `slide_kind` and relational slide IDs now so the schema can expand into richer slide configuration later.

### Risk: Slide reordering can become brittle

Mitigation: keep v1 reordering explicit with move controls and perform updates in a transaction-safe way that preserves unique positions.

### Risk: RLS policies for child slide rows can become error-prone

Mitigation: write policies in terms of deck ownership and add verification steps that test cross-user isolation directly.
