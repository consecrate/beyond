"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { parseSignInForm, parseSignUpForm } from "./form-data"
import { registerUser, signInUser } from "./service"
import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string; info?: string }

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseSignUpForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const result = await registerUser({ supabase, values: parsed.data })
  if (!result.ok) return { error: result.error }
  if (!result.signedIn) return { info: result.message }

  revalidatePath("/", "layout")
  redirect("/sessions")
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = parseSignInForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const result = await signInUser({ supabase, values: parsed.data })
  if (!result.ok) return { error: result.error }

  revalidatePath("/", "layout")
  redirect("/sessions")
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "global" })
  revalidatePath("/", "layout")
  redirect("/sign-in")
}
