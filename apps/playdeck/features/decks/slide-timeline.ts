/** Present mode: one Reveal.js horizontal slide per deck slide */

import type { PollBlock } from "@/features/decks/parse-slide-poll"

export type RevealSlideModel = {
  title: string
  /** Non-poll slides: rendered HTML. Poll slides: empty; use `poll`. */
  html: string
  poll: PollBlock | null
}
