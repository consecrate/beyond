# PlayDeck Bootstrap Design

**Date:** 2026-03-26

## Goal

Set up a fresh PlayDeck codebase using the current `shadcn` Next.js project creator with `Base UI`, giving us a clean v1 foundation for presenter, student, and session flows without prematurely implementing product behavior.

## Context

The repository currently contains only [`PRD.md`](/Users/thientrung/Projects/PlayDeck/PRD.md). The PRD defines a live teaching platform with:

- synchronized presenter and student slide experiences
- distinct host and participant flows
- interactive slide types including Poll, MCQ, and Code
- team competition and live session state
- future integrations with Supabase, Reveal.js, Monaco, and Judge0 CE

For the first scaffold, we want fast setup, low configuration drift, and a structure that keeps future vertical slices easy to add.

## Source Notes

Current documentation checked on 2026-03-26:

- shadcn’s January 2026 Base UI changelog confirms Base UI is supported in `npx shadcn create`
- shadcn CLI docs confirm `create` is an alias for `init`
- Next.js 16.1.x docs confirm App Router, TypeScript, and Tailwind remain the recommended fresh-app defaults

## Chosen Approach

Use `npx shadcn create` in the current project directory, choose the Next.js template, and select `Base UI` as the primitive library.

This is the best fit because it:

- uses the current, officially supported shadcn setup path
- avoids manual configuration drift during bootstrap
- keeps future `shadcn add` component installs aligned with the chosen `Base UI` foundation
- lets us spend effort on app boundaries instead of initial plumbing

## Alternatives Considered

### 1. `create-next-app` followed by manual shadcn setup

Rejected because it adds manual configuration work without helping this repo yet.

### 2. Bootstrap the project and wire all integrations immediately

Rejected because it would mix foundational setup with product architecture decisions that should be implemented in smaller slices later.

## Architecture

The bootstrap will be a single Next.js App Router application in TypeScript with Tailwind and shadcn components backed by Base UI primitives.

We will keep the setup intentionally thin:

- app shell
- shared UI foundation
- feature-first folders for core domains
- inert integration stubs for future external services

This keeps the initial scaffold small while giving clear landing zones for the PRD’s core concepts: decks, sessions, slides, teams, and submissions.

## Initial File Structure

The exact generated files will depend on the shadcn template, but the first-pass project should be shaped toward this structure:

```text
app/
  layout.tsx
  page.tsx
  host/page.tsx
  join/page.tsx
components/
  ui/
  shared/
features/
  decks/
  sessions/
  slides/
  teams/
lib/
  supabase/
  reveal/
  editor/
public/
.env.example
components.json
```

### Responsibilities

- `app/`: top-level routes and route-specific composition
- `components/ui/`: shadcn-generated primitives
- `components/shared/`: PlayDeck-specific reusable UI pieces
- `features/`: domain slices that will absorb business logic over time
- `lib/`: framework and integration adapters

## Initial Routes

The first setup pass should create only three pages:

- `/`: simple PlayDeck landing page with product framing and links into the first surfaces
- `/host`: placeholder presenter entry surface
- `/join`: placeholder student join surface

These routes exist to prove the app shell works and to anchor the next planning slices. They do not need real backend behavior yet.

## Initial UI Scope

Only add a small set of components we know we can use immediately:

- `button`
- `card`
- `input`
- `textarea`
- `dialog`

The goal is to avoid pulling in a large registry payload before we know the actual first feature slice.

## Integration Stubs

Add lightweight placeholders for future dependencies:

- Supabase client/server setup modules
- Reveal.js adapter placeholder
- Monaco editor adapter placeholder
- `.env.example` entries for Supabase and Judge0

These should not perform live work yet. They only reserve clear integration boundaries.

## Explicit Non-Goals

This bootstrap does **not** implement:

- authentication
- realtime sync
- session state transitions
- scoring rules
- team creation flows
- slide authoring
- Reveal.js presentation runtime
- Monaco editor behavior
- Judge0 execution

## Testing and Verification

Bootstrap verification should stay simple:

- install the generated dependencies successfully
- run the dev server
- confirm `/`, `/host`, and `/join` render without runtime errors
- confirm Tailwind styles and shadcn/Base UI components render correctly
- run the default lint command if the scaffold includes one

## Follow-On Planning

After bootstrap, the next implementation plan should break work into vertical slices:

1. app shell and navigation
2. deck and slide authoring model
3. host and join session entry flows
4. session state and synchronization
5. interactive slide types and scoring

## Risks and Mitigations

### Risk: Over-scaffolding too early

Mitigation: keep generated pages and components minimal and avoid speculative abstractions.

### Risk: Integration folders imply completed functionality

Mitigation: keep stubs clearly named and inert, with comments or placeholder exports that make the intent explicit.

### Risk: Template output differs from assumptions

Mitigation: treat the shadcn scaffold as the source of truth, then adapt the surrounding folder structure after generation instead of fighting the template.
