import type { Loaded } from "jazz-tools"
import { Account, assertLoaded, co, Group, z } from "jazz-tools"

import { deckSlidesToViews } from "@/features/decks/deck-map"
import { replaceImportedSlideSource } from "@/features/decks/parse-slide-import"
import {
  parseMarkdownDocumentToSlides,
  slidesToMarkdownDocument,
} from "@/features/decks/slide-markdown-document"
import {
  BattlePowerupSelection,
  BattleRoundEntry,
  BattleRoundSummary,
  BattleState,
  Deck,
  LiveSession,
  PlaydeckAccount,
  PollVote,
  Powerup,
  QuestionState,
  QuestionSubmission,
  SessionPlayer,
  Team,
  type PowerupType,
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

export function replaceImportedLiveSlideSource(
  liveSession: Loaded<typeof LiveSession>,
  fromSrc: string,
  toSrc: string,
): boolean {
  const nextMarkdown = replaceImportedSlideSource(
    liveSession.markdown,
    fromSrc,
    toSrc,
  )
  if (nextMarkdown === liveSession.markdown) {
    return false
  }
  liveSession.$jazz.applyDiff({ markdown: nextMarkdown })
  return true
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

  if (liveSession.game_phase === "battle_royale") {
    const battleState = liveSession.battle_state
    if (battleState && battleState.$isLoaded) {
      battleState.$jazz.applyDiff({ phase: "question_active", question_key: questionKey })
    }
  }

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

    if (liveSession.game_phase === "battle_royale") {
      const battleState = liveSession.battle_state
      if (battleState && battleState.$isLoaded) {
        assertLoaded(battleState)
        battleState.$jazz.applyDiff({ phase: "results" })

        const teams = liveSession.teams
        if (teams && teams.$isLoaded) {
          const playerList = liveSession.joined_players
          const activePlayers: Loaded<typeof SessionPlayer>[] = []
          if (playerList && playerList.$isLoaded) {
            assertLoaded(playerList)
            for (const p of playerList) {
              if (p && p.$isLoaded) activePlayers.push(p)
            }
          }

          /** Team passes combat check when >85% of members answered correctly. */
          const teamAccuracyPass = new Map<string, boolean>()
          /** All members answered correctly (for critical_hit 3× damage). */
          const teamPerfectAccuracy = new Map<string, boolean>()
          for (const t of teams) {
            if (!t || !t.$isLoaded) continue
            if ((t.hp ?? 0) <= 0) {
              teamAccuracyPass.set(t.id, false)
              teamPerfectAccuracy.set(t.id, false)
              continue
            }
            const members = activePlayers.filter((p) => p.team_id === t.id)
            const memberCount = members.length
            if (memberCount === 0) {
              teamAccuracyPass.set(t.id, false)
              teamPerfectAccuracy.set(t.id, false)
              continue
            }
            let correctCount = 0
            for (const m of members) {
              let sub: Loaded<typeof QuestionSubmission> | null = null
              if (submissions) {
                for (const entry of submissions) {
                  if (!entry || !entry.$isLoaded) continue
                  if (
                    entry.question_key === questionKey &&
                    entry.user_id === m.account_id
                  ) {
                    sub = entry
                    break
                  }
                }
              }
              if (sub && sub.option_index === correctOptionIndex) correctCount++
            }
            const ratio = correctCount / memberCount
            teamAccuracyPass.set(t.id, ratio > 0.85)
            teamPerfectAccuracy.set(t.id, ratio === 1)
          }

          const hpBefore = new Map<string, number>()
          for (const t of teams) {
            if (!t || !t.$isLoaded) continue
            hpBefore.set(t.id, t.hp ?? 0)
          }

          const targets = battleState.targets ?? {}
          const teamById = new Map<string, Loaded<typeof Team>>()
          for (const t of teams) {
            if (t && t.$isLoaded) teamById.set(t.id, t)
          }

          type ConfirmedFx = {
            team_id: string
            powerup_type: z.infer<typeof PowerupType>
            picker_account_id: string
            healing_target_team_id?: string
          }
          const confirmedRows: ConfirmedFx[] = []
          // Dedup guard: non-stackable powerup types can only fire once per team per round,
          // even if a CRDT race produced duplicate entries in the selections list.
          const seenNonStackable = new Set<string>()
          const selList = battleState.powerup_selections
          if (selList && selList.$isLoaded) {
            assertLoaded(selList)
            for (const s of selList) {
              if (!s || !s.$isLoaded) continue
              if (s.status !== "confirmed") continue
              const isStackable = s.powerup_type === "healing_potion" || s.powerup_type === "step_up"
              if (!isStackable) {
                const dedupeKey = `${s.team_id}:${s.powerup_type}`
                if (seenNonStackable.has(dedupeKey)) continue
                seenNonStackable.add(dedupeKey)
              }
              confirmedRows.push({
                team_id: s.team_id,
                powerup_type: s.powerup_type,
                picker_account_id: s.picker_account_id,
                healing_target_team_id: s.healing_target_team_id,
              })
            }
          }

          const attackMultForTeam = (teamId: string): number => {
            let m = 1
            const perfect = teamPerfectAccuracy.get(teamId) ?? false
            for (const r of confirmedRows) {
              if (r.team_id !== teamId) continue
              if (r.powerup_type === "double_damage") m = Math.max(m, 2)
              if (r.powerup_type === "critical_hit" && perfect) m = Math.max(m, 3)
            }
            return m
          }

          const shieldCountForTeam = (teamId: string): number => {
            let c = 0
            for (const r of confirmedRows) {
              if (r.team_id === teamId && r.powerup_type === "shield") c++
            }
            return c
          }

          const hasDeflect = (teamId: string): boolean =>
            confirmedRows.some((r) => r.team_id === teamId && r.powerup_type === "deflect")

          /** Outgoing damage from attacker team to their target (only if team accuracy passes). */
          const attackDamage = new Map<string, number>()
          for (const t of teams) {
            if (!t || !t.$isLoaded) continue
            if (t.hp === undefined || t.hp <= 0) continue
            if (!teamAccuracyPass.get(t.id)) continue
            const targetId = targets[t.id]
            if (!targetId) continue
            attackDamage.set(t.id, attackMultForTeam(t.id))
          }

          const rawIncomingToTarget = new Map<string, number>()
          for (const [attackerId, dmg] of attackDamage) {
            const tid = targets[attackerId]
            if (!tid) continue
            rawIncomingToTarget.set(tid, (rawIncomingToTarget.get(tid) ?? 0) + dmg)
          }

          const damageToAttackerTeam = new Map<string, number>()

          for (const [targetTeamId, rawTotal] of rawIncomingToTarget) {
            let incoming = rawTotal
            incoming = Math.max(0, incoming - shieldCountForTeam(targetTeamId))
            if (hasDeflect(targetTeamId) && rawTotal > 0) {
              for (const [attackerId, dmg] of attackDamage) {
                if (targets[attackerId] !== targetTeamId) continue
                const share = Math.round((dmg / rawTotal) * incoming)
                damageToAttackerTeam.set(
                  attackerId,
                  (damageToAttackerTeam.get(attackerId) ?? 0) + share,
                )
              }
            } else {
              const targetTeam = teamById.get(targetTeamId)
              if (targetTeam && targetTeam.hp !== undefined) {
                const newHp = Math.max(0, targetTeam.hp - incoming)
                targetTeam.$jazz.applyDiff({ hp: newHp })
                if (newHp === 0) {
                  targetTeam.$jazz.applyDiff({ status: "downed" })
                }
              }
            }
          }

          for (const [attackerTeamId, dmgBack] of damageToAttackerTeam) {
            const att = teamById.get(attackerTeamId)
            if (!att || att.hp === undefined) continue
            const newHp = Math.max(0, att.hp - dmgBack)
            att.$jazz.applyDiff({ hp: newHp })
            if (newHp === 0) {
              att.$jazz.applyDiff({ status: "downed" })
            }
          }

          for (const r of confirmedRows) {
            if (r.powerup_type === "medkit") {
              const tm = teamById.get(r.team_id)
              if (tm && tm.hp !== undefined) {
                tm.$jazz.applyDiff({ hp: tm.hp + 2 })
              }
            }
            if (r.powerup_type === "healing_potion" && r.healing_target_team_id) {
              const ht = teamById.get(r.healing_target_team_id)
              if (ht && ht.hp !== undefined) {
                ht.$jazz.applyDiff({ hp: ht.hp + 1 })
              }
            }
            if (r.powerup_type === "step_up") {
              const tm = teamById.get(r.team_id)
              if (tm && tm.hp !== undefined) {
                tm.$jazz.applyDiff({ hp: tm.hp + 1 })
              }
            }
          }

          for (const r of confirmedRows) {
            const tm = teamById.get(r.team_id)
            if (!tm || !tm.powerups || !tm.powerups.$isLoaded) continue
            assertLoaded(tm.powerups)
            const pu = findUnusedPowerupForPicker(tm, r.picker_account_id, r.powerup_type)
            if (pu) {
              pu.$jazz.applyDiff({ is_used: true })
            }
          }

          const hpAfter = new Map<string, number>()
          for (const t of teams) {
            if (!t || !t.$isLoaded) continue
            hpAfter.set(t.id, t.hp ?? 0)
          }

          const owner = liveSession.$jazz.owner
          const entryList = co.list(BattleRoundEntry).create([], owner)
          const teamArr = [...teams].filter(
            (t): t is Loaded<typeof Team> => !!t && t.$isLoaded,
          )

          for (const t of teamArr) {
            if ((hpBefore.get(t.id) ?? 0) <= 0) continue
            const targetId = targets[t.id] ?? ""
            const targetTeam = targetId
              ? teamArr.find((x) => x.id === targetId)
              : undefined
            const targetName = targetTeam?.name ?? (targetId ? "Unknown" : "—")
            const wasCorrect = teamAccuracyPass.get(t.id) ?? false
            const atkDmg = wasCorrect && targetId ? (attackDamage.get(t.id) ?? 0) : 0
            const tb = targetId ? (hpBefore.get(targetId) ?? 0) : 0
            const ta = targetId ? (hpAfter.get(targetId) ?? 0) : 0
            const downed = targetId ? ta === 0 : false

            entryList.$jazz.push(
              BattleRoundEntry.create(
                {
                  attacker_team_id: t.id,
                  target_team_id: targetId,
                  attacker_name: t.name,
                  target_name: targetName,
                  was_correct: wasCorrect,
                  damage: atkDmg,
                  target_hp_before: tb,
                  target_hp_after: ta,
                  target_downed: downed,
                },
                owner,
              ),
            )
          }

          const roundSummary = BattleRoundSummary.create(
            {
              question_key: questionKey,
              entries: entryList,
            },
            owner,
          )
          battleState.$jazz.applyDiff({ round_summary: roundSummary })
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

export function leaveTeam(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  
  const players = liveSession.joined_players
  if (!players) return { ok: false, error: "Not in session" }
  assertLoaded(players)

  let myPlayerRecord: Loaded<typeof SessionPlayer> | null = null

  for (const p of players) {
    if (!p) continue
    if (!p.$isLoaded) continue
    if (p.account_id === me.$jazz.id) {
      myPlayerRecord = p
      break
    }
  }

  if (!myPlayerRecord) return { ok: false, error: "You must join the session before leaving a team." }

  myPlayerRecord.$jazz.applyDiff({ team_id: undefined })
  return { ok: true }
}

export function autoAssignRemainingTeams(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const teams = liveSession.teams
  const players = liveSession.joined_players

  if (!teams || !players) return
  assertLoaded(teams)
  assertLoaded(players)

  const activeTeams = [...teams].filter((t): t is Loaded<typeof Team> => !!t && t.$isLoaded)
  if (activeTeams.length === 0) return

  const activePlayers = [...players].filter((p): p is Loaded<typeof SessionPlayer> => !!p && p.$isLoaded)
  const unassignedPlayers = activePlayers.filter(p => !p.team_id)

  if (unassignedPlayers.length === 0) return

  const teamCounts = new Map<string, number>()
  activeTeams.forEach(t => teamCounts.set(t.id, 0))
  
  activePlayers.forEach(p => {
    if (p.team_id && teamCounts.has(p.team_id)) {
      teamCounts.set(p.team_id, teamCounts.get(p.team_id)! + 1)
    }
  })

  // Distribute unassigned players to teams with minimum members
  for (const player of unassignedPlayers) {
     let minTeamId = activeTeams[0].id
     let minCount = teamCounts.get(minTeamId)!
     
     for (const t of activeTeams) {
        const count = teamCounts.get(t.id)!
        if (count < minCount) {
           minCount = count
           minTeamId = t.id
        }
     }
     
     player.$jazz.applyDiff({ team_id: minTeamId })
     teamCounts.set(minTeamId, minCount + 1)
  }
}

export function startGameStore(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const teams = liveSession.teams
  const players = liveSession.joined_players

  if (!teams || !players) return
  assertLoaded(teams)
  assertLoaded(players)

  const activeTeams = [...teams].filter((t): t is Loaded<typeof Team> => !!t && t.$isLoaded)
  const activePlayers = [...players].filter((p): p is Loaded<typeof SessionPlayer> => !!p && p.$isLoaded)

  for (const t of activeTeams) {
    let teamPoints = 0
    const teamMembers = activePlayers.filter(p => p.team_id === t.id)
    for (const member of teamMembers) {
      teamPoints += member.play_points ?? 0
    }
    
    t.$jazz.applyDiff({
      hp: 10,
      banked_play_points: teamPoints,
      powerups: co.list(Powerup).create([], liveSession.$jazz.owner)
    })
  }

  liveSession.$jazz.applyDiff({ game_phase: "store" })
}

export function startGameplay(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const owner = liveSession.$jazz.owner
  const battleState = BattleState.create(
    {
      phase: "target_selection",
      targets: {},
      powerup_selections: co.list(BattlePowerupSelection).create([], owner),
    },
    owner,
  )

  liveSession.$jazz.applyDiff({
    game_phase: "battle_royale",
    battle_state: battleState,
    team_formation_state: "idle",
  })
}

export function purchasePowerup(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  teamId: string,
  powerupType: z.infer<typeof PowerupType>,
  cost: number,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  const purchasablePhases = ["store", "playing", "battle_royale"] as const
  if (!purchasablePhases.includes(liveSession.game_phase as typeof purchasablePhases[number])) {
    return { ok: false, error: "Purchases are not available right now." }
  }

  const players = liveSession.joined_players
  if (!players) return { ok: false, error: "No players in session." }
  assertLoaded(players)

  let myPlayer: Loaded<typeof SessionPlayer> | null = null
  for (const p of players) {
    if (!p || !p.$isLoaded) continue
    if (p.account_id === me.$jazz.id) {
      myPlayer = p
      break
    }
  }
  if (!myPlayer) return { ok: false, error: "Join the session first." }
  if (myPlayer.team_id !== teamId) {
    return { ok: false, error: "That is not your team." }
  }

  const teams = liveSession.teams
  if (!teams) return { ok: false, error: "No teams found." }
  assertLoaded(teams)

  let myTeam: Loaded<typeof Team> | null = null
  for (const t of teams) {
    if (!t || !t.$isLoaded) continue
    if (t.id === teamId) {
      myTeam = t
      break
    }
  }

  if (!myTeam) return { ok: false, error: "Team not found." }

  const pts = myPlayer.play_points ?? 0
  if (pts < cost) {
    return { ok: false, error: "Not enough PlayPoints." }
  }

  myPlayer.$jazz.applyDiff({ play_points: pts - cost })

  if (!myTeam.$jazz.has("powerups") || !myTeam.powerups) {
    myTeam.$jazz.set("powerups", co.list(Powerup).create([], liveSession.$jazz.owner))
  }

  const powerupsList = myTeam.powerups
  if (!powerupsList) return { ok: false, error: "Failed to initialize powerups" }
  assertLoaded(powerupsList)

  powerupsList.$jazz.push(
    Powerup.create(
      {
        type: powerupType,
        owner_account_id: me.$jazz.id,
        is_used: false,
      },
      liveSession.$jazz.owner,
    ),
  )

  return { ok: true }
}

export function showBattleLog(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can show the battle log." }
  }
  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale." }
  }
  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not loaded." }
  }
  if (battleState.phase !== "results") {
    return { ok: false, error: "Battle log is only available after results." }
  }
  battleState.$jazz.applyDiff({ phase: "battle_log" })
  return { ok: true }
}

/** Final battle recap screen: top teams by HP. Only after battle log. */
export function showPodium(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can show the podium." }
  }
  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale." }
  }
  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not loaded." }
  }
  if (battleState.phase !== "battle_log") {
    return { ok: false, error: "Podium is available after the battle log." }
  }
  battleState.$jazz.applyDiff({ phase: "podium" })
  return { ok: true }
}

