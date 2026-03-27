# PlayDeck Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap PlayDeck as a Next.js App Router app using shadcn with Base UI, then shape the generated template into a minimal product shell with placeholder host/join routes and future integration boundaries.

**Architecture:** Start from the official shadcn Next.js scaffold so the project is configured with TypeScript, Tailwind, and Base UI from the beginning. After generation, keep the first pass intentionally thin: a branded landing page, two placeholder product routes, a small set of UI primitives, and inert feature/integration modules that give future work a predictable home.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS, shadcn CLI, Base UI

---

### Task 1: Scaffold the Base UI Next.js app

**Files:**
- Create: `/Users/thientrung/Projects/PlayDeck/package.json`
- Create: `/Users/thientrung/Projects/PlayDeck/app/layout.tsx`
- Create: `/Users/thientrung/Projects/PlayDeck/app/page.tsx`
- Create: `/Users/thientrung/Projects/PlayDeck/components.json`
- Create: `/Users/thientrung/Projects/PlayDeck/tsconfig.json`
- Create: `/Users/thientrung/Projects/PlayDeck/next.config.ts` or `/Users/thientrung/Projects/PlayDeck/next.config.mjs`
- Test: `/Users/thientrung/Projects/PlayDeck/package.json`

- [ ] **Step 1: Confirm the workspace is still an empty bootstrap target**

Run: `ls -la`
Expected: `PRD.md` and `docs/` exist, and there is no `package.json` yet.

- [ ] **Step 2: Run the shadcn project generator in the current directory**

Run: `npx shadcn@latest create --template next --base base --cwd .`
Expected: the CLI scaffolds a Next.js project, installs dependencies, and writes files like `package.json`, `app/layout.tsx`, and `components.json`.

If the installed CLI only exposes the documented `init` entrypoint, use the equivalent command:

Run: `npx shadcn@latest init -t next -b base -c .`
Expected: the same generated project structure and installed dependencies.

- [ ] **Step 3: Verify the scaffolded file set exists**

Run: `rg --files -g 'package.json' -g 'app/**' -g 'components.json' -g 'tsconfig.json'`
Expected: output includes `package.json`, `app/layout.tsx`, `app/page.tsx`, `components.json`, and `tsconfig.json`.

- [ ] **Step 4: Inspect the generated scripts before editing**

Run: `sed -n '1,220p' package.json`
Expected: scripts include at least `dev`, `build`, and `lint`.

### Task 2: Add the minimal UI primitives and starter routes

**Files:**
- Modify: `/Users/thientrung/Projects/PlayDeck/app/layout.tsx`
- Modify: `/Users/thientrung/Projects/PlayDeck/app/page.tsx`
- Create: `/Users/thientrung/Projects/PlayDeck/app/host/page.tsx`
- Create: `/Users/thientrung/Projects/PlayDeck/app/join/page.tsx`
- Create: `/Users/thientrung/Projects/PlayDeck/components/shared/page-shell.tsx`
- Test: `/Users/thientrung/Projects/PlayDeck/app/page.tsx`

- [ ] **Step 1: Install only the UI primitives the bootstrap actually needs**

Run: `npx shadcn@latest add button card input textarea dialog`
Expected: component files are added under `components/ui/` and the project stays aligned with the Base UI choice from `components.json`.

- [ ] **Step 2: Update the root layout metadata to reflect PlayDeck**

Replace the generated metadata in `/Users/thientrung/Projects/PlayDeck/app/layout.tsx` with a minimal branded version:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayDeck",
  description: "Every slide is a playground.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create a shared page shell for lightweight route composition**

Create `/Users/thientrung/Projects/PlayDeck/components/shared/page-shell.tsx`:

```tsx
type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: PageShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              {description}
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Replace the generated landing page with a PlayDeck bootstrap homepage**

Update `/Users/thientrung/Projects/PlayDeck/app/page.tsx`:

```tsx
import Link from "next/link";

import { PageShell } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const surfaces = [
  {
    href: "/host",
    title: "Host a live deck",
    description: "Presenter controls, session setup, and slide progression will start here.",
  },
  {
    href: "/join",
    title: "Join a live session",
    description: "Students will use this flow to enter a name, pick a team, and follow the session.",
  },
];

