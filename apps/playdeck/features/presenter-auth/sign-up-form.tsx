"use client"

import { useActionState } from "react"
import Link from "next/link"

import { signUp, type AuthState } from "./actions"
import { Button, Input } from "@beyond/design-system"

const initialState: AuthState = {}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display name
        </label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          required
          autoComplete="name"
          placeholder="Ms. Nguyen"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/presenter/sign-in"
          className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
