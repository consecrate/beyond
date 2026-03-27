import { describe, expect, it, vi } from "vitest"
import { registerUser, signInUser } from "./service"

describe("registerUser", () => {
  it("creates the auth user with display name metadata", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "x" } },
      error: null,
    })
    const supabase = { auth: { signUp } }

    const result = await registerUser({
      supabase: supabase as never,
      values: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })

    expect(result).toEqual({ ok: true, signedIn: true })
    expect(signUp).toHaveBeenCalledWith({
      email: "teacher@example.com",
      password: "secret12",
      options: { data: { display_name: "Ms. Nguyen" } },
    })
  })

  it("surfaces sign-up failures", async () => {
    const supabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: "User already registered" },
        }),
      },
    }

    const result = await registerUser({
      supabase: supabase as never,
      values: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })

    expect(result).toEqual({
      ok: false,
      error: "User already registered",
    })
  })

  it("treats missing session as verify-email flow", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" }, session: null },
      error: null,
    })
    const supabase = { auth: { signUp } }

    const result = await registerUser({
      supabase: supabase as never,
      values: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })

    expect(result).toEqual({
      ok: true,
      signedIn: false,
      message:
        "Check your email to confirm your account, then sign in here.",
    })
  })

  it("surfaces missing user after sign-up", async () => {
    const supabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: null,
        }),
      },
    }

    const result = await registerUser({
      supabase: supabase as never,
      values: {
        displayName: "Ms. Nguyen",
        email: "teacher@example.com",
        password: "secret12",
      },
    })

    expect(result).toEqual({
      ok: false,
      error: "Unable to create account.",
    })
  })
})

describe("signInUser", () => {
  it("returns an error when Supabase rejects the credentials", async () => {
    const supabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" },
        }),
      },
    }

    const result = await signInUser({
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
