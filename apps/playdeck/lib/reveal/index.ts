import type { RevealConfig } from "reveal.js"
import Reveal from "reveal.js"

export { buildSlidesInnerHtml, extractSlidePayload, getSlideIdFromElement } from "./sections"
export type { SlidePayload } from "./sections"
export { escapeHtml } from "./escape-html"

const defaultConfig: Partial<RevealConfig> = {
  embedded: true,
  keyboardCondition: "focused",
  hash: false,
  controls: true,
  progress: true,
  center: true,
  width: 960,
  height: 700,
  margin: 0.04,
  minScale: 0.35,
  maxScale: 1.4,
}

/**
 * Initialize a Reveal instance on a `.reveal` root that contains `.slides`.
 * Call `destroy()` on the returned API when unmounting.
 */
export async function createDeckReveal(
  revealRoot: HTMLElement,
  config?: Partial<RevealConfig>,
) {
  const deck = new Reveal(revealRoot, {
    ...defaultConfig,
    ...config,
  })
  await deck.initialize()
  return deck
}
