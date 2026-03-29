import { SessionsPageClient } from "@/features/sessions/components/sessions-page-client"

export const metadata = {
  title: "Sessions — Firstly",
  description: "Your session workspaces and lessons.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

export default async function SessionsPage(props: Props) {
  const { q } = await props.searchParams

  return <SessionsPageClient searchQuery={q ?? ""} />
}
