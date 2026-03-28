import ELK from "elkjs/lib/elk.bundled.js"
import type { Edge, Node } from "@xyflow/react"

const elk = new ELK()

export async function layoutSkillTreeWithElk<T extends Node>(
  nodes: T[],
  edges: Edge[],
  nodeWidth: number,
  nodeHeight: number,
): Promise<T[]> {
  if (nodes.length === 0) return nodes

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "UP",
      "elk.spacing.nodeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": "48",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: nodeWidth,
      height: nodeHeight,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  try {
    const layouted = await elk.layout(elkGraph)
    const children = layouted.children ?? []
    const posById = new Map(
      children.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]),
    )
    return nodes.map((n) => {
      const p = posById.get(n.id)
      return p ? { ...n, position: p } : n
    })
  } catch {
    return nodes
  }
}
