/** Present mode: one Reveal.js horizontal slide per deck slide */

import type {
  ImportedImageBlock,
  InvalidImportedSlideBlock,
} from "@/features/decks/parse-slide-import"
import type { PollBlock } from "@/features/decks/parse-slide-poll"
import type {
  InvalidQuestionBlock,
  QuestionBlock,
} from "@/features/decks/parse-slide-question"

export type RevealSlideModel = {
  title: string
  /** Non-interactive slides: rendered HTML. Interactive slides use their specific block. */
  html: string
  importedImage: ImportedImageBlock | null
  poll: PollBlock | null
  question: QuestionBlock | null
  interactiveError: InvalidQuestionBlock | InvalidImportedSlideBlock | null
}
