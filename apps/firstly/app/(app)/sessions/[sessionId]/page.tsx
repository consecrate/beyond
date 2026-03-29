import { SessionPageClient } from "@/features/sessions/components/session-page-client"

type Props = {
  params: Promise<{ sessionId: string }>
}

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params

  return <SessionPageClient sessionId={sessionId} />
}
