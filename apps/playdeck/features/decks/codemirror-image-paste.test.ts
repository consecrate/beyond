import { describe, expect, it } from "vitest"
import {
  replaceToken,
  deleteToken,
  hasPendingImageUpload,
} from "@/features/decks/codemirror-image-paste"

describe("hasPendingImageUpload", () => {
  it("detects uploading placeholder markdown", () => {
    expect(hasPendingImageUpload("before\n![uploading-abc123]()\nafter")).toBe(true)
  })

  it("ignores resolved jazz image markdown", () => {
    expect(hasPendingImageUpload("![image](jazz:co_z1abc)")).toBe(false)
  })

  it("ignores normal external image markdown", () => {
    expect(hasPendingImageUpload("![photo](https://example.com/image.png)")).toBe(false)
  })
})

describe("replaceToken", () => {
  it("replaces the placeholder token with final markdown", () => {
    const doc = "before\n![uploading-abc123]()\nafter"
    const result = replaceToken(
      doc,
      "uploading-abc123",
      "![diagram](https://cdn.example.com/diagram.png)",
    )
    expect(result).toBe(
      "before\n![diagram](https://cdn.example.com/diagram.png)\nafter",
    )
  })

  it("handles token at start of document", () => {
    const doc = "![uploading-xyz]()\nsome text"
    const result = replaceToken(doc, "uploading-xyz", "![](https://cdn.example.com/x.png)")
    expect(result).toBe("![](https://cdn.example.com/x.png)\nsome text")
  })

  it("only replaces first occurrence if somehow duplicated", () => {
    const doc = "![uploading-tok]()\n![uploading-tok]()"
    const result = replaceToken(
      doc,
      "uploading-tok",
      "![img](https://cdn.example.com/img.png)",
    )
    // replaces only first
    expect(result).toBe("![img](https://cdn.example.com/img.png)\n![uploading-tok]()")
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
