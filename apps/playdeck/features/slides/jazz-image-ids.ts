const JAZZ_IMAGE_ID_RE = /!\[[^\]]*]\(jazz:([^)]+)\)/g

export function extractJazzImageIds(markdown: string): string[] {
  const ids = new Set<string>()

  for (const match of markdown.matchAll(JAZZ_IMAGE_ID_RE)) {
    const id = match[1]?.trim()
    if (id) ids.add(id)
  }

  return [...ids]
}