/** Exit battle royale after podium and return to normal slide flow. */
export function leaveBattleRoyaleAfterPodium(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) {
    return { ok: false, error: "Only the presenter can continue after the podium." }
  }
  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale." }
  }
  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not loaded." }
  }
  if (battleState.phase !== "podium") {
    return { ok: false, error: "Not on the podium screen." }
  }
  liveSession.$jazz.applyDiff({
    game_phase: "playing",
    battle_state: undefined,
  })
  return { ok: true }
}

export function resetBattleTargetSelection(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
) {
  assertLoaded(me)
  assertLoaded(liveSession)
  if (me.$jazz.id !== liveSession.presenter_account_id) return

  const battleState = liveSession.battle_state
  if (battleState && battleState.$isLoaded) {
    const owner = liveSession.$jazz.owner
    battleState.$jazz.applyDiff({
      phase: "target_selection",
      targets: {},
      round_summary: undefined,
      powerup_selections: co.list(BattlePowerupSelection).create([], owner),
    })
  }
}

function ensureBattlePowerupSelectionsList(
  liveSession: Loaded<typeof LiveSession>,
  battleState: Loaded<typeof BattleState>,
): void {
  if (!battleState.$jazz.has("powerup_selections") || !battleState.powerup_selections) {
    battleState.$jazz.set(
      "powerup_selections",
      co.list(BattlePowerupSelection).create([], liveSession.$jazz.owner),
    )
  }
}

