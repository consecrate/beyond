import { createClient } from "@/lib/supabase/server"

import { AppUserMenu } from "./app-user-menu"

export async function AppUserMenuLoader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const meta = user.user_metadata as { display_name?: string } | undefined
  const displayName =
    typeof meta?.display_name === "string" && meta.display_name.trim()
      ? meta.display_name.trim()
      : user.email?.split("@")[0] ?? "Learner"

  return (
    <AppUserMenu displayName={displayName} email={user.email ?? ""} />
  )
}
