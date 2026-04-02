import { render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { DeckRevealPreview } from "@/features/slides/deck-reveal-preview"

const revealMock = {
  initialize: vi.fn(() => Promise.resolve()),
  slide: vi.fn(),
  getIndices: vi.fn(() => ({ h: 0 })),
  sync: vi.fn(),
  layout: vi.fn(),
  prev: vi.fn(),
  next: vi.fn(),
  destroy: vi.fn(),
}

vi.mock("jazz-tools/react", () => ({
  useAccount: vi.fn(() => null),
}))

vi.mock("@/features/slides/use-jazz-images", () => ({
  useJazzImages: vi.fn(),
}))

vi.mock("@/features/slides/use-reveal-auto-layout", () => ({
  useRevealAutoLayout: vi.fn(),
}))

vi.mock("@/features/slides/imported-slide-frame", () => ({
  ImportedSlideFrame: () => <div data-testid="imported-slide-frame" />,
  useImportedSlidePrefetch: vi.fn(),
}))

vi.mock("reveal.js", () => ({
  default: vi.fn(() => revealMock),
}))

describe("DeckRevealPreview", () => {
  beforeEach(() => {
    revealMock.initialize.mockClear()
    revealMock.slide.mockClear()
    revealMock.getIndices.mockClear()
    revealMock.sync.mockClear()
    revealMock.layout.mockClear()
    revealMock.prev.mockClear()
    revealMock.next.mockClear()
    revealMock.destroy.mockClear()
  })

  it("initializes reveal for slides with Playdeck-owned code block markup", async () => {
    render(
      <DeckRevealPreview
        slides={[
          {
            title: "Code",
            html: '<div class="slide-codeblock" data-language="ts"><div class="slide-codeblock-header"><span class="slide-codeblock-language">ts</span></div><pre class="slide-codeblock-pre"><code class="slide-codeblock-code language-ts">const a = 1</code></pre></div>',
            importedImage: null,
            poll: null,
            question: null,
            interactiveError: null,
          },
        ]}
        slidesContentKey="code-slide"
      />,
    )

    await waitFor(() => {
      expect(revealMock.initialize).toHaveBeenCalledTimes(1)
      expect(revealMock.layout).toHaveBeenCalled()
    })
  })
})
