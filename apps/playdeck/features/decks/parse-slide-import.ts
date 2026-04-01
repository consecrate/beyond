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

const IMPORT_LINE_RE = /^#import(?:\s+(\S+))?\s*$/i
const LOCAL_IMPORT_PREFIX = "local://"

export function parseImportedSlideBody(body: string): ParseImportedSlideResult {
  const lines = body.replace(/\r\n/g, "\n").split("\n")
  let i = 0

  while (i < lines.length && lines[i]!.trim() === "") i++
  if (i >= lines.length) return { kind: "not-import" }

  const firstLine = lines[i]!.trim()
  if (!/^#import(?:\s|$)/i.test(firstLine)) {
    return { kind: "not-import" }
  }

  const match = firstLine.match(IMPORT_LINE_RE)
  if (!match) {
    return {
      kind: "invalid-import",
      block: {
        type: "imported-slide",
        message:
          "Imported slides must use `#import` or `#import <image-url>` on a single line.",
      },
    }
  }

  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j]!.trim() !== "") {
      return {
        kind: "invalid-import",
        block: {
          type: "imported-slide",
          message:
            "Imported slides may only contain a single `#import` line in the slide body.",
        },
      }
    }
  }

  const src = match[1]?.trim() ?? null
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

export function parseLocalImportedSlideId(src: string | null | undefined): string | null {
  if (!isLocalImportedSlideSource(src)) return null
  return src!.slice(LOCAL_IMPORT_PREFIX.length) || null
}

export function createLocalImportedSlideSource(importId: string): string {
  return `${LOCAL_IMPORT_PREFIX}${importId}`
}

export function extractLocalImportedSlideIds(markdown: string): string[] {
  const matches = markdown.matchAll(/^\s*#import\s+local:\/\/([^\s]+)\s*$/gim)
  const ids = new Set<string>()
  for (const match of matches) {
    const id = match[1]?.trim()
    if (id) ids.add(id)
  }
  return [...ids]
}

export function replaceImportedSlideSource(
  markdown: string,
  fromSrc: string,
  toSrc: string,
): string {
  return markdown.replaceAll(`#import ${fromSrc}`, `#import ${toSrc}`)
}
