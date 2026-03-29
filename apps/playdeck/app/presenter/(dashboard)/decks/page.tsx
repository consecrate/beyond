import { DecksPageClient } from "@/features/decks/components/decks-page-client"

export const metadata = {
  title: "Decks — PlayDeck",
  description: "Manage your presentation decks.",
}

type Props = {
  searchParams: Promise<{ q?: string }>
}

export default async function DecksPage(props: Props) {
  const { q } = await props.searchParams

  return <DecksPageClient searchQuery={q ?? ""} />
}
