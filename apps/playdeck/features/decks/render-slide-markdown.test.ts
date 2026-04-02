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

describe("slideMarkdownToSafeHtml — fenced code", () => {
  it("renders Playdeck-owned code block markup", () => {
    const md = "```javascript\nlet x = 1\n```"
    const html = slideMarkdownToSafeHtml(md)
    expect(html).toContain('class="slide-codeblock"')
    expect(html).toContain('class="slide-codeblock-header"')
    expect(html).toContain('class="slide-codeblock-language"')
    expect(html).toContain(">javascript<")
    expect(html).toContain('class="slide-codeblock-code language-javascript"')
    expect(html).toContain("let x = 1")
    expect(html).not.toContain('data-playdeck-reveal-highlighted')
  })

  it("extracts reveal line numbers from trailing fence metadata", () => {
    const md = "```ts {1|2,3-4}\nconst a = 1\nconst b = 2\n```"
    const html = slideMarkdownToSafeHtml(md)
    expect(html).toContain('class="slide-codeblock"')
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('class="slide-codeblock-code language-ts"')
    expect(html).toContain('data-line-numbers="1|2,3-4"')
    expect(html).not.toContain("language-ts1234")
  })

  it("extracts explicit data-line-numbers metadata from fence info strings", () => {
    const md = '```tsx data-line-numbers="3,8-10"\n<div />\n```'
    const html = slideMarkdownToSafeHtml(md)
    expect(html).toContain('data-language="tsx"')
    expect(html).toContain('class="slide-codeblock-code language-tsx"')
    expect(html).toContain('data-line-numbers="3,8-10"')
    expect(html).not.toContain("data-cc-window-title")
  })

  it("normalizes common symbolic language ids when fence metadata is present", () => {
    const md = "```c++ {1|2}\nint main() {}\n```"
    const html = slideMarkdownToSafeHtml(md)
    expect(html).toContain('data-language="cpp"')
    expect(html).toContain('class="slide-codeblock-code language-cpp"')
    expect(html).toContain('data-line-numbers="1|2"')
  })

  it("supports unquoted data-line-numbers metadata in fence info strings", () => {
    const md = "```ts data-line-numbers=1|2\nconst x = 1\n```"
    const html = slideMarkdownToSafeHtml(md)
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('class="slide-codeblock-code language-ts"')
    expect(html).toContain('data-line-numbers="1|2"')
  })
})