function findPlayerTeamId(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): string | null {
  const players = liveSession.joined_players
  if (!players) return null
  assertLoaded(players)
  for (const p of players) {
    if (!p || !p.$isLoaded) continue
    if (p.account_id === me.$jazz.id) {
      return p.team_id ?? null
    }
  }
  return null
}

function findMemberSelectionIndex(
  battleState: Loaded<typeof BattleState>,
  teamId: string,
  pickerAccountId: string,
): number {
  const list = battleState.powerup_selections
  if (!list || !list.$isLoaded) return -1
  assertLoaded(list)
  const arr = [...list]
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i]
    if (
      s &&
      s.$isLoaded &&
      s.team_id === teamId &&
      s.picker_account_id === pickerAccountId
    ) {
      return i
    }
  }
  return -1
}

/**
 * HP-boosting powerup types that multiple teammates are allowed to each pick once per round.
 * All other types are restricted to one picker per team per round.
 */
const STACKABLE_POWERUP_TYPES = new Set<z.infer<typeof PowerupType>>([
  "healing_potion",
  "step_up",
])

/**
 * Returns true if another member of the same team has already claimed this powerup type
 * this round, AND the type is not stackable. Used to enforce the one-type-per-teammate rule.
 */
function isPowerupTypeTakenByTeammate(
  battleState: Loaded<typeof BattleState>,
  powerupType: z.infer<typeof PowerupType>,
  teamId: string,
  excludePickerId: string,
): boolean {
  if (STACKABLE_POWERUP_TYPES.has(powerupType)) return false
  const list = battleState.powerup_selections
  if (!list || !list.$isLoaded) return false
  assertLoaded(list)
  for (const s of list) {
    if (!s || !s.$isLoaded) continue
    if (s.team_id !== teamId) continue
    if (s.picker_account_id === excludePickerId) continue
    if (s.powerup_type === powerupType) return true
  }
  return false
}

