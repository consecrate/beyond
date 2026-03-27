import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { PresenterSidebar } from "@/features/presenter-shell"

export default async function PresenterDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/presenter/sign-in")

  const profile = await supabase
    .from("presenter_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single()

  const displayName =
    profile.data?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "Presenter"

  return (
    <div className="presenter-dashboard flex min-h-svh flex-col bg-background md:flex-row">
      <PresenterSidebar displayName={displayName} email={user.email ?? ""} />
      <main className="min-h-0 min-w-0 flex-1 overflow-auto px-5 py-6 md:min-h-svh md:px-8 md:py-8">
        {children}
      </main>
    </div>
  )
}
