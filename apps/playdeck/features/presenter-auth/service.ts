import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import type { SignInValues, SignUpValues } from "./form-data"

type AuthResult = { ok: true } | { ok: false; error: string }

export async function registerPresenter({
  supabase,
  values,
}: {
  supabase: SupabaseClient<Database>
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
  supabase: SupabaseClient<Database>
  values: SignInValues
}): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword(values)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
