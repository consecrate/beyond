"use client"

import { memo } from "react"
import {
  BaseEdge,
  getBezierEdgeCenter,
  type BezierEdgeProps,
  Position,
} from "@xyflow/react"

type SkillTreeBezierEdgeProps = BezierEdgeProps & { selected?: boolean }

/** Horizontal blend so endpoint tangents are not forced vertical at top/bottom handles. */
const TANGENT_BLEND = 0.28

function calculateControlOffset(distance: number, curvature: number): number {
  if (distance >= 0) {
    return 0.5 * distance
  }
  return curvature * 25 * Math.sqrt(-distance)
}

function getControlWithCurvature({
  pos,
  x1,
  y1,
  x2,
  y2,
  c,
}: {
  pos: Position
  x1: number
  y1: number
  x2: number
  y2: number
  c: number
}): [number, number] {
  switch (pos) {
    case Position.Left:
      return [x1 - calculateControlOffset(x1 - x2, c), y1]
    case Position.Right:
      return [x1 + calculateControlOffset(x2 - x1, c), y1]
    case Position.Top:
      return [x1, y1 - calculateControlOffset(y1 - y2, c)]
    case Position.Bottom:
      return [x1, y1 + calculateControlOffset(y2 - y1, c)]
  }
}

/**
 * Same cubic as `getBezierPath` from `@xyflow/system`, but shifts inner control points
 * horizontally when handles are on top/bottom so the endpoint tangent matches the curve.
 */
export function getSkewedBezierPath({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  curvature = 0.25,
}: {
  sourceX: number
  sourceY: number
  sourcePosition?: Position
  targetX: number
  targetY: number
  targetPosition?: Position
  curvature?: number
}): [string, number, number, number, number] {
  const [sourceControlX0, sourceControlY] = getControlWithCurvature({
    pos: sourcePosition,
    x1: sourceX,
    y1: sourceY,
    x2: targetX,
    y2: targetY,
    c: curvature,
  })
  const [targetControlX0, targetControlY] = getControlWithCurvature({
    pos: targetPosition,
    x1: targetX,
    y1: targetY,
    x2: sourceX,
    y2: sourceY,
    c: curvature,
  })
  let sourceControlX = sourceControlX0
  let targetControlX = targetControlX0

  if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
    sourceControlX += TANGENT_BLEND * (targetX - sourceX)
  }
  if (targetPosition === Position.Top || targetPosition === Position.Bottom) {
    targetControlX += TANGENT_BLEND * (sourceX - targetX)
  }

  const [labelX, labelY, offsetX, offsetY] = getBezierEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourceControlX,
    sourceControlY,
    targetControlX,
    targetControlY,
  })
  return [
    `M${sourceX},${sourceY} C${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
    offsetX,
    offsetY,
  ]
}

export const SkillTreeBezierEdge = memo(function SkillTreeBezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  selected,
  markerEnd,
  markerStart,
  pathOptions,
  interactionWidth,
}: SkillTreeBezierEdgeProps) {
  const mergedStyle =
    selected === true
      ? { ...style, strokeOpacity: 1, strokeWidth: 3 }
      : style
  const [path, labelX, labelY] = getSkewedBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: pathOptions?.curvature,
  })
  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={mergedStyle}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  )
})

SkillTreeBezierEdge.displayName = "SkillTreeBezierEdge"
