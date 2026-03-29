/** Directed graph has a cycle (DFS). */
export function graphHasCycle(
  edges: { from_lesson_id: string; to_lesson_id: string }[],
  nodeIds: Set<string>,
): boolean {
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    if (!nodeIds.has(e.from_lesson_id) || !nodeIds.has(e.to_lesson_id)) continue
    adj.get(e.from_lesson_id)!.push(e.to_lesson_id)
  }
  const state = new Map<string, 0 | 1 | 2>()
  for (const id of nodeIds) state.set(id, 0)
  const dfs = (u: string): boolean => {
    state.set(u, 1)
    for (const v of adj.get(u) ?? []) {
      const s = state.get(v) ?? 0
      if (s === 1) return true
      if (s === 0 && dfs(v)) return true
    }
    state.set(u, 2)
    return false
  }
  for (const id of nodeIds) {
    if ((state.get(id) ?? 0) === 0 && dfs(id)) return true
  }
  return false
}
