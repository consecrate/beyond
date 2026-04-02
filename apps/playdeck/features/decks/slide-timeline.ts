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
import type { CodeBlock } from "@/features/decks/parse-slide-code"

export type RevealSlideModel = {
  title: string
  /** Non-interactive slides: rendered HTML. Interactive slides use their specific block. */
  html: string
  /**
   * `#import` / `#image` slides. Remote URLs use Reveal section backgrounds (full-bleed);
   * `local://` or empty src uses the imported slide frame until upload finishes.
   */
  importedImage: ImportedImageBlock | null
  poll: PollBlock | null
  question: QuestionBlock | null
  code: CodeBlock | null
  interactiveError: InvalidQuestionBlock | InvalidImportedSlideBlock | null
}
