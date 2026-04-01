import type { Loaded } from "jazz-tools"
import { Account, assertLoaded, co, Group, z } from "jazz-tools"

import { deckSlidesToViews } from "@/features/decks/deck-map"
import {
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import {
  Deck,
  LiveSession,
  PlaydeckAccount,
  PollVote,
  QuestionState,
  SessionPlayer,
  QuestionSubmission,
  Team,
} from "@/features/jazz/schema"

export type QuestionLiveStatus = "idle" | "open" | "revealed"

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
      is_lobby_visible: true,
      presenter_account_id: me.$jazz.id,
      joined_players: co.list(SessionPlayer).create([], g),
      poll_votes: co.list(PollVote).create([], g),
      closed_poll_keys: co.list(z.string()).create([], g),
      question_submissions: co.list(QuestionSubmission).create([], g),
      question_states: co.list(QuestionState).create([], g),
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

export function awardPlayPoints(
  liveSession: Loaded<typeof LiveSession>,
  accountId: string,
  points: number,
) {
  const players = liveSession.joined_players
  if (!players) return
  assertLoaded(players)
  for (const p of players) {
    if (!p) continue
    if (!p || !p.$isLoaded) continue
    if (p.account_id === accountId) {
      const current = p.play_points ?? 0
      p.$jazz.applyDiff({ play_points: current + points })
      break
    }
  }
}

function ensureClosedPollKeysList(liveSession: Loaded<typeof LiveSession>): void {
  if (!liveSession.$jazz.has("closed_poll_keys")) {
    liveSession.$jazz.set(
      "closed_poll_keys",
      co.list(z.string()).create([], liveSession.$jazz.owner),
    )
  }
}

function ensureQuestionCollections(liveSession: Loaded<typeof LiveSession>): void {
  if (!liveSession.$jazz.has("question_submissions")) {
    liveSession.$jazz.set(
      "question_submissions",
      co.list(QuestionSubmission).create([], liveSession.$jazz.owner),
    )
  }

  if (!liveSession.$jazz.has("question_states")) {
    liveSession.$jazz.set(
      "question_states",
      co.list(QuestionState).create([], liveSession.$jazz.owner),
    )
  }
}

function questionStatesList(
  liveSession: Loaded<typeof LiveSession>,
) {
  ensureQuestionCollections(liveSession)
  const states = liveSession.question_states
  if (states == null) return null
  assertLoaded(states)
  return states
}

function questionSubmissionsList(
  liveSession: Loaded<typeof LiveSession>,
) {
  ensureQuestionCollections(liveSession)
  const submissions = liveSession.question_submissions
  if (submissions == null) return null
  assertLoaded(submissions)
  return submissions
}

function findQuestionStateEntry(
  liveSession: Loaded<typeof LiveSession>,
  questionKey: string,
): Loaded<typeof QuestionState> | null {
  const states = questionStatesList(liveSession)
  if (!states) return null
  for (const entry of states) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.question_key === questionKey) {
      return entry
    }
  }
  return null
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
  let didVote = false
  const toRemove: number[] = []
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    if (!v || !v.$isLoaded) continue
    if (v.user_id === me.$jazz.id && v.poll_key === pollKey) {
      toRemove.push(i)
      didVote = true
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

  if (!didVote) {
    awardPlayPoints(liveSession, me.$jazz.id, 10)
  }

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
    if (!v || !v.$isLoaded) continue
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
    if (!v || !v.$isLoaded) continue
    if (v.user_id === userId && v.poll_key === pollKey) {
      return v.option_index
    }
  }
  return null
}

export function questionStatus(
  liveSession: Loaded<typeof LiveSession> | null,
  questionKey: string,
): QuestionLiveStatus {
  if (!liveSession) return "idle"
  const entry = findQuestionStateEntry(liveSession, questionKey)
  return entry?.status ?? "idle"
}

export function hasAnotherOpenQuestion(
  liveSession: Loaded<typeof LiveSession> | null,
  questionKey?: string,
): boolean {
  if (!liveSession) return false
  const states = questionStatesList(liveSession)
  if (!states) return false
  for (const entry of states) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.status !== "open") continue
    if (questionKey && entry.question_key === questionKey) continue
    return true
  }
  return false
}

