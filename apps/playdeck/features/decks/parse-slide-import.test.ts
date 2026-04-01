import { describe, expect, it } from "vitest"

import {
  buildImportedSlideDirective,
  createLocalImportedSlideSource,
  extractLocalImportedSlideIds,
  parseImportedSlideBody,
  parseLocalImportedSlideId,
  replaceImportedSlideSource,
} from "@/features/decks/parse-slide-import"

describe("parseImportedSlideBody", () => {
  it("recognizes a bare #import slot", () => {
    expect(parseImportedSlideBody("#import")).toEqual({
      kind: "imported-image",
      block: { type: "imported-image", src: null },
    })
  })

  it("parses a remote imported slide source", () => {
    expect(
      parseImportedSlideBody("#import https://cdn.example.com/slide-1.webp"),
    ).toEqual({
      kind: "imported-image",
      block: {
        type: "imported-image",
        src: "https://cdn.example.com/slide-1.webp",
      },
    })
  })

  it("rejects extra body content after #import", () => {
    const result = parseImportedSlideBody("#import https://x\n\nextra")
    expect(result.kind).toBe("invalid-import")
  })

  it("does not treat ordinary markdown like #important as an import command", () => {
    expect(parseImportedSlideBody("#important note")).toEqual({
      kind: "not-import",
    })
  })
})

describe("local imported slide helpers", () => {
  it("creates and parses local imported slide ids", () => {
    const src = createLocalImportedSlideSource("abc123")
    expect(src).toBe("local://abc123")
    expect(parseLocalImportedSlideId(src)).toBe("abc123")
  })

  it("extracts local imported ids from markdown", () => {
    const markdown = `# One

#import local://slide-a

---

# Two

#import local://slide-b
`
    expect(extractLocalImportedSlideIds(markdown)).toEqual([
      "slide-a",
      "slide-b",
    ])
  })

  it("replaces imported slide sources in markdown", () => {
    const localSrc = createLocalImportedSlideSource("slide-a")
    const markdown = buildImportedSlideDirective(localSrc)
    expect(
      replaceImportedSlideSource(
        markdown,
        localSrc,
        "https://cdn.example.com/a.webp",
      ),
    ).toBe("#import https://cdn.example.com/a.webp")
  })
})
