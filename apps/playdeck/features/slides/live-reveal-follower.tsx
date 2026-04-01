"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import type { Loaded } from "jazz-tools"
import { assertLoaded } from "jazz-tools"
import { useAccount } from "jazz-tools/react"

import Reveal from "reveal.js"
import type { RevealApi } from "reveal.js"
import { buttonVariants, cn } from "@beyond/design-system"
import Link from "next/link"
import { Star, CheckCircle2, Users, LogOut } from "lucide-react"

import type { RevealSlideModel } from "@/features/decks/slide-timeline"
import {
  aggregatePollCounts,
  aggregateQuestionCounts,
  countQuestionAnswers,
  isPollClosed,
  myPollVote,
  myQuestionAnswer,
  questionStatus,
  submitQuestionAnswer,
  upsertPollVote,
  joinLiveSession,
  joinTeam,
  leaveTeam,
  purchasePowerup,
} from "@/features/jazz/live-session-mutations"
import { PlaydeckAccount, type LiveSession, type SessionPlayer, type Team, type PowerupType, type Powerup } from "@/features/jazz/schema"
import type { z } from "jazz-tools"
import { RevealSlideBody } from "@/features/slides/deck-reveal-presenter"
import { InteractiveErrorCard } from "@/features/slides/interactive-error-card"
import { PollSlideCard } from "@/features/slides/poll-slide-card"
import { QuestionSlideCard } from "@/features/slides/question-slide-card"

import "reveal.js/reveal.css"
import "reveal.js/theme/black.css"

export type LiveRevealFollowerProps = {
  /** Keys the Reveal subtree so Strict Mode / destroy() get a fresh DOM per session. */
  sessionId: string
  deckTitle: string
  slides: RevealSlideModel[]
  activeSlideIndex: number
  liveSession: Loaded<typeof LiveSession>
}

