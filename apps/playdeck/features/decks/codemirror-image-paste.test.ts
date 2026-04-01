import { describe, expect, it } from "vitest"
import { replaceToken, deleteToken } from "@/features/decks/codemirror-image-paste"

describe("replaceToken", () => {
  it("replaces the placeholder token with a jazz: URL", () => {
    const doc = "before\n![uploading-abc123]()\nafter"
    const result = replaceToken(doc, "uploading-abc123", "co_z1abc", "diagram")
    expect(result).toBe("before\n![diagram](jazz:co_z1abc)\nafter")
  })

  it("handles token at start of document", () => {
    const doc = "![uploading-xyz]()\nsome text"
    const result = replaceToken(doc, "uploading-xyz", "co_z2", "")
    expect(result).toBe("![](jazz:co_z2)\nsome text")
  })

  it("only replaces first occurrence if somehow duplicated", () => {
    const doc = "![uploading-tok]()\n![uploading-tok]()"
    const result = replaceToken(doc, "uploading-tok", "co_z3", "img")
    // replaces only first
    expect(result).toBe("![img](jazz:co_z3)\n![uploading-tok]()")
  })
})

describe("deleteToken", () => {
  it("removes the placeholder token line", () => {
    const doc = "line one\n![uploading-abc]()\nline three"
    const result = deleteToken(doc, "uploading-abc")
    expect(result).toBe("line one\nline three")
  })

  it("handles token only content", () => {
    const doc = "![uploading-only]()"
    const result = deleteToken(doc, "uploading-only")
    expect(result).toBe("")
  })
})
