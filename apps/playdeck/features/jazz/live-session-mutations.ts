import type { Loaded } from "jazz-tools"
import { Account, assertLoaded, co, Group, z } from "jazz-tools"

import { deckSlidesToViews } from "@/features/decks/deck-map"
import {
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import { Deck, LiveSession, PlaydeckAccount, PollVote } from "@/features/jazz/schema"

export function startLiveSession(
  me: Loaded<typeof PlaydeckAccount>,
  deck: Loaded<typeof Deck>,
  activeSlideIndex: number,
):
  | { ok: true; liveSession: Loaded<typeof LiveSession> }
  | { ok: false; error: string } {
  const views = deckSlidesToViews(deck)
  if (views.length === 0) {
    return { ok: false, error: "No slides to broadcast." }
  }

  const g = Group.create(me)
  g.addMember("everyone", "writer")

  const max = views.length - 1
  const idx = Math.min(Math.max(0, activeSlideIndex), max)
  const markdown = slidesToMarkdownDocument(views)

  const liveSession = LiveSession.create(
    {
      deckTitle: deck.title,
      markdown,
      activeSlideIndex: idx,
      status: "live",
      presenter_account_id: me.$jazz.id,
      poll_votes: co.list(PollVote).create([], g),
      closed_poll_keys: co.list(z.string()).create([], g),
    },
    g,
  )

  return { ok: true, liveSession: liveSession as Loaded<typeof LiveSession> }
}

export function updateLiveSlideIndex(
  liveSession: Loaded<typeof LiveSession>,
  index: number,
): void {
  const n = parseMarkdownDocumentToSlides(liveSession.markdown).length
  if (n < 1) return
  const idx = Math.min(Math.max(0, index), n - 1)
  liveSession.$jazz.applyDiff({ activeSlideIndex: idx })
}

export function endLiveSession(liveSession: Loaded<typeof LiveSession>): void {
  liveSession.$jazz.applyDiff({ status: "ended" })
}

function ensureClosedPollKeysList(liveSession: Loaded<typeof LiveSession>): void {
  if (!liveSession.$jazz.has("closed_poll_keys")) {
    liveSession.$jazz.set(
      "closed_poll_keys",
      co.list(z.string()).create([], liveSession.$jazz.owner),
    )
  }
}

export function isPollClosed(
  liveSession: Loaded<typeof LiveSession> | null,
  pollKey: string,
): boolean {
  if (!liveSession) return false
  if (!liveSession.$jazz.has("closed_poll_keys")) return false
  const keys = liveSession.closed_poll_keys
  if (keys == null) return false
  assertLoaded(keys)
  for (const k of keys) {
    if (k === pollKey) return true
  }
  return false
}

/**
 * Mark a poll as closed so viewers cannot vote or change votes. Presenter only.
 */
export function closePoll(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  pollKey: string,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can close a poll." }
  }
  ensureClosedPollKeysList(liveSession)
  const keys = liveSession.closed_poll_keys
  if (keys == null) {
    return { ok: false, error: "Could not update poll state." }
  }
  assertLoaded(keys)
  for (const k of keys) {
    if (k === pollKey) return { ok: true }
  }
  keys.$jazz.push(pollKey)
  return { ok: true }
}

/**
 * Record or change the current user's vote for a poll. Session presenter cannot vote.
 */
export function upsertPollVote(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  args: { pollKey: string; optionIndex: number; optionCount: number },
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (!liveSession.$jazz.has("poll_votes")) {
    liveSession.$jazz.set(
      "poll_votes",
      co.list(PollVote).create([], liveSession.$jazz.owner),
    )
  }

  const presenterId = liveSession.presenter_account_id
  if (presenterId !== "" && me.$jazz.id === presenterId) {
    return { ok: false, error: "Presenters cannot vote on their own polls." }
  }

  const { optionIndex, optionCount, pollKey } = args
  if (isPollClosed(liveSession, pollKey)) {
    return { ok: false, error: "This poll is closed." }
  }
  if (
    !Number.isInteger(optionIndex) ||
    optionIndex < 0 ||
    optionIndex >= optionCount
  ) {
    return { ok: false, error: "Invalid option." }
  }

  const votes = liveSession.poll_votes
  assertLoaded(votes)

  const list = [...votes]
  const toRemove: number[] = []
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    assertLoaded(v)
    if (v.user_id === me.$jazz.id && v.poll_key === pollKey) {
      toRemove.push(i)
    }
  }
  for (const idx of toRemove.sort((a, b) => b - a)) {
    votes.$jazz.splice(idx, 1)
  }

  votes.$jazz.push(
    PollVote.create(
      {
        user_id: me.$jazz.id,
        poll_key: pollKey,
        option_index: optionIndex,
      },
      liveSession.$jazz.owner,
    ),
  )

  return { ok: true }
}

export function aggregatePollCounts(
  liveSession: Loaded<typeof LiveSession> | null,
  pollKey: string,
  optionCount: number,
): number[] {
  const counts = Array.from({ length: optionCount }, () => 0)
  if (!liveSession) return counts
  if (!liveSession.$jazz.has("poll_votes")) return counts
  const votes = liveSession.poll_votes
  assertLoaded(votes)
  for (const v of votes) {
    assertLoaded(v)
    if (v.poll_key !== pollKey) continue
    const i = v.option_index
    if (i >= 0 && i < optionCount) counts[i]++
  }
  return counts
}

export function myPollVote(
  liveSession: Loaded<typeof LiveSession> | null,
  userId: string,
  pollKey: string,
): number | null {
  if (!liveSession) return null
  if (!liveSession.$jazz.has("poll_votes")) return null
  const votes = liveSession.poll_votes
  assertLoaded(votes)
  for (const v of votes) {
    assertLoaded(v)
    if (v.user_id === userId && v.poll_key === pollKey) {
      return v.option_index
    }
  }
  return null
}
