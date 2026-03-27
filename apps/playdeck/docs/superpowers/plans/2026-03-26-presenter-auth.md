# Presenter Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the presenter auth slice so a user can sign up, get a matching presenter profile, sign in, sign out, and land in the protected presenter dashboard immediately.

**Architecture:** Keep the current Next.js App Router plus `@supabase/ssr` pattern, but move form parsing and auth behavior into small testable modules instead of leaving all logic inside Server Actions. Use unit tests for validation and auth orchestration, then keep the route protection and redirect behavior in the existing `proxy.ts` and presenter routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth with `@supabase/ssr`, Vitest, Testing Library, jsdom

---

## Scope

This plan intentionally covers only the presenter auth slice from the broader auth-plus-decks spec:

- presenter sign-up
- presenter sign-in
- presenter sign-out
- presenter profile creation during sign-up
- protected presenter dashboard access

Deck CRUD stays out of scope for this pass except where it proves auth success by loading `/presenter/decks`.

## Relevant Docs

- Spec: `docs/superpowers/specs/2026-03-26-presenter-auth-deck-crud-design.md`
- Next.js 16.1.6 docs: Vitest is a supported unit-test path, while async Server Components are better verified end to end
- Supabase docs: App Router auth should keep browser/server clients split and use cookie-aware proxy session refresh with `@supabase/ssr`

## File Structure

### Existing files to modify

- `package.json`
  Adds test scripts and auth-focused dev dependencies.
- `tsconfig.json`
  Adds Vitest/jsdom types if needed for test files.
- `features/presenter-auth/actions.ts`
  Becomes a thin Server Action wrapper around testable auth helpers.
- `features/presenter-auth/sign-up-form.tsx`
  Keeps current UI, but may need minor copy tweaks if action return states become more explicit.
- `features/presenter-auth/sign-in-form.tsx`
  Keeps current UI, but may need minor copy tweaks if action return states become more explicit.
- `app/presenter/decks/page.tsx`
  Final verification point for an authenticated presenter session.

### New files to create

- `vitest.config.ts`
  Vitest config for a jsdom-based unit test setup that respects repo path aliases.
- `test/setup.ts`
  Shared test setup for DOM assertions and global cleanup.
- `features/presenter-auth/form-data.ts`
  Parses and validates sign-up/sign-in `FormData` into typed payloads.
- `features/presenter-auth/form-data.test.ts`
  Unit tests for auth form parsing and validation rules.
- `features/presenter-auth/service.ts`
  Testable auth orchestration that talks to Supabase for sign-up, sign-in, and optional profile creation behavior.
- `features/presenter-auth/service.test.ts`
  Unit tests for successful and failing auth service paths using mocked Supabase interfaces.

## Task 1: Add a Lightweight Test Harness

**Files:**
- Create: `vitest.config.ts`
- Create: `test/setup.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Add failing test tooling references**

Create the config shell first so the repo has a concrete place for test setup:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
})
```

- [ ] **Step 2: Install dependencies and wire scripts**

Run:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Add test setup file**

```ts
// test/setup.ts
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 4: Make TypeScript aware of the test environment**

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "vitest/jsdom"]
  }
}
```

- [ ] **Step 5: Run the empty harness once**

Run:

```bash
npm test
```

Expected: exits successfully with `No test files found` or equivalent discovery output.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts test/setup.ts
git commit -m "test: add vitest harness for presenter auth"
```

## Task 2: Extract and Test Auth Form Parsing

**Files:**
- Create: `features/presenter-auth/form-data.ts`
- Create: `features/presenter-auth/form-data.test.ts`
- Modify: `features/presenter-auth/actions.ts`

- [ ] **Step 1: Write the failing validation tests**

```ts
// features/presenter-auth/form-data.test.ts
import { describe, expect, it } from "vitest"
import { parseSignInForm, parseSignUpForm } from "./form-data"

function buildFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

describe("parseSignUpForm", () => {
  it("trims display name and email", () => {
    const result = parseSignUpForm(
      buildFormData({
        displayName: "  Ms. Nguyen  ",
        email: "  teacher@example.com  ",
        password: "secret12",
      }),
    )

    expect(result).toEqual({
      ok: true,
      data: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })
  })

  it("rejects a blank display name", () => {
    const result = parseSignUpForm(
      buildFormData({
        displayName: "   ",
        email: "teacher@example.com",
        password: "secret12",
      }),
    )

    expect(result).toEqual({
      ok: false,
      error: "Display name is required.",
    })
  })
})

