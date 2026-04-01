import { describe, expect, it } from "vitest"
import { slideMarkdownToSafeHtml } from "@/features/decks/render-slide-markdown"

describe("slideMarkdownToSafeHtml — jazz: images", () => {
  it("converts jazz: image to data-jazz-id img", () => {
    const html = slideMarkdownToSafeHtml("![a diagram](jazz:co_z1abc)")
    expect(html).toContain('data-jazz-id="co_z1abc"')
    expect(html).toContain('alt="a diagram"')
    expect(html).toContain(
      'class="slide-markdown-image jazz-image jazz-image--loading"',
    )
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).not.toContain('src="jazz:')
    // Should have placeholder src to prevent broken image icon
    expect(html).toContain("src=")
  })

  it("adds responsive rendering attrs for external URLs", () => {
    const html = slideMarkdownToSafeHtml("![photo](https://example.com/img.png)")
    expect(html).toContain('src="https://example.com/img.png"')
    expect(html).toContain('class="slide-markdown-image"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).not.toContain("data-jazz-id")
  })

  it("adds responsive rendering attrs for relative URLs", () => {
    const html = slideMarkdownToSafeHtml("![icon](/icons/star.svg)")
    expect(html).toContain('src="/icons/star.svg"')
    expect(html).toContain('class="slide-markdown-image"')
    expect(html).not.toContain("data-jazz-id")
  })

  it("preserves normal text around jazz image", () => {
    const html = slideMarkdownToSafeHtml("Hello\n\n![x](jazz:co_z2)\n\nWorld")
    expect(html).toContain("Hello")
    expect(html).toContain("World")
    expect(html).toContain('data-jazz-id="co_z2"')
  })
})
