export type DirectedEdge = { from: string; to: string }

function hasPath(
  from: string,
  to: string,
  edges: DirectedEdge[],
  exclude: DirectedEdge | null,
): boolean {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (
      exclude &&
      e.from === exclude.from &&
      e.to === exclude.to
    ) {
      continue
    }
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push(e.to)
  }
  const q: string[] = [from]
  const seen = new Set<string>()
  while (q.length) {
    const u = q.shift()!
    if (u === to) return true
    if (seen.has(u)) continue
    seen.add(u)
    for (const v of adj.get(u) ?? []) q.push(v)
  }
  return false
}

/**
 * Minimal edge set with the same reachability: drop (u→v) when another directed
 * path u⇝v exists. Requires an acyclic graph.
 */
export function transitiveReduction(edges: DirectedEdge[]): DirectedEdge[] {
  const working = edges.filter((e) => e.from !== e.to)
  return working.filter((e) => !hasPath(e.from, e.to, working, e))
}