export function startQuestion(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  questionKey: string,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can start a question." }
  }

  if (hasAnotherOpenQuestion(liveSession, questionKey)) {
    return {
      ok: false,
      error: "Another question is already open. Stop it before starting a new one.",
    }
  }

  const existing = findQuestionStateEntry(liveSession, questionKey)
  if (existing?.status === "revealed") {
    return {
      ok: false,
      error: "This question has already been revealed.",
    }
  }

  if (existing) {
    existing.$jazz.applyDiff({ status: "open" })
    return { ok: true }
  }

  const states = questionStatesList(liveSession)
  if (!states) {
    return { ok: false, error: "Could not update question state." }
  }

  states.$jazz.push(
    QuestionState.create(
      { question_key: questionKey, status: "open" },
      liveSession.$jazz.owner,
    ),
  )
  return { ok: true }
}

export function stopQuestion(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  questionKey: string,
  correctOptionIndex?: number,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can stop a question." }
  }

  const existing = findQuestionStateEntry(liveSession, questionKey)
  if (!existing) {
    return { ok: false, error: "This question has not been started yet." }
  }

  if (existing.status === "revealed") {
    return { ok: true }
  }

  existing.$jazz.applyDiff({ status: "revealed" })

  if (correctOptionIndex != null) {
    const submissions = questionSubmissionsList(liveSession)
    if (submissions) {
      for (const entry of submissions) {
        if (!entry || !entry.$isLoaded) continue
        if (entry.question_key === questionKey && entry.option_index === correctOptionIndex) {
          awardPlayPoints(liveSession, entry.user_id, 20)
        }
      }
    }
  }

  return { ok: true }
}

export function submitQuestionAnswer(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  args: { questionKey: string; optionIndex: number; optionCount: number },
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (me.$jazz.id === liveSession.presenter_account_id) {
    return { ok: false, error: "Presenters cannot answer their own questions." }
  }

  if (questionStatus(liveSession, args.questionKey) !== "open") {
    return { ok: false, error: "This question is not accepting answers right now." }
  }

  if (
    !Number.isInteger(args.optionIndex) ||
    args.optionIndex < 0 ||
    args.optionIndex >= args.optionCount
  ) {
    return { ok: false, error: "Invalid option." }
  }

  const submissions = questionSubmissionsList(liveSession)
  if (!submissions) {
    return { ok: false, error: "Could not save your answer." }
  }

  for (const entry of submissions) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.user_id === me.$jazz.id && entry.question_key === args.questionKey) {
      return { ok: false, error: "You have already answered this question." }
    }
  }

  submissions.$jazz.push(
    QuestionSubmission.create(
      {
        user_id: me.$jazz.id,
        question_key: args.questionKey,
        option_index: args.optionIndex,
      },
      liveSession.$jazz.owner,
    ),
  )

  awardPlayPoints(liveSession, me.$jazz.id, 10)

  return { ok: true }
}

export function myQuestionAnswer(
  liveSession: Loaded<typeof LiveSession> | null,
  userId: string,
  questionKey: string,
): number | null {
  if (!liveSession || !liveSession.$jazz.has("question_submissions")) return null
  const submissions = liveSession.question_submissions
  if (submissions == null) return null
  assertLoaded(submissions)
  for (const entry of submissions) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.user_id === userId && entry.question_key === questionKey) {
      return entry.option_index
    }
  }
  return null
}

export function countQuestionAnswers(
  liveSession: Loaded<typeof LiveSession> | null,
  questionKey: string,
): number {
  if (!liveSession || !liveSession.$jazz.has("question_submissions")) return 0
  const submissions = liveSession.question_submissions
  if (submissions == null) return 0
  assertLoaded(submissions)

  const users = new Set<string>()
  for (const entry of submissions) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.question_key === questionKey) {
      users.add(entry.user_id)
    }
  }
  return users.size
}

export function aggregateQuestionCounts(
  liveSession: Loaded<typeof LiveSession> | null,
  questionKey: string,
  optionCount: number,
): number[] {
  const counts = Array.from({ length: optionCount }, () => 0)
  if (!liveSession || !liveSession.$jazz.has("question_submissions")) return counts
  const submissions = liveSession.question_submissions
  if (submissions == null) return counts
  assertLoaded(submissions)
  for (const entry of submissions) {
    if (!entry || !entry.$isLoaded) continue
    if (entry.question_key !== questionKey) continue
    const i = entry.option_index
    if (i >= 0 && i < optionCount) counts[i]++
  }
  return counts
}

export function joinLiveSession(
  me: Loaded<typeof PlaydeckAccount>,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (me.$jazz.id === liveSession.presenter_account_id) return
  if (!liveSession.$jazz.has("joined_players")) return

  const players = liveSession.joined_players
  if (!players) return
  assertLoaded(players)

  for (const p of players) {
    if (!p || !p.$isLoaded) continue
    if (p.account_id === me.$jazz.id) {
      return // Already joined
    }
  }

  const profile = me.profile
  assertLoaded(profile)

  players.$jazz.push(
    SessionPlayer.create(
      { account_id: me.$jazz.id, name: profile.name },
      liveSession.$jazz.owner,
    )
  )
}

