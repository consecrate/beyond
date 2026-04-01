import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { QuestionBlock } from "@/features/decks/parse-slide-question"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"

const baseQuestion: QuestionBlock = {
  type: "question",
  questionKey: "question_test",
  kicker: "Warm-up",
  prompt: "What is the capital of Vietnam?",
  options: [
    { text: "Hanoi", isCorrect: true },
    { text: "Da Nang", isCorrect: false },
    { text: "Hue", isCorrect: false },
    { text: "Can Tho", isCorrect: false },
  ],
  correctOptionIndex: 0,
}

describe("QuestionSlideCard", () => {
  // Audience + overlay: each option is a button; one click invokes onSubmit(canonicalIndex) (no separate confirm).
  it("shows presenter progress while open without revealing correctness", () => {
    render(
      <QuestionSlideCard
        block={baseQuestion}
        variant="presenter"
        state="open"
        layout="overlay"
        counts={[0, 0, 0, 0]}
        answeredCount={18}
        myAnswer={null}
      />,
    )

    expect(screen.getByText("18 responses")).toBeInTheDocument()
    expect(screen.getByText("What is the capital of Vietnam?")).toBeInTheDocument()
    expect(screen.getByText("Hanoi")).toBeInTheDocument()
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument()
  })

  it("shows incorrect feedback with the correct option and hides audience stats", () => {
    render(
      <QuestionSlideCard
        block={baseQuestion}
        variant="audience"
        state="revealed"
        layout="overlay"
        counts={[3, 1, 2, 0]}
        answeredCount={6}
        myAnswer={2}
        audienceAccountId="audience_1"
      />,
    )

    expect(screen.getByText("Incorrect")).toBeInTheDocument()
    expect(screen.getByText("Correct option")).toBeInTheDocument()
    expect(screen.getByText("Hanoi")).toBeInTheDocument()
    expect(screen.queryByText("6 responses")).not.toBeInTheDocument()
    expect(screen.queryByText("Your choice")).not.toBeInTheDocument()
  })

  it("shows a neutral reveal when audience did not answer", () => {
    render(
      <QuestionSlideCard
        block={baseQuestion}
        variant="audience"
        state="revealed"
        layout="overlay"
        counts={[3, 1, 2, 0]}
        answeredCount={6}
        myAnswer={null}
        audienceAccountId="audience_1"
      />,
    )

    expect(screen.getByText("No response submitted")).toBeInTheDocument()
    expect(screen.getByText("Correct option")).toBeInTheDocument()
    expect(screen.getByText("Hanoi")).toBeInTheDocument()
  })

  it("uses only correct and wrong tones for presenter reveal rows and fills", () => {
    const { container } = render(
      <QuestionSlideCard
        block={baseQuestion}
        variant="presenter"
        state="revealed"
        layout="overlay"
        counts={[5, 3, 2, 1]}
        answeredCount={11}
        myAnswer={null}
      />,
    )

    const rowTones = [
      ...container.querySelectorAll<HTMLElement>("[data-question-result-tone]"),
    ].map((node) => node.dataset.questionResultTone)
    const fillTones = [
      ...container.querySelectorAll<HTMLElement>("[data-question-result-fill]"),
    ].map((node) => node.dataset.questionResultFill)

    expect(rowTones.length).toBe(baseQuestion.options.length)
    expect(fillTones.length).toBe(baseQuestion.options.length)
    expect(new Set(rowTones)).toEqual(new Set(["correct", "wrong"]))
    expect(new Set(fillTones)).toEqual(new Set(["correct", "wrong"]))
  })
})
