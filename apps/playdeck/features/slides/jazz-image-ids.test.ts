import { describe, expect, it } from "vitest"
import { extractJazzImageIds } from "@/features/slides/jazz-image-ids"

describe("extractJazzImageIds", () => {
  it("returns unique Jazz image ids from markdown", () => {
    const markdown = [
      "![hero](jazz:co_a1)",
      "",
      "Text",
      "",
      "![diagram](jazz:co_b2)",
      "![hero again](jazz:co_a1)",
    ].join("\n")

    expect(extractJazzImageIds(markdown)).toEqual(["co_a1", "co_b2"])
  })

  it("ignores non-Jazz images", () => {
    const markdown = [
      "![web](https://example.com/hero.png)",
      "![local](/hero.png)",
      "![jazz](jazz:co_only)",
    ].join("\n")

    expect(extractJazzImageIds(markdown)).toEqual(["co_only"])
  })
})
