"use client"

import { memo, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import { cn } from "@beyond/design-system"

import type { LessonRow } from "@/features/lessons/queries"
import { transitiveReduction } from "@/features/sessions/graph-transitive-reduction"
import type { SessionSkillGraphPayload } from "@/features/sessions/queries"

type Props = {
  sessionId: string
  lessons: LessonRow[]
  skillGraph: SessionSkillGraphPayload | null
  className?: string
}

type SessionSkillTreeFlowProps = Omit<Props, "skillGraph"> & {
  skillGraph: SessionSkillGraphPayload
}

/** Horizontal distance between prerequisite layers (left → right). */
const LAYER_GAP_X = 260
/** Vertical spacing between nodes that share a layer. */
const LAYER_GAP_Y = 120

type SkillLessonNodeData = {
  label: string
  showSource: boolean
  showTarget: boolean
}

type SkillLessonNode = Node<SkillLessonNodeData, "skillLesson">

const SkillLessonNodeView = memo(function SkillLessonNodeView({
  data,
}: NodeProps<SkillLessonNode>) {
  return (
    <div className="min-w-[140px] rounded-sm border border-border bg-card px-3 py-2 text-center text-sm shadow-sm">
      {data.showTarget ? (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={false}
          className="pointer-events-none opacity-0"
        />
      ) : null}
      <span className="text-foreground">{data.label}</span>
      {data.showSource ? (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          className="pointer-events-none opacity-0"
        />
      ) : null}
    </div>
  )
})

const SKILL_LESSON_NODE_TYPES = {
  skillLesson: SkillLessonNodeView,
} satisfies NodeTypes

function lessonEdgeConnectivity(
  edgeRows: { from_lesson_id: string; to_lesson_id: string }[],
  lessonIds: Set<string>,
): { hasOutgoing: Set<string>; hasIncoming: Set<string> } {
  const hasOutgoing = new Set<string>()
  const hasIncoming = new Set<string>()
  for (const e of edgeRows) {
    if (!lessonIds.has(e.from_lesson_id) || !lessonIds.has(e.to_lesson_id)) {
      continue
    }
    hasOutgoing.add(e.from_lesson_id)
    hasIncoming.add(e.to_lesson_id)
  }
  return { hasOutgoing, hasIncoming }
}

type LessonEdge = { from_lesson_id: string; to_lesson_id: string }

/** Longest-path layer: prerequisites left, dependents right (DAG). */
function computeLessonLayers(
  lessonIds: readonly string[],
  edges: LessonEdge[],
): Map<string, number> {
  const idSet = new Set(lessonIds)
  const outgoing = new Map<string, string[]>()
  const preds = new Map<string, string[]>()
  for (const id of lessonIds) {
    outgoing.set(id, [])
    preds.set(id, [])
  }
  for (const e of edges) {
    if (!idSet.has(e.from_lesson_id) || !idSet.has(e.to_lesson_id)) continue
    outgoing.get(e.from_lesson_id)!.push(e.to_lesson_id)
    preds.get(e.to_lesson_id)!.push(e.from_lesson_id)
  }

  const indeg = new Map<string, number>()
  for (const id of lessonIds) indeg.set(id, 0)
  for (const e of edges) {
    if (!idSet.has(e.from_lesson_id) || !idSet.has(e.to_lesson_id)) continue
    indeg.set(e.to_lesson_id, (indeg.get(e.to_lesson_id) ?? 0) + 1)
  }

  const indexById = new Map(lessonIds.map((id, i) => [id, i]))
  const byCreatedIndex = (a: string, b: string) =>
    (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0)

  const ready = lessonIds
    .filter((id) => (indeg.get(id) ?? 0) === 0)
    .sort(byCreatedIndex)
  const indegCopy = new Map(indeg)
  const topo: string[] = []

  while (ready.length) {
    const u = ready.shift()!
    topo.push(u)
    for (const v of outgoing.get(u) ?? []) {
      const next = (indegCopy.get(v) ?? 1) - 1
      indegCopy.set(v, next)
      if (next === 0) {
        ready.push(v)
        ready.sort(byCreatedIndex)
      }
    }
  }

  for (const id of lessonIds) {
    if (!topo.includes(id)) topo.push(id)
  }

  const layer = new Map<string, number>()
  for (const u of topo) {
    let L = 0
    for (const p of preds.get(u) ?? []) {
      L = Math.max(L, (layer.get(p) ?? 0) + 1)
    }
    layer.set(u, L)
  }
  return layer
}

function buildFlowState(
  lessons: LessonRow[],
  skillGraph: SessionSkillGraphPayload | null,
): {
  nodes: SkillLessonNode[]
  edges: Edge[]
  viewport: { x: number; y: number; zoom: number }
} {
  const sorted = [...lessons].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
  const viewport = skillGraph?.graphMetadata.viewport ?? {
    x: 0,
    y: 0,
    zoom: 1,
  }

  const edgeRows = skillGraph?.edges ?? []
  const allIds = sorted.map((l) => l.id)
  const directed = edgeRows.map((e) => ({
    from: e.from_lesson_id,
    to: e.to_lesson_id,
  }))
  const minimal = transitiveReduction(directed).map((e) => ({
    from_lesson_id: e.from,
    to_lesson_id: e.to,
  }))

  const lessonIds = new Set(sorted.map((l) => l.id))
  const { hasOutgoing, hasIncoming } = lessonEdgeConnectivity(minimal, lessonIds)

  const layer = computeLessonLayers(allIds, minimal)
  const byLayer = new Map<number, LessonRow[]>()
  for (const lesson of sorted) {
    const L = layer.get(lesson.id) ?? 0
    if (!byLayer.has(L)) byLayer.set(L, [])
    byLayer.get(L)!.push(lesson)
  }

  let maxCol = 1
  for (const col of byLayer.values()) {
    maxCol = Math.max(maxCol, col.length)
  }

  const nodes: SkillLessonNode[] = []
  for (const [L, lessonsInLayer] of [...byLayer.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const y0 =
      ((maxCol - lessonsInLayer.length) * LAYER_GAP_Y) / 2
    lessonsInLayer.forEach((lesson, j) => {
      nodes.push({
        id: lesson.id,
        type: "skillLesson",
        position: { x: L * LAYER_GAP_X, y: y0 + j * LAYER_GAP_Y },
        data: {
          label: lesson.title?.trim() || "Untitled lesson",
          showSource: hasOutgoing.has(lesson.id),
          showTarget: hasIncoming.has(lesson.id),
        },
      })
    })
  }

  const edges: Edge[] = minimal.map((e) => ({
    id: `e-${e.from_lesson_id}-${e.to_lesson_id}`,
    type: "smoothstep",
    source: e.from_lesson_id,
    target: e.to_lesson_id,
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  }))

  return { nodes, edges, viewport }
}

function SessionSkillTreeFlow({
  sessionId,
  lessons,
  skillGraph,
  className,
}: SessionSkillTreeFlowProps) {
  const router = useRouter()

  const prepared = useMemo(
    () => buildFlowState(lessons, skillGraph),
    [lessons, skillGraph],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<SkillLessonNode>(
    prepared.nodes,
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(prepared.edges)

  useEffect(() => {
    setNodes(prepared.nodes)
    setEdges(prepared.edges)
  }, [prepared.nodes, prepared.edges, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: unknown, node: SkillLessonNode) => {
      router.push(`/sessions/${sessionId}/lessons/${node.id}`)
    },
    [router, sessionId],
  )

  return (
    <div className={cn("h-full min-h-[240px] w-full bg-muted/10", className)}>
      <ReactFlow<SkillLessonNode>
        key={skillGraph.graphId}
        nodeTypes={SKILL_LESSON_NODE_TYPES}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onInit={(instance) => {
          instance.fitView({ padding: 0.25, duration: 200 })
        }}
        defaultViewport={prepared.viewport}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        className="bg-transparent"
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export function SessionSkillTree(props: Props) {
  const { skillGraph, lessons, className } = props

  if (!skillGraph) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[200px] items-center justify-center rounded-sm border border-dashed border-border/60 bg-muted/10 px-4",
          className,
        )}
      >
        <p className="text-center text-sm text-muted-foreground">
          No skill graph for this session yet.
        </p>
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[200px] items-center justify-center rounded-sm border border-dashed border-border/60 bg-muted/10 px-4",
          className,
        )}
      >
        <p className="text-center text-sm text-muted-foreground">
          Add lessons to see them on the skill graph.
        </p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <SessionSkillTreeFlow
        sessionId={props.sessionId}
        lessons={props.lessons}
        skillGraph={skillGraph}
        className={props.className}
      />
    </ReactFlowProvider>
  )
}
