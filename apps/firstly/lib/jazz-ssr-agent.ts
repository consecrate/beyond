import { createSSRJazzAgent } from "jazz-tools"

import { getJazzSyncPeer } from "@/features/jazz/env"

let agent: ReturnType<typeof createSSRJazzAgent> | undefined

export function getFirstlySSRAgent() {
  if (!agent) {
    agent = createSSRJazzAgent({ peer: getJazzSyncPeer() })
  }
  return agent
}