function findUnusedPowerupForPicker(
  team: Loaded<typeof Team>,
  pickerId: string,
  powerupType: z.infer<typeof PowerupType>,
): Loaded<typeof Powerup> | null {
  const powerups = team.powerups
  if (!powerups || !powerups.$isLoaded) return null
  assertLoaded(powerups)
  for (const pu of powerups) {
    if (!pu || !pu.$isLoaded) continue
    if (pu.owner_account_id === pickerId && !pu.is_used && pu.type === powerupType) {
      return pu
    }
  }
  return null
}

/**
 * Member picks a round power-up from their own unused inventory (no leader confirmation).
 */
export function claimBattlePowerup(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  args: {
    powerupType: z.infer<typeof PowerupType>
    healingTargetTeamId?: string
  },
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale phase." }
  }

  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not initialized." }
  }
  assertLoaded(battleState)

  if (battleState.phase !== "target_selection") {
    return { ok: false, error: "Power-ups can only be chosen during target selection." }
  }

  const teams = liveSession.teams
  if (!teams || !teams.$isLoaded) return { ok: false, error: "No teams." }
  assertLoaded(teams)

  const myTeamId = findPlayerTeamId(me, liveSession)
  if (!myTeamId) return { ok: false, error: "Join a team first." }

  let myTeam: Loaded<typeof Team> | null = null
  for (const t of teams) {
    if (!t || !t.$isLoaded) continue
    if (t.id === myTeamId) {
      myTeam = t
      break
    }
  }
  if (!myTeam) return { ok: false, error: "Team not found." }

  const targets = battleState.targets ?? {}
  if (!targets[myTeamId]) {
    return { ok: false, error: "Your leader must choose an attack target first." }
  }

  const { powerupType, healingTargetTeamId } = args

  if (powerupType === "healing_potion") {
    if (!healingTargetTeamId) {
      return { ok: false, error: "Choose a team to receive the healing potion." }
    }
    if (healingTargetTeamId === myTeamId) {
      return { ok: false, error: "Heal another team, not your own." }
    }
    const ht = [...teams].find((t) => t && t.$isLoaded && t.id === healingTargetTeamId)
    if (!ht || !ht.$isLoaded) {
      return { ok: false, error: "Invalid heal target." }
    }
    if ((ht.hp ?? 0) <= 0 || ht.status === "downed") {
      return { ok: false, error: "Cannot heal a downed team." }
    }
  } else if (healingTargetTeamId) {
    return { ok: false, error: "Healing target only applies to healing potion." }
  }

  if (!findUnusedPowerupForPicker(myTeam, me.$jazz.id, powerupType)) {
    return { ok: false, error: "You don't have an unused power-up of that type." }
  }

  ensureBattlePowerupSelectionsList(liveSession, battleState)
  const list = battleState.powerup_selections
  if (!list || !list.$isLoaded) return { ok: false, error: "Could not update power-up state." }
  assertLoaded(list)

  const pickerId = me.$jazz.id
  const idx = findMemberSelectionIndex(battleState, myTeamId, pickerId)
  const existing = idx >= 0 ? list[idx] : null

  if (!existing || !existing.$isLoaded) {
    if (isPowerupTypeTakenByTeammate(battleState, powerupType, myTeamId, pickerId)) {
      return { ok: false, error: "A teammate has already chosen this power-up type this round." }
    }
  } else if (existing.powerup_type !== powerupType) {
    if (isPowerupTypeTakenByTeammate(battleState, powerupType, myTeamId, pickerId)) {
      return { ok: false, error: "A teammate has already chosen this power-up type this round." }
    }
  }

  if (existing && existing.$isLoaded) {
    existing.$jazz.applyDiff({
      powerup_type: powerupType,
      picker_account_id: pickerId,
      status: "confirmed",
      healing_target_team_id:
        powerupType === "healing_potion" ? healingTargetTeamId : undefined,
    })
    return { ok: true }
  }

  list.$jazz.push(
    BattlePowerupSelection.create(
      {
        team_id: myTeamId,
        powerup_type: powerupType,
        picker_account_id: pickerId,
        status: "confirmed",
        healing_target_team_id:
          powerupType === "healing_potion" ? healingTargetTeamId : undefined,
      },
      liveSession.$jazz.owner,
    ),
  )

  return { ok: true }
}

