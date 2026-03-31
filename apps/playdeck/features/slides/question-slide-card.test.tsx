import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { QuestionBlock } from "@/features/decks/parse-slide-question"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"

const baseQuestion: QuestionBlock = {
  type: "question",
  questionKey: "question_test",
  title: "Question 3",
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

function optionOrder(container: HTMLElement) {
  return [...container.querySelectorAll("[data-question-option-text]")].map((node) =>
    node.textContent?.trim(),
  )
}

describe("QuestionSlideCard", () => {
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

    expect(screen.getByText("18 answered")).toBeInTheDocument()
    expect(screen.getByText("What is the capital of Vietnam?")).toBeInTheDocument()
    expect(screen.getByText("Hanoi")).toBeInTheDocument()
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument()
  })

  it("keeps the same shuffled answer order between open and revealed states", () => {
    const { container, rerender } = render(
      <QuestionSlideCard
        block={baseQuestion}
        variant="audience"
        state="open"
        layout="overlay"
        counts={[0, 0, 0, 0]}
        answeredCount={0}
        myAnswer={null}
        audienceAccountId="audience_1"
      />,
    )

    const openOrder = optionOrder(container)

    rerender(
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

    expect(optionOrder(container)).toEqual(openOrder)
    expect(screen.getByText("You answered incorrectly.")).toBeInTheDocument()
    expect(screen.getByText("Your answer")).toBeInTheDocument()
  })
})