export function LiveRevealFollower({
  sessionId,
  deckTitle,
  slides,
  activeSlideIndex,
  liveSession,
}: LiveRevealFollowerProps) {
  const me = useAccount(PlaydeckAccount)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [votePending, startVote] = useTransition()
  const [questionErrorState, setQuestionErrorState] = useState<{
    questionKey: string | null
    message: string | null
  }>({ questionKey: null, message: null })
  const [questionPending, startQuestionSubmit] = useTransition()
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Must match Reveal's current slide for RevealSlideBody lazy window (not only Jazz index). */
  const [revealIndex, setRevealIndex] = useState(0)
  const revealRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const deckApiRef = useRef<RevealApi | null>(null)
  const activeSlideIndexRef = useRef(activeSlideIndex)
  const numSlides = slides.length
  const activeQuestionKey = slides[revealIndex]?.question?.questionKey ?? null
  const questionError =
    activeQuestionKey != null &&
      questionErrorState.questionKey === activeQuestionKey
      ? questionErrorState.message
      : null

  const userId = me.$isLoaded ? me.$jazz.id : ""

  const [isKicked, setIsKicked] = useState(false)
  const hasJoinedRef = useRef(false)

  useEffect(() => {
    if (!me.$isLoaded || !liveSession) return

    const players = liveSession.joined_players
    if (players == null || !players.$isLoaded) return

    assertLoaded(players)
    const playersArr = [...players]
    const isCurrentlyIn = playersArr.some((p) => {
      if (!p) return false
      assertLoaded(p)
      return p.account_id === me.$jazz.id
    })

    if (!hasJoinedRef.current) {
      if (!isCurrentlyIn) {
        joinLiveSession(me, liveSession)
      }
      hasJoinedRef.current = true
    } else {
      if (!isCurrentlyIn) {
        queueMicrotask(() => {
          setIsKicked(true)
        })
      }
    }
  }, [me, liveSession])

  let playPoints = 0
  let myPlayerRecord: Loaded<typeof SessionPlayer> | null = null
  if (me.$isLoaded && liveSession && liveSession.joined_players) {
    const players = liveSession.joined_players
    if (players.$isLoaded) {
      assertLoaded(players)
      for (const p of players) {
        if (p && p.$isLoaded) {
          assertLoaded(p)
          if (p.account_id === userId) {
            playPoints = p.play_points ?? 0
            myPlayerRecord = p
            break
          }
        }
      }
    }
  }

  const formationState = liveSession?.team_formation_state ?? "idle"
  const teams = liveSession?.teams && liveSession.teams.$isLoaded 
    ? Array.from(liveSession.teams).filter(Boolean) as Loaded<typeof Team>[]
    : []

  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamPending, startTeamJoin] = useTransition()

  const handleJoinTeam = (teamId: string) => {
    setTeamError(null)
    startTeamJoin(() => {
       if (!me.$isLoaded) {
         setTeamError("Connecting...")
         return
       }
       assertLoaded(me)
       const res = joinTeam(me, liveSession, teamId)
       if (!res.ok) setTeamError(res.error)
    })
  }

  const handleLeaveTeam = () => {
    setTeamError(null)
    startTeamJoin(() => {
       if (!me.$isLoaded) {
         setTeamError("Connecting...")
         return
       }
       assertLoaded(me)
       const res = leaveTeam(me, liveSession)
       if (!res.ok) setTeamError(res.error)
    })
  }

  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyPending, startBuy] = useTransition()

  const handleBuyPowerup = (type: z.infer<typeof PowerupType>, cost: number) => {
    setBuyError(null)
    startBuy(() => {
       if (!me.$isLoaded) return
       assertLoaded(me)
       if (!myPlayerRecord?.team_id) return
       const res = purchasePowerup(me, liveSession, myPlayerRecord.team_id, type, cost)
       if (!res.ok) setBuyError(res.error)
    })
  }

  useEffect(() => {
    activeSlideIndexRef.current = activeSlideIndex
  }, [activeSlideIndex])

  useEffect(() => {
    if (!revealRef.current || numSlides < 1) {
      return
    }

    const el = revealRef.current
    const deck = new Reveal(el, {
      embedded: true,
      hash: false,
      controls: false,
      progress: true,
      slideNumber: false,
      transition: "slide",
      backgroundTransition: "fade",
      width: 960,
      height: 700,
      margin: 0.04,
      keyboard: false,
      touch: false,
      overview: false,
    })

    let cancelled = false
    deck
      .initialize()
      .then(() => {
        if (cancelled) {
          return
        }
        const h = Math.min(
          Math.max(0, activeSlideIndexRef.current),
          Math.max(0, numSlides - 1),
        )
        deck.slide(h, 0)
        const ih = deck.getIndices().h
        setRevealIndex(ih)
        deckApiRef.current = deck
        deck.layout()
        const viewportEl = viewportRef.current
        if (viewportEl && typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current?.disconnect()
          const ro = new ResizeObserver(() => {
            deckApiRef.current?.layout()
          })
          ro.observe(viewportEl)
          resizeObserverRef.current = ro
        }
        requestAnimationFrame(() => {
          if (cancelled) return
          deck.layout()
        })
      })
      .catch((err: unknown) => {
        console.error("Reveal.initialize() failed", err)
        setLoadError("Could not load the live session.")
      })

    return () => {
      cancelled = true
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      deck.destroy()
      deckApiRef.current = null
    }
  }, [numSlides, sessionId])

  useEffect(() => {
    const deck = deckApiRef.current
    if (!deck || numSlides < 1) return
    const h = Math.min(Math.max(0, activeSlideIndex), numSlides - 1)
    const cur = deck.getIndices?.().h
    if (cur === h) return
    deck.slide(h, 0)
    setRevealIndex(deck.getIndices().h)
    deck.layout()
  }, [activeSlideIndex, numSlides])

  useEffect(() => {
    deckApiRef.current?.layout()
  }, [slides.length])

  if (isKicked) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary">You have been kicked</h2>
        <p className="max-w-sm text-sm text-muted-foreground mb-4">
          The presenter has removed you from this session.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Return to Homepage
        </Link>
      </div>
    )
  }

  if (numSlides < 1) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
        No slides in this session.
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deckTitle}</p>
        </div>
        <div className="flex shrink-0 items-center justify-end">
          {myPlayerRecord?.team_id && formationState !== "idle" ? (
             <div className="mr-3 flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Users className="h-3.5 w-3.5" />
                <span className="tabular-nums block pt-px">
                   Team: {teams.find(t => t?.id === myPlayerRecord?.team_id)?.name ?? "Unknown"}
                </span>
             </div>
          ) : null}
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-500/50" />
            <span className="tabular-nums block pt-px">{playPoints} PlayPoints</span>
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {loadError ? (
          <p className="p-6 text-center text-sm text-destructive">{loadError}</p>
        ) : (
          <>
            <div
              key={sessionId}
              className="absolute inset-0 z-0 flex flex-col"
            >
              <div
                ref={viewportRef}
                className="reveal-viewport h-full min-h-0 w-full flex-1"
              >
                <div ref={revealRef} className="reveal h-full min-h-[50vh]">
                  <div className="slides">
                    {slides.map((slide, i) => (
                      <section
                        key={i}
                        className="flex items-center justify-center !p-4"
                        data-background-color="#0d1117"
                      >
                        <RevealSlideBody
                          slide={slide}
                          slideIndex={i}
                          activeIndex={revealIndex}
                        />
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {(() => {
               const gamePhase = liveSession.game_phase ?? "lobby"
               
               if (gamePhase === "playing" && myPlayerRecord?.team_id) {
                  const myTeam = teams.find(t => t.id === myPlayerRecord?.team_id)
                  const teamPowerups = myTeam?.powerups && myTeam.powerups.$isLoaded ? Array.from(myTeam.powerups).filter((pu): pu is Loaded<typeof Powerup> => !!(pu && pu.$isLoaded)) : []
                  const myPowerups = teamPowerups.filter(pu => pu.owner_account_id === userId && !pu.is_used)
                  
                  return (
                     <div className="absolute top-4 left-4 z-40 flex flex-col gap-2 pointer-events-none">
                        <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md">
                           <span className="text-red-500 font-bold flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-500 text-amber-500 hidden" /> ❤️ {myTeam?.hp ?? 20}</span>
                           <div className="w-px h-3 bg-border" />
                           <span className="flex items-center gap-1 text-sm font-semibold opacity-80">{myTeam?.name}</span>
                        </div>
                        {myPowerups.length > 0 && (
                           <div className="flex flex-col gap-1.5 pointer-events-auto">
                              {myPowerups.map((pu, i) => {
                                 if(!pu) return null
                                 const puName = pu.type.replace("_", " ")
                                 return (
                                    <button key={i} className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-md transition-all hover:bg-primary/20 hover:scale-105 active:scale-95">
                                       <Star className="h-3 w-3 fill-current" />
                                       <span className="capitalize">{puName}</span>
                                    </button>
                                 )
                              })}
                           </div>
                        )}
                     </div>
                  )
               }
               
               if (gamePhase === "store" && myPlayerRecord?.team_id) {
                  const myTeam = teams.find(t => t.id === myPlayerRecord?.team_id)
                  const isLeader = myTeam?.leader_account_id === userId
                  const teamPowerups = myTeam?.powerups && myTeam.powerups.$isLoaded ? Array.from(myTeam.powerups).filter((pu): pu is Loaded<typeof Powerup> => !!(pu && pu.$isLoaded)) : []
                  
                  const POWERUPS: {type: z.infer<typeof PowerupType>, name: string, desc: string, cost: number}[] = [
                     {type: "1/4", name: "1/4", desc: "Eliminate 1 incorrect option.", cost: 20},
                     {type: "healing_potion", name: "Healing Potion", desc: "Gift 1 HP to another team.", cost: 20},
                     {type: "shield", name: "Shield", desc: "Block the next 1 HP of damage.", cost: 30},
                     {type: "espionage", name: "Espionage", desc: "See what option 1st-place team hovers.", cost: 30},
                     {type: "medkit", name: "Medkit", desc: "Restore 2 HP instantly.", cost: 40},
                     {type: "double_damage", name: "Double Damage", desc: "Deal 2 HP instead of 1.", cost: 40},
                     {type: "deflect", name: "Deflect", desc: "Bounce damage back to attacker.", cost: 50},
                     {type: "critical_hit", name: "Critical Hit", desc: "Deals 3 HP if 100% accuracy.", cost: 60},
                  ]
                  
                  if (isLeader) {
                     return (
                        <div className="absolute inset-0 z-50 flex flex-col bg-background p-4 md:p-8 overflow-auto animate-in fade-in zoom-in-95 duration-500" role="presentation">
                           <div className="mx-auto w-full max-w-4xl flex flex-col items-center gap-6">
                              <div className="text-center">
                                 <h2 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">Powerup Store</h2>
                                 <p className="mt-2 text-lg text-muted-foreground font-medium">Equip your team for the battle ahead.</p>
                              </div>
                              
                              <div className="flex items-center gap-4 mb-4">
                                 <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-6 py-3 border border-amber-500/20">
                                    <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                                    <span className="text-2xl font-bold text-amber-500">{myTeam?.banked_play_points ?? 0}</span>
                                    <span className="text-sm font-semibold opacity-70 uppercase tracking-widest text-amber-500 ml-1 mt-1">PlayPoints</span>
                                 </div>
                              </div>
                              
                              {buyError && <p className="text-destructive font-medium bg-destructive/10 p-3 rounded-lg w-full text-center border border-destructive/20">{buyError}</p>}
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                 {POWERUPS.map(pu => {
                                    const canAfford = (myTeam?.banked_play_points ?? 0) >= pu.cost
                                    return (
                                       <button
                                          key={pu.type}
                                          disabled={buyPending || !canAfford}
                                          onClick={() => handleBuyPowerup(pu.type, pu.cost)}
                                          className={cn(
                                             "relative flex flex-col text-left items-start gap-3 p-5 rounded-2xl border-2 transition-all duration-300",
                                             canAfford 
                                                ? "bg-card hover:bg-muted/50 border-border hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 active:scale-95" 
                                                : "bg-muted/20 border-border/50 opacity-60 cursor-not-allowed"
                                          )}
                                       >
                                          <div className="flex items-center justify-between w-full">
                                             <h3 className="font-bold text-base leading-tight">{pu.name}</h3>
                                             <span className={cn("text-xs font-bold px-2 py-1 rounded-full", canAfford ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground")}>{pu.cost} PP</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground leading-snug">{pu.desc}</p>
                                       </button>
                                    )
                                 })}
                              </div>
                              
                              {teamPowerups.length > 0 && (
                                 <div className="w-full mt-6 bg-card/50 rounded-2xl p-6 border border-border">
                                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-4">Acquired Inventory (Randomly Assigned)</h3>
                                    <div className="flex flex-wrap gap-2">
                                       {teamPowerups.map((pu, i) => {
                                          const member = liveSession.joined_players && liveSession.joined_players.$isLoaded ? Array.from(liveSession.joined_players).find(p => p && p.$isLoaded && p.account_id === pu.owner_account_id) as Loaded<typeof SessionPlayer> | undefined : null
                                          return (
                                             <div key={i} className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-medium">
                                                <span className="capitalize">{pu.type.replace("_", " ")}</span>
                                                <span className="opacity-40">→</span>
                                                <span className="font-semibold text-primary truncate max-w-[100px]">{member ? member.name : "Member"}</span>
                                             </div>
                                          )
                                       })}
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     )
                  }
                  
                  // Regular Member Waiting View
                  return (
                     <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md p-6 overflow-auto animate-in fade-in duration-500" role="presentation">
                        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center items-center text-center">
                           <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6 animate-pulse">
                              <Star className="h-8 w-8 text-amber-500 fill-amber-500" />
                           </div>
                           <h2 className="text-3xl font-black uppercase tracking-widest mb-3">Gearing Up</h2>
                           <p className="text-lg text-muted-foreground max-w-md">Your Team Leader is currently at the store supplying the team.</p>
                           
                           <div className="w-full mt-12 bg-card rounded-2xl p-6 border border-border text-left shadow-xl h-64 overflow-y-auto">
                              <h3 className="text-xs font-bold uppercase tracking-wider opacity-50 mb-4 sticky top-0 bg-card z-10 py-1">Live Feed</h3>
                              {teamPowerups.length === 0 ? (
                                 <p className="text-sm italic opacity-50 flex items-center h-20">Waiting for purchases...</p>
                              ) : (
                                 <div className="flex flex-col gap-3">
                                    {teamPowerups.map((pu, i) => {
                                       const member = liveSession.joined_players && liveSession.joined_players.$isLoaded ? Array.from(liveSession.joined_players).find(p => p && p.$isLoaded && p.account_id === pu.owner_account_id) as Loaded<typeof SessionPlayer> | undefined : null
                                       const isMe = pu.owner_account_id === userId
                                       return (
                                          <div key={i} className={cn("flex items-center justify-between p-3 rounded-xl border animate-in slide-in-from-bottom-4 fade-in duration-300", isMe ? "border-primary/50 bg-primary/10" : "border-border bg-background")}>
                                             <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                   <Star className="h-4 w-4 opacity-50" />
                                                </div>
                                                <span className="font-semibold capitalize text-sm">{pu.type.replace("_", " ")}</span>
                                             </div>
                                             <div className="flex items-center gap-1.5 text-sm">
                                                <span className="opacity-50">Received by</span>
                                                <span className={cn("font-bold px-2 py-0.5 rounded-md", isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>{isMe ? "YOU" : (member ? member.name : "Member")}</span>
                                             </div>
                                          </div>
                                       )
                                    })}
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  )
               }
               
               return null
            })()}

            {formationState === "open" ? (
               <div className="absolute inset-0 z-20 flex flex-col bg-background/95 backdrop-blur-sm p-6 overflow-auto" role="presentation">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                     {myPlayerRecord?.team_id ? (
                        <div className="text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
                           <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                              <CheckCircle2 className="h-10 w-10 text-primary" />
                           </div>
                           <h2 className="text-3xl font-black tracking-tight mb-2">You&apos;re in!</h2>
                           <p className="text-muted-foreground">Waiting for the presenter to start the game.</p>
                           {(() => {
                              const myTeam = teams.find(t => t.id === myPlayerRecord?.team_id)
                              const isLeader = myTeam?.leader_account_id === userId
                              
                              if (isLeader) {
                                  return (
                                     <div className="mt-8 flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm font-semibold text-amber-500">
                                        <Star className="h-4 w-4 fill-amber-500/50" />
                                        Team Leader
                                     </div>
                                  )
                              }
                              
                              return (
                                 <button
                                    onClick={handleLeaveTeam}
                                    disabled={teamPending}
                                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors duration-300 rounded-full px-5")}
                                 >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Leave Team
                                 </button>
                              )
                           })()}
                           {teamError && <p className="text-destructive text-sm font-medium mt-3 bg-destructive/10 p-2 rounded-md">{teamError}</p>}
                        </div>
                     ) : (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                           <div className="text-center">
                              <h2 className="text-3xl font-black tracking-tight">Choose Your Team</h2>
                              <p className="opacity-70 mt-1">Join a team to compete in the Battle Royale.</p>
                              {teamError && <p className="text-destructive text-sm font-medium mt-3 bg-destructive/10 p-2 rounded-md">{teamError}</p>}
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {teams.map(t => {
                                 const leader = liveSession.joined_players && liveSession.joined_players.$isLoaded
                                    ? Array.from(liveSession.joined_players).find(p => p && p.$isLoaded && p.account_id === t.leader_account_id) as Loaded<typeof SessionPlayer> | undefined
                                    : null
                                 return (
                                    <button
                                       key={t.id}
                                       onClick={() => handleJoinTeam(t.id)}
                                       disabled={teamPending}
                                       className={cn(
                                          "relative flex flex-col items-start gap-1 rounded-xl border-2 p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 disabled:pointer-events-none disabled:opacity-50",
                                          t.color,
                                          "bg-background/80 hover:bg-background"
                                       )}
                                    >
                                       <h3 className="text-xl font-bold">{t.name}</h3>
                                       <div className="mt-2 flex items-center gap-1.5 text-sm font-medium opacity-80">
                                          <Star className="h-3.5 w-3.5 fill-current" />
                                          {leader ? leader.name : "No Leader"}
                                       </div>
                                    </button>
                                 )
                              })}
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            ) : null}

            {slides[revealIndex]?.interactiveError ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-8 md:px-10">
                  <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
                    <InteractiveErrorCard
                      layout="overlay"
                      title={slides[revealIndex].title}
                      message={slides[revealIndex].interactiveError!.message}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {slides[revealIndex]?.poll ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
                  <PollSlideCard
                    layout="overlay"
                    block={slides[revealIndex].poll!}
                    variant="audience"
                    counts={aggregatePollCounts(
                      liveSession,
                      slides[revealIndex].poll!.pollKey,
                      slides[revealIndex].poll!.options.length,
                    )}
                    myVote={myPollVote(
                      liveSession,
                      userId,
                      slides[revealIndex].poll!.pollKey,
                    )}
                    pollClosed={isPollClosed(
                      liveSession,
                      slides[revealIndex].poll!.pollKey,
                    )}
                    name={`join-poll-${sessionId}-${revealIndex}`}
                    voteError={voteError}
                    votePending={votePending}
                    voteAccountReady={me.$isLoaded}
                    onVote={(optionIndex) => {
                      setVoteError(null)
                      startVote(() => {
                        if (!me.$isLoaded) {
                          setVoteError(
                            "Still connecting. Try again in a moment.",
                          )
                          return
                        }
                        assertLoaded(me)
                        const r = upsertPollVote(me, liveSession, {
                          pollKey: slides[revealIndex].poll!.pollKey,
                          optionIndex,
                          optionCount:
                            slides[revealIndex].poll!.options.length,
                        })
                        if (!r.ok) setVoteError(r.error)
                      })
                    }}
                  />
                </div>
              </div>
            ) : null}

            {slides[revealIndex]?.question ? (
              <div
                className="absolute inset-0 z-10 flex flex-col bg-background"
                role="presentation"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
                  {(() => {
                    const question = slides[revealIndex].question!
                    const state = questionStatus(liveSession, question.questionKey)
                    const resultsVisible = state === "revealed"
                    const counts = resultsVisible
                      ? aggregateQuestionCounts(
                        liveSession,
                        question.questionKey,
                        question.options.length,
                      )
                      : Array.from({ length: question.options.length }, () => 0)

                    return (
                      <QuestionSlideCard
                        layout="overlay"
                        block={question}
                        variant="audience"
                        state={state}
                        resultsVisible={resultsVisible}
                        counts={counts}
                        answeredCount={countQuestionAnswers(
                          liveSession,
                          question.questionKey,
                        )}
                        myAnswer={myQuestionAnswer(
                          liveSession,
                          userId,
                          question.questionKey,
                        )}
                        audienceAccountId={userId}
                        submitError={questionError}
                        submitPending={questionPending}
                        accountReady={me.$isLoaded}
                        onSubmit={(optionIndex) => {
                          setQuestionErrorState({
                            questionKey: question.questionKey,
                            message: null,
                          })
                          startQuestionSubmit(() => {
                            if (!me.$isLoaded) {
                              setQuestionErrorState({
                                questionKey: question.questionKey,
                                message: "Still connecting. Try again in a moment.",
                              })
                              return
                            }
                            assertLoaded(me)
                            const result = submitQuestionAnswer(me, liveSession, {
                              questionKey: question.questionKey,
                              optionIndex,
                              optionCount: question.options.length,
                            })
                            if (!result.ok) {
                              setQuestionErrorState({
                                questionKey: question.questionKey,
                                message: result.error,
                              })
                            }
                          })
                        }}
                      />
                    )
                  })()}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
