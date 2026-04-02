export type CodeBlock = {
  type: "code"
  rawMarkdown: string
  rawCode: string
  language: string
}

export function tryParseCodeFromSlideBody(body: string): CodeBlock | null {
  const trimmed = body.trim()
  
  // Match a markdown string that comprises exactly one fenced codeblock.
  // It must start with ```, capture the language line, capture the inner code,
  // and end with ```. It shouldn't have extra markdown text before or after it.
  const match = trimmed.match(/^```([^\n]*)\n([\s\S]*?)\n```$/)
  
  if (!match) {
    return null
  }
  
  // If there are other ``` inside, like a markdown injected codeblock, the regex 
  // above might fail or incorrectly capture depending on greediness. 
  // With /([\s\S]*?)\n```$/, it's ungreedy, so it stops at the first ```.
  // If `trimmed` has more content after the first ```, then the `$` anchor will fail.
  // This correctly ensures the body is *only* a single fenced block.
  
  const langLine = match[1]?.trim() || ""
  const rawCode = match[2] || ""
  
  return {
    type: "code",
    rawMarkdown: trimmed,
    rawCode: rawCode,
    language: langLine.split(/\s+/)[0] || "",
  }
}
