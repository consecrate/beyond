import { describe, expect, it } from "vitest"

import {
  buildImportedSlideDirective,
  createLocalImportedSlideSource,
  extractLocalImportedSlideIds,
  importedSlideRevealBackgroundUrl,
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

  it("recognizes a bare #image slot as alias of #import", () => {
    expect(parseImportedSlideBody("#image")).toEqual({
      kind: "imported-image",
      block: { type: "imported-image", src: null },
    })
  })

  it("parses #image with remote URL", () => {
    expect(
      parseImportedSlideBody("#image https://cdn.example.com/slide-1.webp"),
    ).toEqual({
      kind: "imported-image",
      block: {
        type: "imported-image",
        src: "https://cdn.example.com/slide-1.webp",
      },
    })
  })

  it("rejects extra body content after #image", () => {
    const result = parseImportedSlideBody("#image https://x\n\nextra")
    expect(result.kind).toBe("invalid-import")
  })

  it("does not treat #imageful as a directive", () => {
    expect(parseImportedSlideBody("#imageful note")).toEqual({
      kind: "not-import",
    })
  })
})

describe("importedSlideRevealBackgroundUrl", () => {
  it("returns null for empty or missing src", () => {
    expect(importedSlideRevealBackgroundUrl(null)).toBeNull()
    expect(importedSlideRevealBackgroundUrl(undefined)).toBeNull()
    expect(importedSlideRevealBackgroundUrl("")).toBeNull()
    expect(importedSlideRevealBackgroundUrl("   ")).toBeNull()
  })

  it("returns null for local imported sources", () => {
    expect(
      importedSlideRevealBackgroundUrl(createLocalImportedSlideSource("x")),
    ).toBeNull()
  })

  it("returns https URL for Reveal background", () => {
    expect(
      importedSlideRevealBackgroundUrl("https://cdn.example.com/a.webp"),
    ).toBe("https://cdn.example.com/a.webp")
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

  it("extracts local imported ids from #image directives", () => {
    const markdown = `# One

#image local://slide-a

---

# Two

#image local://slide-b
`
    expect(extractLocalImportedSlideIds(markdown)).toEqual([
      "slide-a",
      "slide-b",
    ])
  })

  it("replaces imported slide sources in markdown precisely without prefix bugs", () => {
    const localSrc = createLocalImportedSlideSource("slide-a")
    const localSrcLong = createLocalImportedSlideSource("slide-a-2")
    const markdown = `${buildImportedSlideDirective(localSrc)}\n${buildImportedSlideDirective(localSrcLong)}`
    
    // Changing 'slide-a' should not affect 'slide-a-2'
    const replaced = replaceImportedSlideSource(
      markdown,
      localSrc,
      "https://cdn.example.com/a.webp",
    )
    
    expect(replaced).toBe(
      `#import https://cdn.example.com/a.webp\n#import ${localSrcLong}`
    )
  })

  it("replaces sources when slide uses #image prefix", () => {
    const localSrc = createLocalImportedSlideSource("slide-a")
    const markdown = `#image ${localSrc}`
    const replaced = replaceImportedSlideSource(
      markdown,
      localSrc,
      "https://cdn.example.com/a.webp",
    )
    expect(replaced).toBe("#image https://cdn.example.com/a.webp")
  })
})
