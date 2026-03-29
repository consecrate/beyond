"use client"

import { useState } from "react"

import type { LessonRow, SessionSkillGraphPayload } from "@/features/firstly/data-types"
import { SessionSkillTree } from "@/features/sessions/components/session-skill-tree"
import { SessionSplitPanels } from "@/features/sessions/components/session-split-panels"
import { SessionTextPanel } from "@/features/sessions/components/session-text-panel"

type Props = {
  lessons: LessonRow[]
  skillGraph: SessionSkillGraphPayload | null
}

export function SessionWorkspace({ lessons, skillGraph }: Props) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)

  return (
    <SessionSplitPanels
      left={
        <SessionSkillTree
          lessons={lessons}
          skillGraph={skillGraph}
          selectedLessonId={selectedLessonId}
          onLessonSelect={setSelectedLessonId}
        />
      }
      right={
        <SessionTextPanel
          lessons={lessons}
          skillGraph={skillGraph}
          selectedLessonId={selectedLessonId}
        />
      }
    />
  )
}
