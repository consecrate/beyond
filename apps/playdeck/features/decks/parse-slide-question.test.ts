import { describe, expect, it } from "vitest"

import {
  computeQuestionKey,
  parseQuestionSlideBody,
} from "@/features/decks/parse-slide-question"
import {
  deckSlidesToRevealModels,
  parseMarkdownDocumentToSlides,
} from "@/features/decks/slide-markdown-document"

describe("parseQuestionSlideBody", () => {
  it("parses a valid question with optional kicker", () => {
    const result = parseQuestionSlideBody({
      slideTitle: "Question 3",
      body: `## Warm-up

? HTML stands for what?

1. HyperText Markup Language {correct}
2. HighText Markdown Language
3. HyperTransfer Machine Language
4. HyperText Machine Link
`,
    })

    expect(result.kind).toBe("question")
    if (result.kind !== "question") return
    expect(result.block.title).toBe("Question 3")
    expect(result.block.kicker).toBe("Warm-up")
    expect(result.block.options).toHaveLength(4)
    expect(result.block.correctOptionIndex).toBe(0)
    expect(result.block.questionKey).toBe(
      computeQuestionKey({
        title: "Question 3",
        kicker: "Warm-up",
        prompt: "HTML stands for what?",
        options: [
          "HyperText Markup Language",
          "HighText Markdown Language",
          "HyperTransfer Machine Language",
          "HyperText Machine Link",
        ],
        correctOptionIndex: 0,
      }),
    )
  })

  it("parses the minimum two-answer question", () => {
    const result = parseQuestionSlideBody({
      slideTitle: "Question",
      body: `? 2 + 2?

1. Four {correct}
2. Five
`,
    })

    expect(result.kind).toBe("question")
    if (result.kind !== "question") return
    expect(result.block.options).toHaveLength(2)
    expect(result.block.correctOptionIndex).toBe(0)
  })

  it("parses the maximum six-answer question", () => {
    const result = parseQuestionSlideBody({
      slideTitle: "Question",
      body: `? Pick the right answer.

1. One
2. Two
3. Three
4. Four {correct}
5. Five
6. Six
`,
    })

    expect(result.kind).toBe("question")
    if (result.kind !== "question") return
    expect(result.block.options).toHaveLength(6)
    expect(result.block.correctOptionIndex).toBe(3)
  })

  it("rejects zero correct answers", () => {
    const result = parseQuestionSlideBody({
      slideTitle: "Question",
      body: `? Pick one.

1. One
2. Two
`,
    })

    expect(result).toEqual({
      kind: "invalid-question",
      block: {
        type: "question",
        message: "Question slides must have exactly one `{correct}` answer.",
      },
    })
  })

  it("rejects multiple correct answers", () => {
    const result = parseQuestionSlideBody({
      slideTitle: "Question",
      body: `? Pick one.

1. One {correct}
2. Two {correct}
`,
    })

    expect(result).toEqual({
      kind: "invalid-question",
      block: {
        type: "question",
        message: "Question slides must have exactly one `{correct}` answer.",
      },
    })
  })

  it("returns not-question for plain markdown slides", () => {
    expect(
      parseQuestionSlideBody({
        slideTitle: "Plain",
        body: `This is a regular slide with a numbered list.

1. Still regular
2. Still regular
`,
      }),
    ).toEqual({ kind: "not-question" })
  })
})

describe("deckSlidesToRevealModels with question parsing", () => {
  it("maps a valid question slide to the question model", () => {
    const slides = deckSlidesToRevealModels(
      parseMarkdownDocumentToSlides(`# Question 3

## Warm-up

? HTML stands for what?

1. HyperText Markup Language {correct}
2. HighText Markdown Language
3. HyperTransfer Machine Language
4. HyperText Machine Link
`),
    )

    expect(slides[0]?.question).not.toBeNull()
    expect(slides[0]?.poll).toBeNull()
    expect(slides[0]?.interactiveError).toBeNull()
  })

  it("maps an invalid question slide to an interactive error", () => {
    const slides = deckSlidesToRevealModels(
      parseMarkdownDocumentToSlides(`# Question

? Pick one.

1. One
2. Two
`),
    )

    expect(slides[0]?.question).toBeNull()
    expect(slides[0]?.interactiveError).toEqual({
      type: "question",
      message: "Question slides must have exactly one `{correct}` answer.",
    })
  })
})
