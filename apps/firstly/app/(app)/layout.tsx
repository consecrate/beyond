import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in")

  return (
    <div className="min-h-svh bg-background">
      <main className="min-h-svh overflow-auto px-5 pb-0 md:px-8">
        {children}
      </main>
    </div>
  )
}