export function kickPlayer(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  accountId: string,
) {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const players = liveSession.joined_players
  if (players) {
    assertLoaded(players)
    const list = [...players]
    const toRemove: number[] = []
    for (let i = 0; i < list.length; i++) {
      const p = list[i]
      if (!p || !p.$isLoaded) continue
      if (p.account_id === accountId) {
        toRemove.push(i)
      }
    }
    for (const idx of toRemove.sort((a, b) => b - a)) {
      players.$jazz.splice(idx, 1)
    }
  }
}

export function setLobbyVisible(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  visible: boolean,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return
  liveSession.$jazz.applyDiff({ is_lobby_visible: visible })
}

const TEAM_COLORS = [
  "text-red-500 bg-red-500/10 border-red-500/20",
  "text-blue-500 bg-blue-500/10 border-blue-500/20",
  "text-green-500 bg-green-500/10 border-green-500/20",
  "text-amber-500 bg-amber-500/10 border-amber-500/20",
  "text-purple-500 bg-purple-500/10 border-purple-500/20",
  "text-pink-500 bg-pink-500/10 border-pink-500/20",
]

const TEAM_NAMES = [
  "Red Team",
  "Blue Team",
  "Green Team",
  "Yellow Team",
  "Purple Team",
  "Pink Team",
]

export function startTeamFormation(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  numTeams: number,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const teams = co.list(Team).create([], liveSession.$jazz.owner)
  const count = Math.min(Math.max(2, numTeams), TEAM_NAMES.length)
  for (let i = 0; i < count; i++) {
    teams.$jazz.push(
      Team.create({
        id: `team_${i + 1}`,
        name: TEAM_NAMES[i],
        color: TEAM_COLORS[i],
        hp: 10,
      }, liveSession.$jazz.owner)
    )
  }

  liveSession.$jazz.applyDiff({
    teams,
    team_formation_state: "setup",
  })
}

export function assignTeamLeader(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  teamId: string,
  accountId: string | undefined,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  if (!liveSession.$jazz.has("teams") || !liveSession.teams) return
  assertLoaded(liveSession.teams)

  for (const t of liveSession.teams) {
    if (!t) continue
    if (!t || !t.$isLoaded) continue
    if (t.id === teamId) {
      if (accountId) {
         t.$jazz.applyDiff({ leader_account_id: accountId })
      } else {
         t.$jazz.applyDiff({ leader_account_id: undefined })
      }
      
      if (accountId) {
         const players = liveSession.joined_players
         if (players) {
            assertLoaded(players)
            for (const p of players) {
               if(!p) continue
               if (!p || !p.$isLoaded) continue
               if (p.account_id === accountId) {
                 p.$jazz.applyDiff({ team_id: teamId })
               }
            }
         }
      }
      break
    }
  }
}

export function openTeamJoining(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  liveSession.$jazz.applyDiff({ team_formation_state: "open" })
}

export function joinTeam(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  teamId: string,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  
  const players = liveSession.joined_players
  if (!players) return { ok: false, error: "Not in session" }
  assertLoaded(players)
  
  if (!liveSession.$jazz.has("teams") || !liveSession.teams) {
    return { ok: false, error: "Teams not set up" }
  }
  
  assertLoaded(liveSession.teams)
  const numTeams = [...liveSession.teams].filter(Boolean).length
  if (numTeams === 0) return { ok: false, error: "No teams available" }

  let activePlayers = 0
  for (const p of players) {
    if (p) activePlayers++
  }

  const limit = Math.ceil(activePlayers / numTeams)
  
  let currentTeamCount = 0
  let myPlayerRecord: Loaded<typeof SessionPlayer> | null = null

  for (const p of players) {
    if (!p) continue
    if (!p || !p.$isLoaded) continue
    if (p.account_id === me.$jazz.id) {
      myPlayerRecord = p
    }
    if (p.team_id === teamId) {
      currentTeamCount++
    }
  }

  if (!myPlayerRecord) return { ok: false, error: "You must join the session before joining a team." }

  if (myPlayerRecord.team_id === teamId) {
    return { ok: true } 
  }

  if (currentTeamCount >= limit) {
    return { ok: false, error: "This team is currently full! Try another." }
  }

  myPlayerRecord.$jazz.applyDiff({ team_id: teamId })
  return { ok: true }
}