describe("parseSignInForm", () => {
  it("rejects a blank email", () => {
    const result = parseSignInForm(
      buildFormData({ email: "   ", password: "secret12" }),
    )

    expect(result).toEqual({
      ok: false,
      error: "Email is required.",
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- features/presenter-auth/form-data.test.ts
```

Expected: FAIL because `parseSignUpForm` and `parseSignInForm` do not exist yet.

- [ ] **Step 3: Implement the minimal parser**

```ts
// features/presenter-auth/form-data.ts
type Success<T> = { ok: true; data: T }
type Failure = { ok: false; error: string }

export type SignUpValues = {
  displayName: string
  email: string
  password: string
}

export type SignInValues = {
  email: string
  password: string
}

export function parseSignUpForm(
  formData: FormData,
): Success<SignUpValues> | Failure {
  const displayName = String(formData.get("displayName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!displayName) return { ok: false, error: "Display name is required." }
  if (!email) return { ok: false, error: "Email is required." }
  if (!password) return { ok: false, error: "Password is required." }

  return { ok: true, data: { displayName, email, password } }
}

export function parseSignInForm(
  formData: FormData,
): Success<SignInValues> | Failure {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email) return { ok: false, error: "Email is required." }
  if (!password) return { ok: false, error: "Password is required." }

  return { ok: true, data: { email, password } }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm test -- features/presenter-auth/form-data.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/presenter-auth/form-data.ts features/presenter-auth/form-data.test.ts
git commit -m "test: add presenter auth form validation"
```

## Task 3: Extract and Test Presenter Auth Service Logic

**Files:**
- Create: `features/presenter-auth/service.ts`
- Create: `features/presenter-auth/service.test.ts`
- Modify: `features/presenter-auth/actions.ts`

- [ ] **Step 1: Write failing service tests**

```ts
// features/presenter-auth/service.test.ts
import { describe, expect, it, vi } from "vitest"
import { registerPresenter, signInPresenter } from "./service"

describe("registerPresenter", () => {
  it("creates the auth user and presenter profile", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" }, session: { access_token: "x" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ insert }),
    }

    const result = await registerPresenter({
      supabase: supabase as never,
      values: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      id: "user-1",
      display_name: "Ms. Nguyen",
    })
  })
})

describe("signInPresenter", () => {
  it("returns an error when Supabase rejects the credentials", async () => {
    const supabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" },
        }),
      },
    }

    const result = await signInPresenter({
      supabase: supabase as never,
      values: {
        email: "teacher@example.com",
        password: "wrong-password",
      },
    })

    expect(result).toEqual({
      ok: false,
      error: "Invalid login credentials",
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- features/presenter-auth/service.test.ts
```

Expected: FAIL because the service module does not exist yet.

- [ ] **Step 3: Implement the minimal auth service**

```ts
// features/presenter-auth/service.ts
import type { SignInValues, SignUpValues } from "./form-data"

type AuthResult = { ok: true } | { ok: false; error: string }

type SupabaseAuthClient = {
  auth: {
    signUp(values: {
      email: string
      password: string
      options?: { data?: Record<string, string> }
    }): Promise<{
      data: { user: { id: string } | null; session: unknown | null }
      error: { message: string } | null
    }>
    signInWithPassword(values: {
      email: string
      password: string
    }): Promise<{ error: { message: string } | null }>
  }
  from(table: "presenter_profiles"): {
    insert(values: { id: string; display_name: string }): Promise<{
      error: { message: string } | null
    }>
  }
}

export async function registerPresenter({
  supabase,
  values,
}: {
  supabase: SupabaseAuthClient
  values: SignUpValues
}): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: { display_name: values.displayName },
    },
  })

  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: "Unable to create account." }

  const { error: profileError } = await supabase
    .from("presenter_profiles")
    .insert({
      id: data.user.id,
      display_name: values.displayName,
    })

  if (profileError) return { ok: false, error: profileError.message }

  return { ok: true }
}

export async function signInPresenter({
  supabase,
  values,
}: {
  supabase: SupabaseAuthClient
  values: SignInValues
}): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword(values)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

- [ ] **Step 4: Run the service tests**

Run:

```bash
npm test -- features/presenter-auth/service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/presenter-auth/service.ts features/presenter-auth/service.test.ts features/presenter-auth/actions.ts
git commit -m "feat: extract presenter auth service"
```

## Task 4: Wire Server Actions to the Tested Helpers

**Files:**
- Modify: `features/presenter-auth/actions.ts`
- Modify: `features/presenter-auth/sign-up-form.tsx`
- Modify: `features/presenter-auth/sign-in-form.tsx`

- [ ] **Step 1: Write one integration-leaning action test or narrow smoke test**

If action testing feels too heavy for the current repo, keep this step small by asserting helper behavior instead of trying to mock Next.js redirects directly. The goal is to lock the contract before wiring.

```ts
// add one more case to service.test.ts
it("surfaces presenter profile insert failures", async () => {
  const supabase = {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" }, session: { access_token: "x" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { message: "duplicate key value violates unique constraint" },
      }),
    }),
  }

  const result = await registerPresenter({
    supabase: supabase as never,
    values: {
      displayName: "Ms. Nguyen",
      email: "teacher@example.com",
      password: "secret12",
    },
  })

  expect(result).toEqual({
    ok: false,
    error: "duplicate key value violates unique constraint",
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- features/presenter-auth/service.test.ts
```

Expected: FAIL until the error path is fully covered.

- [ ] **Step 3: Refactor `actions.ts` into a thin wrapper**

```ts
// features/presenter-auth/actions.ts
"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { parseSignInForm, parseSignUpForm } from "./form-data"
import { registerPresenter, signInPresenter } from "./service"
import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string }

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseSignUpForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const result = await registerPresenter({ supabase, values: parsed.data })
  if (!result.ok) return { error: result.error }

  revalidatePath("/", "layout")
  redirect("/presenter/decks")
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseSignInForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const result = await signInPresenter({ supabase, values: parsed.data })
  if (!result.ok) return { error: result.error }

  revalidatePath("/", "layout")
  redirect("/presenter/decks")
}
```

- [ ] **Step 4: Keep forms aligned with action states**

Confirm the forms still read the same field names and show inline action errors:

```tsx
<Input id="displayName" name="displayName" />
<Input id="email" name="email" type="email" />
<Input id="password" name="password" type="password" />
```

No extra client-side auth library should be introduced.

- [ ] **Step 5: Run focused verification**

Run:

```bash
npm test -- features/presenter-auth/form-data.test.ts features/presenter-auth/service.test.ts
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add features/presenter-auth/actions.ts features/presenter-auth/sign-up-form.tsx features/presenter-auth/sign-in-form.tsx features/presenter-auth/form-data.ts features/presenter-auth/form-data.test.ts features/presenter-auth/service.ts features/presenter-auth/service.test.ts
git commit -m "feat: complete presenter auth flow"
```

## Task 5: Verify Immediate-Access Presenter Login End to End

**Files:**
- Modify: none expected unless verification uncovers a bug

- [ ] **Step 1: Start the app against the configured Supabase project**

Run:

```bash
npm run dev
```

Expected: local Next.js app starts successfully.

- [ ] **Step 2: Manually verify sign-up**

In the browser:

1. Visit `/presenter/sign-up`
2. Submit a new presenter email, password, and display name
3. Confirm you are redirected to `/presenter/decks`
4. Confirm the page shows the presenter welcome state and no auth error

Expected: account is usable immediately with no confirmation screen.

- [ ] **Step 3: Manually verify sign-out and sign-in**

In the browser:

1. Click sign out from `/presenter/decks`
2. Confirm redirect to `/presenter/sign-in`
3. Sign back in with the same credentials
4. Confirm redirect back to `/presenter/decks`

Expected: both transitions succeed without stale-session errors.

- [ ] **Step 4: Manually verify route protection**

In the browser:

1. Open `/presenter/decks` in a signed-out state
2. Confirm redirect to `/presenter/sign-in`
3. While signed in, open `/presenter/sign-in`
4. Confirm redirect to `/presenter/decks`

Expected: `proxy.ts` protects presenter routes and bounces authenticated users away from auth pages.

- [ ] **Step 5: Final verification and commit**

Run:

```bash
npm test -- features/presenter-auth/form-data.test.ts features/presenter-auth/service.test.ts
npm run lint
npm run typecheck
```

Then commit any verification-driven fixes:

```bash
git add features/presenter-auth/actions.ts features/presenter-auth/sign-in-form.tsx features/presenter-auth/sign-up-form.tsx features/presenter-auth/form-data.ts features/presenter-auth/form-data.test.ts features/presenter-auth/service.ts features/presenter-auth/service.test.ts package.json tsconfig.json vitest.config.ts test/setup.ts
git commit -m "chore: verify presenter auth flow"
```

## Notes for the Implementer

- Do not add email confirmation flow in this pass; the product decision is immediate access.
- Keep `proxy.ts`, `lib/supabase/server.ts`, and `lib/supabase/client.ts` aligned with the existing SSR auth pattern rather than introducing a parallel auth stack.
- Prefer small pure helpers over testing Server Actions directly.
- If manual verification shows the hosted project still returns `session: null` after sign-up, stop and re-check the Supabase Auth provider setting before changing code.
