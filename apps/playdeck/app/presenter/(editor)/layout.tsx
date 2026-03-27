import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export default async function PresenterEditorLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/presenter/sign-in")

  return (
    <div className="presenter-editor-shell flex min-h-svh min-w-0 flex-1 flex-col bg-background">
      {children}
    </div>
  )
}
