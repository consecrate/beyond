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
