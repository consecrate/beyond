/**
 * WebSocket URL for Jazz Cloud sync.
 * Prefer `NEXT_PUBLIC_JAZZ_API_KEY` (see https://dashboard.jazz.tools); otherwise set the full peer URL.
 */
export function getJazzSyncPeer(): `wss://${string}` | `ws://${string}` {
  const apiKey = process.env.NEXT_PUBLIC_JAZZ_API_KEY?.trim()
  if (apiKey) {
    return `wss://cloud.jazz.tools/?key=${encodeURIComponent(apiKey)}` as const
  }
  return (
    process.env.NEXT_PUBLIC_JAZZ_SYNC_PEER ??
    "wss://cloud.jazz.tools/?key=dev@example.com"
  ) as `wss://${string}`
}
