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