export default function HomePage() {
  return (
    <PageShell
      eyebrow="PlayDeck v1"
      title="Every slide is a playground."
      description="A live teaching platform for synchronized slides, team competition, and interactive coding moments."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {surfaces.map((surface) => (
          <Card key={surface.href} className="border-border/60">
            <CardHeader>
              <CardTitle>{surface.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{surface.description}</p>
              <Button asChild>
                <Link href={surface.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
```

- [ ] **Step 5: Add placeholder presenter and participant routes**

Create `/Users/thientrung/Projects/PlayDeck/app/host/page.tsx`:

```tsx
import { PageShell } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HostPage() {
  return (
    <PageShell
      eyebrow="Presenter"
      title="Host a PlayDeck session"
      description="This placeholder route will become the presenter entry point for deck selection, lobby setup, and live controls."
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Bootstrap status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Session creation, attendance, and presenter controls are intentionally deferred until the next vertical slice.
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

Create `/Users/thientrung/Projects/PlayDeck/app/join/page.tsx`:

```tsx
import { PageShell } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function JoinPage() {
  return (
    <PageShell
      eyebrow="Participant"
      title="Join a live session"
      description="This placeholder route marks the future student entry flow for join code, display name, and team selection."
    >
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input aria-label="Session join code" placeholder="Enter session code" disabled />
          <p className="text-sm text-muted-foreground">
            Join validation, lobby membership, and team assignment are intentionally not wired during bootstrap.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 6: Run lint after the route and component changes**

Run: `npm run lint`
Expected: PASS

### Task 3: Add feature boundaries and inert integration stubs

**Files:**
- Create: `/Users/thientrung/Projects/PlayDeck/features/decks/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/features/sessions/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/features/slides/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/features/teams/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/lib/supabase/client.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/lib/supabase/server.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/lib/reveal/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/lib/editor/index.ts`
- Create: `/Users/thientrung/Projects/PlayDeck/.env.example`
- Test: `/Users/thientrung/Projects/PlayDeck/.env.example`

- [ ] **Step 1: Create placeholder domain entry files**

Create `/Users/thientrung/Projects/PlayDeck/features/decks/index.ts`:

```ts
export const decksFeature = {
  name: "decks",
  status: "planned",
} as const;
```

Create `/Users/thientrung/Projects/PlayDeck/features/sessions/index.ts`:

```ts
export const sessionsFeature = {
  name: "sessions",
  status: "planned",
} as const;
```

Create `/Users/thientrung/Projects/PlayDeck/features/slides/index.ts`:

```ts
export const slidesFeature = {
  name: "slides",
  status: "planned",
} as const;
```

Create `/Users/thientrung/Projects/PlayDeck/features/teams/index.ts`:

```ts
export const teamsFeature = {
  name: "teams",
  status: "planned",
} as const;
```

- [ ] **Step 2: Add inert integration placeholder modules**

Create `/Users/thientrung/Projects/PlayDeck/lib/supabase/client.ts`:

```ts
export function getSupabaseBrowserClient() {
  return null;
}
```

Create `/Users/thientrung/Projects/PlayDeck/lib/supabase/server.ts`:

```ts
export function getSupabaseServerClient() {
  return null;
}
```

Create `/Users/thientrung/Projects/PlayDeck/lib/reveal/index.ts`:

```ts
export const revealAdapter = {
  status: "not-configured",
} as const;
```

Create `/Users/thientrung/Projects/PlayDeck/lib/editor/index.ts`:

```ts
export const editorAdapter = {
  status: "not-configured",
} as const;
```

- [ ] **Step 3: Add future-facing environment variable documentation**

Create `/Users/thientrung/Projects/PlayDeck/.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JUDGE0_BASE_URL=
JUDGE0_API_KEY=
```

- [ ] **Step 4: Re-run lint to verify the placeholder modules are clean**

Run: `npm run lint`
Expected: PASS

### Task 4: Verify the bootstrap end to end

**Files:**
- Test: `/Users/thientrung/Projects/PlayDeck/app/page.tsx`
- Test: `/Users/thientrung/Projects/PlayDeck/app/host/page.tsx`
- Test: `/Users/thientrung/Projects/PlayDeck/app/join/page.tsx`

- [ ] **Step 1: Start the development server**

Run: `npm run dev`
Expected: Next.js starts locally and reports a local URL, typically `http://localhost:3000`.

- [ ] **Step 2: Verify the landing page responds**

Run: `curl -I http://localhost:3000`
Expected: HTTP 200 response headers.

- [ ] **Step 3: Verify the placeholder routes respond**

Run: `curl -I http://localhost:3000/host`
Expected: HTTP 200 response headers.

Run: `curl -I http://localhost:3000/join`
Expected: HTTP 200 response headers.

- [ ] **Step 4: Capture any template-specific adjustments before moving on**

Run: `git diff --stat`
Expected: a summary of generated and edited files if the directory has been initialized as a git repository. If git is not initialized, skip this step and note that version-control setup is still pending outside this bootstrap plan.
