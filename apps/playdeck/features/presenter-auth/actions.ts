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

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/presenter/sign-in")
}
