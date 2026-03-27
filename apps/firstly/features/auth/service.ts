import type { SupabaseClient } from "@supabase/supabase-js"

import type { SignInValues, SignUpValues } from "./form-data"

type AuthResult = { ok: true } | { ok: false; error: string }

export type RegisterUserResult =
  | { ok: false; error: string }
  | { ok: true; signedIn: true }
  | { ok: true; signedIn: false; message: string }

export async function registerUser({
  supabase,
  values,
}: {
  supabase: SupabaseClient
  values: SignUpValues
}): Promise<RegisterUserResult> {
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: { display_name: values.displayName },
    },
  })

  if (error) return { ok: false, error: error.message }
  if (!data.user) return { ok: false, error: "Unable to create account." }
  if (!data.session) {
    return {
      ok: true,
      signedIn: false,
      message:
        "Check your email to confirm your account, then sign in here.",
    }
  }
  return { ok: true, signedIn: true }
}

export async function signInUser({
  supabase,
  values,
}: {
  supabase: SupabaseClient
  values: SignInValues
}): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword(values)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