/** Clear this member's round power-up choice for this round. */
export function clearBattlePowerupClaim(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale phase." }
  }

  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not initialized." }
  }
  assertLoaded(battleState)

  if (battleState.phase !== "target_selection") {
    return { ok: false, error: "Cannot change power-ups now." }
  }

  const myTeamId = findPlayerTeamId(me, liveSession)
  if (!myTeamId) return { ok: false, error: "Join a team first." }

  const list = battleState.powerup_selections
  if (!list || !list.$isLoaded) return { ok: true }
  assertLoaded(list)

  const idx = findMemberSelectionIndex(battleState, myTeamId, me.$jazz.id)
  if (idx < 0) return { ok: true }

  const sel = list[idx]
  if (!sel || !sel.$isLoaded) return { ok: true }
  if (sel.picker_account_id !== me.$jazz.id) {
    return { ok: false, error: "Only you can clear your power-up pick." }
  }

  list.$jazz.splice(idx, 1)
  return { ok: true }
}

export function selectBattleTarget(
  me: Account,
  liveSession: Loaded<typeof LiveSession>,
  targetTeamId: string,
): { ok: true } | { ok: false; error: string } {
  assertLoaded(me)
  assertLoaded(liveSession)

  if (liveSession.game_phase !== "battle_royale") {
    return { ok: false, error: "Not in battle royale phase." }
  }

  const battleState = liveSession.battle_state
  if (!battleState || !battleState.$isLoaded) {
    return { ok: false, error: "Battle state not initialized." }
  }
  assertLoaded(battleState)

  if (battleState.phase !== "target_selection") {
    return { ok: false, error: "Targets can only be locked in during the target selection phase." }
  }

  let myTeamId: string | null = null
  const teams = liveSession.teams
  if (!teams || !teams.$isLoaded) return { ok: false, error: "No teams." }
  assertLoaded(teams)

  for (const t of teams) {
    if (!t || !t.$isLoaded) continue
    if (t.leader_account_id === me.$jazz.id) {
      myTeamId = t.id
      break
    }
  }

  if (!myTeamId) {
    return { ok: false, error: "Only team leaders can select targets." }
  }

  if (myTeamId === targetTeamId) {
     return { ok: false, error: "You cannot target your own team." }
  }

  const targetTeam = [...teams].find(t => !!t && t.$isLoaded && t.id === targetTeamId)
  if (targetTeam && targetTeam.$isLoaded && targetTeam.status === "downed") {
     return { ok: false, error: "You cannot target a team that is already downed." }
  }

  const currentTargets = battleState.targets ? { ...battleState.targets } : {}
  currentTargets[myTeamId] = targetTeamId

  battleState.$jazz.applyDiff({ targets: currentTargets })

  return { ok: true }
}

