import { describe, expect, it } from "vitest"
import { assertLoaded } from "jazz-tools"
import { createJazzTestAccount } from "jazz-tools/testing"

import { coValueId } from "@/features/decks/deck-map"
import { replaceSlidesFromMarkdown } from "@/features/decks/jazz-deck-mutations"
import { deckSlidesToRevealModels, parseMarkdownDocumentToSlides } from "@/features/decks/slide-markdown-document"
import {
  aggregateQuestionCounts,
  countQuestionAnswers,
  hasAnotherOpenQuestion,
  questionStatus,
  replaceImportedLiveSlideSource,
  startLiveSession,
  startQuestion,
  stopQuestion,
  submitQuestionAnswer,
} from "@/features/jazz/live-session-mutations"
import { PlaydeckAccount } from "@/features/jazz/schema"
import { createDeckFromTitle } from "@/features/decks"

async function setupLiveQuestion(md: string) {
  const presenter = await createJazzTestAccount({
    AccountSchema: PlaydeckAccount,
    creationProps: { name: "Presenter" },
  })
  const audience = await createJazzTestAccount({
    AccountSchema: PlaydeckAccount,
    creationProps: { name: "Audience" },
  })

  assertLoaded(presenter)
  assertLoaded(presenter.root)
  const created = createDeckFromTitle(presenter, "Question deck")
  expect(created.ok).toBe(true)

  const decks = presenter.root.decks
  assertLoaded(decks)
  const deck = decks[0]
  assertLoaded(deck)

  const deckId = coValueId(deck)
  const replaced = replaceSlidesFromMarkdown(presenter, deckId, md)
  expect(replaced.ok).toBe(true)

  const liveStart = startLiveSession(presenter, deck, 0)
  expect(liveStart.ok).toBe(true)
  if (!liveStart.ok) throw new Error("Live session failed to start")

  const models = deckSlidesToRevealModels(parseMarkdownDocumentToSlides(md))
  const question = models[0]?.question
  if (!question) {
    throw new Error("Expected a question slide")
  }

  return {
    presenter,
    audience,
    liveSession: liveStart.liveSession,
    question,
  }
}

describe("question live-session mutations", () => {
  it("starts and stops a question", async () => {
    const { presenter, liveSession, question } = await setupLiveQuestion(`# Question

? Pick one.

1. One {correct}
2. Two
`)

    expect(questionStatus(liveSession, question.questionKey)).toBe("idle")

    expect(startQuestion(presenter, liveSession, question.questionKey)).toEqual({
      ok: true,
    })
    expect(questionStatus(liveSession, question.questionKey)).toBe("open")

    expect(stopQuestion(presenter, liveSession, question.questionKey)).toEqual({
      ok: true,
    })
    expect(questionStatus(liveSession, question.questionKey)).toBe("revealed")
  })

  it("allows only one open question per session", async () => {
    const { presenter, liveSession } = await setupLiveQuestion(`# Question 1

? Pick one.

1. One {correct}
2. Two

---

# Question 2

? Pick again.

1. Alpha {correct}
2. Beta
`)

    const models = deckSlidesToRevealModels(
      parseMarkdownDocumentToSlides(`# Question 1

? Pick one.

1. One {correct}
2. Two

---

# Question 2

? Pick again.

1. Alpha {correct}
2. Beta
`),
    )
    const first = models[0]?.question
    const second = models[1]?.question
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    if (!first || !second) {
      throw new Error("Expected both question slides to parse")
    }

    expect(startQuestion(presenter, liveSession, first.questionKey)).toEqual({
      ok: true,
    })
    expect(hasAnotherOpenQuestion(liveSession, first.questionKey)).toBe(false)
    expect(startQuestion(presenter, liveSession, second.questionKey)).toEqual({
      ok: false,
      error: "Another question is already open. Stop it before starting a new one.",
    })
  })

  it("rejects submissions unless the question is open", async () => {
    const { audience, liveSession, question } = await setupLiveQuestion(`# Question

? Pick one.

1. One {correct}
2. Two
`)

    expect(
      submitQuestionAnswer(audience, liveSession, {
        questionKey: question.questionKey,
        optionIndex: 0,
        optionCount: question.options.length,
      }),
    ).toEqual({
      ok: false,
      error: "This question is not accepting answers right now.",
    })
  })

  it("records one answer per audience member and aggregates counts", async () => {
    const { presenter, audience, liveSession, question } = await setupLiveQuestion(`# Question

? Pick one.

1. One {correct}
2. Two
3. Three
`)

    expect(startQuestion(presenter, liveSession, question.questionKey)).toEqual({
      ok: true,
    })

    expect(
      submitQuestionAnswer(audience, liveSession, {
        questionKey: question.questionKey,
        optionIndex: 2,
        optionCount: question.options.length,
      }),
    ).toEqual({ ok: true })

    expect(
      submitQuestionAnswer(audience, liveSession, {
        questionKey: question.questionKey,
        optionIndex: 1,
        optionCount: question.options.length,
      }),
    ).toEqual({
      ok: false,
      error: "You have already answered this question.",
    })

    expect(countQuestionAnswers(liveSession, question.questionKey)).toBe(1)
    expect(
      aggregateQuestionCounts(
        liveSession,
        question.questionKey,
        question.options.length,
      ),
    ).toEqual([0, 0, 1])
  })

  it("rejects presenter submissions", async () => {
    const { presenter, liveSession, question } = await setupLiveQuestion(`# Question

? Pick one.

1. One {correct}
2. Two
`)

    expect(startQuestion(presenter, liveSession, question.questionKey)).toEqual({
      ok: true,
    })
    expect(
      submitQuestionAnswer(presenter, liveSession, {
        questionKey: question.questionKey,
        optionIndex: 0,
        optionCount: question.options.length,
      }),
    ).toEqual({
      ok: false,
      error: "Presenters cannot answer their own questions.",
    })
  })

  it("replaces imported local slide sources in live markdown", async () => {
    const presenter = await createJazzTestAccount({
      AccountSchema: PlaydeckAccount,
      creationProps: { name: "Presenter" },
    })
    assertLoaded(presenter)
    assertLoaded(presenter.root)
    const created = createDeckFromTitle(presenter, "Imported deck")
    expect(created.ok).toBe(true)

    const decks = presenter.root.decks
    assertLoaded(decks)
    const deck = decks[0]
    assertLoaded(deck)

    const deckId = coValueId(deck)
    expect(
      replaceSlidesFromMarkdown(
        presenter,
        deckId,
        `# Canvas

#import local://slide-a
`,
      ).ok,
    ).toBe(true)

    const liveStart = startLiveSession(presenter, deck, 0)
    expect(liveStart.ok).toBe(true)
    if (!liveStart.ok) throw new Error("Live session failed to start")

    expect(
      replaceImportedLiveSlideSource(
        liveStart.liveSession,
        "local://slide-a",
        "https://cdn.example.com/slide-a.webp",
      ),
    ).toBe(true)
    expect(liveStart.liveSession.markdown).toContain(
      "#import https://cdn.example.com/slide-a.webp",
    )
  })
})
