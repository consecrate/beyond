import { escapeHtml } from "./escape-html"

/** Minimal slide shape for Reveal HTML helpers (decoupled from DB tables). */
export type SlideLike = {
  id: string
  title: string
  body: string
}

export type SlidePayload = {
  slideId: string
  title: string
  body: string
  speakerNotes: string | null
}

const TITLE_CLASS = "deck-slide-title"
const BODY_CLASS = "deck-slide-body"

/** Build inner HTML for `.slides` from ordered slide rows. */
export function buildSlidesInnerHtml(slides: SlideLike[]): string {
  return slides
    .map((slide) => {
      const title = escapeHtml(slide.title)
      const body = escapeHtml(slide.body)
      return (
        `<section data-slide-id="${slide.id}" class="deck-slide-section">` +
        `<h2 class="${TITLE_CLASS}" contenteditable="true" spellcheck="true">${title}</h2>` +
        `<div class="${BODY_CLASS} text-left" style="white-space:pre-wrap" contenteditable="true" spellcheck="true">${body}</div>` +
        `</section>`
      )
    })
    .join("")
}

export function extractSlidePayload(section: HTMLElement): SlidePayload | null {
  const slideId = section.dataset.slideId
  if (!slideId) return null

  const titleEl = section.querySelector<HTMLElement>(`.${TITLE_CLASS}`)
  const bodyEl = section.querySelector<HTMLElement>(`.${BODY_CLASS}`)

  return {
    slideId,
    title: titleEl?.textContent ?? "",
    body: bodyEl?.textContent ?? "",
    speakerNotes: null,
  }
}

export function getSlideIdFromElement(el: EventTarget | null): string | null {
  if (!el || !(el instanceof Element)) return null
  const section = el.closest("section[data-slide-id]")
  if (!(section instanceof HTMLElement)) return null
  return section.dataset.slideId ?? null
}
