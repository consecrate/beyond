"use client"

import { memo, useCallback, useEffect, useMemo, useRef } from "react"
import {
  applyEdgeChanges,
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
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnEdgesChange,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import { cn } from "@beyond/design-system"

import type { LessonRow } from "@/features/lessons/queries"
import { transitiveReduction } from "@/features/sessions/graph-transitive-reduction"
import type { SessionSkillGraphPayload } from "@/features/sessions/queries"
import { layoutSkillTreeWithElk } from "@/features/sessions/skill-tree-elk-layout"
import { SkillTreeBezierEdge } from "@/features/sessions/session-skill-tree-edge"

type Props = {
  lessons: LessonRow[]
  skillGraph: SessionSkillGraphPayload | null
  selectedLessonId?: string | null
  onLessonSelect?: (lessonId: string) => void
  className?: string
}

type SessionSkillTreeFlowProps = Omit<Props, "skillGraph"> & {
  skillGraph: SessionSkillGraphPayload
}

/** Fixed node width for manual fallback + ELK; keep in sync with card CSS below. */
const SKILL_NODE_WIDTH_PX = 200
/** Approximate rendered height (line-clamp-3 + padding) for ELK. */
const SKILL_NODE_HEIGHT_PX = 72
/** Vertical distance between prerequisite ranks (foundational bottom → advanced top). */
const VERTICAL_RANK_GAP = 200
/** Left-edge to left-edge spacing (≥ SKILL_NODE_WIDTH_PX + visual gap). */
const HORIZONTAL_SIBLING_GAP = 220

type SkillLessonNodeData = {
  label: string
  /** Number of outgoing edges (single top-center source handle when > 0). */
  outgoingCount: number
  /** Number of incoming edges (bottom target handles, spread). */
  incomingCount: number
  selected?: boolean
}

type SkillLessonNode = Node<SkillLessonNodeData, "skillLesson">

const handleSpreadStyle = (index: number, count: number) => ({
  left: `${((index + 1) / (count + 1)) * 100}%`,
  transform: "translateX(-50%)",
})

const sourceHandleCenterStyle = {
  left: "50%",
  transform: "translateX(-50%)",
} as const

const SkillLessonNodeView = memo(function SkillLessonNodeView({
  data,
}: NodeProps<SkillLessonNode>) {
  const { outgoingCount, incomingCount } = data
  return (
    <div
      className={cn(
        "rounded-sm border bg-card px-3 py-2 text-center text-sm shadow-sm",
        data.selected
          ? "border-primary ring-2 ring-primary/35"
          : "border-border",
      )}
      style={{ width: SKILL_NODE_WIDTH_PX, maxWidth: SKILL_NODE_WIDTH_PX }}
    >
      {incomingCount > 0
        ? Array.from({ length: incomingCount }, (_, i) => (
            <Handle
              key={`t-${i}`}
              id={`t-${i}`}
              type="target"
              position={Position.Bottom}
              isConnectable={false}
              className="pointer-events-none opacity-0"
              style={handleSpreadStyle(i, incomingCount)}
            />
          ))
        : null}
      <span className="line-clamp-3 text-foreground" title={data.label}>
        {data.label}
      </span>
      {outgoingCount > 0 ? (
        <Handle
          id="s-0"
          type="source"
          position={Position.Top}
          isConnectable={false}
          className="pointer-events-none opacity-0"
          style={sourceHandleCenterStyle}
        />
      ) : null}
    </div>
  )
})

const SKILL_LESSON_NODE_TYPES = {
  skillLesson: SkillLessonNodeView,
} satisfies NodeTypes

const SKILL_TREE_EDGE_TYPES = {
  skillBezier: SkillTreeBezierEdge,
} satisfies EdgeTypes

type LessonEdge = { from_lesson_id: string; to_lesson_id: string }

function edgeKey(e: LessonEdge): string {
  return `${e.from_lesson_id}-${e.to_lesson_id}`
}

/** Stable per-edge target indices so multiple incoming edges spread along the bottom. */
function buildTargetHandleIndicesByEdge(minimal: LessonEdge[]): {
  targetIndexByEdge: Map<string, number>
  outgoingByLesson: Map<string, number>
  incomingByLesson: Map<string, number>
} {
  const outgoingByLesson = new Map<string, number>()
  const incomingByLesson = new Map<string, number>()
  for (const e of minimal) {
    outgoingByLesson.set(
      e.from_lesson_id,
      (outgoingByLesson.get(e.from_lesson_id) ?? 0) + 1,
    )
    incomingByLesson.set(
      e.to_lesson_id,
      (incomingByLesson.get(e.to_lesson_id) ?? 0) + 1,
    )
  }

  const byTgt = new Map<string, LessonEdge[]>()
  for (const e of minimal) {
    if (!byTgt.has(e.to_lesson_id)) byTgt.set(e.to_lesson_id, [])
    byTgt.get(e.to_lesson_id)!.push(e)
  }

  const targetIndexByEdge = new Map<string, number>()

  for (const arr of byTgt.values()) {
    arr.sort((a, b) => a.from_lesson_id.localeCompare(b.from_lesson_id))
    arr.forEach((e, i) => targetIndexByEdge.set(edgeKey(e), i))
  }

  return {
    targetIndexByEdge,
    outgoingByLesson,
    incomingByLesson,
  }
}

/** Longest-path layer: higher L = farther along the DAG; layout maps L to vertical rank (bottom → top). */
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

  const { targetIndexByEdge, outgoingByLesson, incomingByLesson } =
    buildTargetHandleIndicesByEdge(minimal)

  const layer = computeLessonLayers(allIds, minimal)
  const byLayer = new Map<number, LessonRow[]>()
  for (const lesson of sorted) {
    const L = layer.get(lesson.id) ?? 0
    if (!byLayer.has(L)) byLayer.set(L, [])
    byLayer.get(L)!.push(lesson)
  }

  let maxSiblings = 1
  for (const col of byLayer.values()) {
    maxSiblings = Math.max(maxSiblings, col.length)
  }

  let maxLayer = 0
  for (const L of layer.values()) {
    maxLayer = Math.max(maxLayer, L)
  }

  const nodes: SkillLessonNode[] = []
  for (const [L, lessonsInLayer] of [...byLayer.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const x0 =
      ((maxSiblings - lessonsInLayer.length) * HORIZONTAL_SIBLING_GAP) / 2
    const y = (maxLayer - L) * VERTICAL_RANK_GAP
    lessonsInLayer.forEach((lesson, j) => {
      nodes.push({
        id: lesson.id,
        type: "skillLesson",
        position: { x: x0 + j * HORIZONTAL_SIBLING_GAP, y },
        data: {
          label: lesson.title?.trim() || "Untitled lesson",
          outgoingCount: outgoingByLesson.get(lesson.id) ?? 0,
          incomingCount: incomingByLesson.get(lesson.id) ?? 0,
        },
      })
    })
  }

  const edges: Edge[] = minimal.map((e) => {
    const k = edgeKey(e)
    return {
      id: `e-${e.from_lesson_id}-${e.to_lesson_id}`,
      type: "skillBezier",
      source: e.from_lesson_id,
      target: e.to_lesson_id,
      sourceHandle: "s-0",
      targetHandle: `t-${targetIndexByEdge.get(k) ?? 0}`,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    }
  })

  return { nodes, edges, viewport }
}

/** Marker defs use `marker.color` (see @xyflow/system createMarkerIds), not path inline style. */
const SKILL_EDGE_MARKER_STROKE = "var(--foreground)" as const

function syncSkillBezierMarkerEnd(edge: Edge): Edge {
  if (edge.type !== "skillBezier") return edge
  const m = edge.markerEnd
  if (typeof m !== "object" || m === null) return edge
  if (edge.selected) {
    return { ...edge, markerEnd: { ...m, color: SKILL_EDGE_MARKER_STROKE } }
  }
  const withoutColor = { ...m } as { color?: string } & typeof m
  delete withoutColor.color
  return { ...edge, markerEnd: withoutColor }
}

function mergeNodeSelection(
  list: SkillLessonNode[],
  selectedId: string | null | undefined,
): SkillLessonNode[] {
  return list.map((n) => ({
    ...n,
    data: { ...n.data, selected: n.id === selectedId },
  }))
}

function SessionSkillTreeFlow({
  lessons,
  skillGraph,
  selectedLessonId,
  onLessonSelect,
  className,
}: SessionSkillTreeFlowProps) {
  const selectedRef = useRef(selectedLessonId)
  useEffect(() => {
    selectedRef.current = selectedLessonId
  }, [selectedLessonId])

  const prepared = useMemo(
    () => buildFlowState(lessons, skillGraph),
    [lessons, skillGraph],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<SkillLessonNode>(
    prepared.nodes,
  )
  const [edges, setEdges] = useEdgesState(prepared.edges)

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      setEdges((eds) =>
        applyEdgeChanges(changes, eds).map(syncSkillBezierMarkerEnd),
      )
    },
    [setEdges],
  )

  useEffect(() => {
    setEdges(prepared.edges)
    setNodes(mergeNodeSelection(prepared.nodes, selectedRef.current))

    let cancelled = false
    void layoutSkillTreeWithElk(
      prepared.nodes,
      prepared.edges,
      SKILL_NODE_WIDTH_PX,
      SKILL_NODE_HEIGHT_PX,
    ).then((next) => {
      if (!cancelled)
        setNodes(mergeNodeSelection(next, selectedRef.current))
    })
    return () => {
      cancelled = true
    }
  }, [prepared.nodes, prepared.edges, setNodes, setEdges])

  useEffect(() => {
    setNodes((nds) => mergeNodeSelection(nds, selectedLessonId))
  }, [selectedLessonId, setNodes])

  const onNodeClick = useCallback(
    (_: unknown, node: SkillLessonNode) => {
      onLessonSelect?.(node.id)
    },
    [onLessonSelect],
  )

  return (
    <div className={cn("h-full min-h-[240px] w-full bg-muted/10", className)}>
      <ReactFlow<SkillLessonNode>
        key={skillGraph.graphId}
        nodeTypes={SKILL_LESSON_NODE_TYPES}
        edgeTypes={SKILL_TREE_EDGE_TYPES}
        defaultEdgeOptions={{
          style: {
            strokeWidth: 2,
            stroke: "var(--foreground)",
            strokeOpacity: 0.45,
          },
        }}
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
        lessons={props.lessons}
        skillGraph={skillGraph}
        selectedLessonId={props.selectedLessonId}
        onLessonSelect={props.onLessonSelect}
        className={props.className}
      />
    </ReactFlowProvider>
  )
}
