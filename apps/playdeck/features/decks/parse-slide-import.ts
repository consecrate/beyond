export type ImportedImageBlock = {
  type: "imported-image"
  src: string | null
}

export type InvalidImportedSlideBlock = {
  type: "imported-slide"
  message: string
}

export type ParseImportedSlideResult =
  | { kind: "imported-image"; block: ImportedImageBlock }
  | { kind: "invalid-import"; block: InvalidImportedSlideBlock }
  | { kind: "not-import" }

/** `#import` and `#image` are aliases for a full-slide imported image. */
const IMPORTED_SLIDE_LINE_RE = /^#(?:import|image)(?:\s+(\S+))?\s*$/i
const IMPORTED_SLIDE_FIRST_LINE_RE = /^#(?:import|image)(?:\s|$)/i
const LOCAL_IMPORT_PREFIX = "local://"

export function parseImportedSlideBody(body: string): ParseImportedSlideResult {
  const lines = body.replace(/\r\n/g, "\n").split("\n")
  let i = 0

  while (i < lines.length && lines[i]!.trim() === "") i++
  if (i >= lines.length) return { kind: "not-import" }

  const firstLine = lines[i]!.trim()
  if (!IMPORTED_SLIDE_FIRST_LINE_RE.test(firstLine)) {
    return { kind: "not-import" }
  }

  const match = firstLine.match(IMPORTED_SLIDE_LINE_RE)
  if (!match) {
    return {
      kind: "invalid-import",
      block: {
        type: "imported-slide",
        message:
          "Imported slides must use `#import` or `#image` (optionally with `<image-url>`).",
      },
    }
  }

  let src = match[1]?.trim() ?? null

  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j]!.trim()
    if (line !== "") {
      if (!src) {
        src = line
      } else {
        return {
          kind: "invalid-import",
          block: {
            type: "imported-slide",
            message:
              "Imported slides may only contain a single `#import` or `#image` line, optionally followed by exactly one image URL.",
          },
        }
      }
    }
  }

  return {
    kind: "imported-image",
    block: {
      type: "imported-image",
      src: src || null,
    },
  }
}

export function buildImportedSlideDirective(src?: string | null): string {
  return src ? `#import ${src}` : "#import"
}

export function isLocalImportedSlideSource(src: string | null | undefined): boolean {
  return typeof src === "string" && src.startsWith(LOCAL_IMPORT_PREFIX)
}

/**
 * When non-null, the slide can use Reveal `data-background-image` (full-bleed cover).
 * `local://` sources stay on `ImportedSlideFrame` until a remote URL exists.
 */
export function importedSlideRevealBackgroundUrl(
  src: string | null | undefined,
): string | null {
  if (typeof src !== "string" || src.trim() === "") return null
  if (isLocalImportedSlideSource(src)) return null
  return src
}

export function parseLocalImportedSlideId(src: string | null | undefined): string | null {
  if (!isLocalImportedSlideSource(src)) return null
  return src!.slice(LOCAL_IMPORT_PREFIX.length) || null
}

export function createLocalImportedSlideSource(importId: string): string {
  return `${LOCAL_IMPORT_PREFIX}${importId}`
}

export function extractLocalImportedSlideIds(markdown: string): string[] {
  const matches = markdown.matchAll(
    /^\s*#(?:import|image)\s+local:\/\/([^\s]+)\s*$/gim,
  )
  const ids = new Set<string>()
  for (const match of matches) {
    const id = match[1]?.trim()
    if (id) ids.add(id)
  }
  return [...ids]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function replaceImportedSlideSource(
  markdown: string,
  fromSrc: string,
  toSrc: string,
): string {
  const escapedFromSrc = escapeRegExp(fromSrc)
  const pattern = new RegExp(
    `^(\\s*#(?:import|image)\\s+)${escapedFromSrc}(\\s*)$`,
    "gim",
  )
  return markdown.replace(pattern, (_match, prefix: string, suffix: string) => {
    return `${prefix}${toSrc}${suffix}`
  })
}
