Techstack:

Next.js
TypeScript
Tailwind + shadcn/ui
reveal.js
UploadThing (slide image hosting); Jazz (deck sync)
Monaco
Judge0 CE

# PlayDeck v1 Product Requirements Document

## 1. Product overview

**Product name:** PlayDeck
**Tagline:** **Every slide is a playground.**

PlayDeck is a live teaching platform for interactive slides. A presenter runs a deck live while students join a session, follow slide progression in real time, and participate in interactive slides for points.

The core differentiation in v1 is that:

* slides are **live and synchronized** during presentation,
* students can **navigate within allowed bounds**,
* interactive slides award **automatic points**,
* students can **form teams and compete together**, and
* code slides use a **LeetCode-style interface**.

A unique PlayDeck feature is that a single slide can have **different but complementary teacher and student views**. For example, the teacher may see a demo or control surface while students see a simplified or explanatory companion view.

v1 is designed for live use in a university club setting and should prioritize simplicity, reliability, fast session setup, and fun team competition.

---

## 2. Goals

### Primary goals

* Let a presenter create a deck of slides and present it live.
* Let students join a session and follow the presentation in real time.
* Support both static and interactive slides.
* Award points automatically on interactive slides.
* Support team-based competition with team leaders and configurable team sizes.
* Make code slides feel like a lightweight live LeetCode experience.
* Enable a sequence of interactive slides to function as a **Contest**, a mini-Kahoot-style tournament.

### Secondary goals

* Give presenters live visibility into session participation and performance.
* Make the product engaging enough for club use without adding too much system complexity.
* Keep authoring simple enough that a presenter can build a usable deck quickly.

### Non-goals for v1

* Full LMS integration
* Homework / asynchronous mode
* AI-generated decks
* Powerups, sabotage, or attack mechanics
* Advanced analytics beyond core live and post-session reporting
* Marketplace/templates ecosystem
* Rich block-based slide layout builder beyond core v1 authoring needs

---

## 3. Product principles

### 3.1 Simplicity first

v1 should avoid overbuilding. The main success criterion is a smooth live session for a real audience.

### 3.2 Presenter control

The presenter controls progression, timing, locking, reveal, and overall session flow.

### 3.3 Team competition over individual chaos

Competition exists primarily through team play. Individual performance contributes to team score.

### 3.4 Automatic scoring

Point values are not manually authored. The system computes points automatically based on slide type and performance.

### 3.5 Complementary teacher and student experiences

Teacher and student may see different versions of the same slide, but both views must serve the same learning objective.

---

## 4. Target users

### Primary user

* **Presenter / teacher / club leader** creating and running a live deck

### Secondary users

* **Students / audience participants** joining the session live
* **Team leaders** who create teams during the session lobby

---

## 5. Core v1 user stories

### Presenter

* I can create a deck with slides.
* I can choose slide types.
* I can present the deck live to an audience.
* I can see students join the session.
* I can control progression through the deck.
* I can start and end interactive slides.
* I can see live results and the leaderboard.
* I can see team performance and basic per-student performance.
* I can stack multiple interactive slides into a Contest.

### Student

* I can join a live session with a simple code or link.
* I can enter a display name.
* I can create a team, become team leader, or join an existing team if there is room.
* I can follow the live slide progression.
* I can navigate back through allowed slides.
* I can answer interactive slides and earn points.
* I can contribute to my team’s score.
* I can do code slides in a LeetCode-style view.
* I can see live results and the team leaderboard when allowed.

### Team leader

* I can create a team during the lobby.
* I can choose a team name.
* I can set the allowed number of members, subject to presenter-configured limits.
* Other students can join my team until it is full.

---

## 6. Core concepts and object model

### 6.1 Deck

A presentation made up of ordered slides.

Fields:

* title
* description (optional)
* author
* slides[]
* created_at
* updated_at

### 6.2 Slide

A single unit in a deck.

Fields:

* id
* title
* type
* teacher_view
* student_view
* order_index
* contest_group_id (optional)
* timing_settings (optional)
* status during session

### 6.3 Slide types

v1 supports four slide types:

* **Show**
* **Poll**
* **MCQ**
* **Code**

### 6.4 Contest

A **Contest** is a grouped sequence of MCQ and/or Code slides that behave like a mini-tournament.

Properties:

* ordered set of eligible interactive slides
* contest title
* optional shared theme
* contest-level leaderboard emphasis
* contest start/end states

### 6.5 Session

A live instance of a deck presentation.

Fields:

* session_id
* join_code
* deck_id
* presenter_id
* state (lobby, live, paused, ended)
* current_slide_index
* leaderboard state
* contest state

### 6.6 Participant

A student in a live session.

Fields:

* participant_id
* display_name
* team_id (optional until chosen)
* joined_at
* current_score
* per-slide submissions

### 6.7 Team

A group of students in the session.

Fields:

* team_id
* team_name
* leader_participant_id
* max_members
* members[]
* team_score

### 6.8 Submission

A participant’s answer or interaction result for an interactive slide.

Fields:

* submission_id
* participant_id
* slide_id
* answer / code submission
* correctness
* response_time
* awarded_points
* created_at

---

## 7. Slide types and requirements

## 7.1 Show slide

A Show slide is the default slide type. It is used for regular presentation content and may be static or complementary.

### Purpose

* deliver information
* introduce concepts
* explain problem setup
* present examples
* show teacher-only controls or student-facing companion content

### Behavior

* does not directly require submission
* does not act as a scoring event
* may have different teacher and student views
* students may navigate among allowed Show slides according to session navigation rules

### Examples

* normal slide with text and images
* teacher live demo + student explanation companion
* teacher code walkthrough + student simplified “goal of the algorithm” view

## 7.2 Poll slide

A Poll slide asks students to respond to a question. Polls award points automatically.

### Purpose

* quick feedback
* opinion check
* confidence check
* prediction check

### Behavior

* interactive
* students submit one response
* live aggregate results are shown to presenter
* system awards automatic points
* can be part of a Contest if desired

### v1 scoring intent

Polls should reward participation and optionally speed, but should remain simple.

## 7.3 MCQ slide

An MCQ slide asks a multiple-choice question and awards points automatically.

### Purpose

* understanding check
* concept check
* prediction check
* fast competitive question

### Behavior

* interactive
* one correct answer in v1
* live aggregate results visible to presenter
* can reveal answer/results when presenter chooses
* can be part of a Contest

### v1 scoring intent

Points are based on correctness and speed.

## 7.4 Code slide

A Code slide is the coding interaction slide. It replaces “Code Challenge” terminology in v1.

### Purpose

* let students solve a coding task
* let students work in a LeetCode-style interface during the live session
* contribute meaningful points to the team competition

### Required v1 layout

* problem title
* problem statement
* examples
* code editor
* language selection (v1 may support only one language initially)
* run button
* submit button
* test result area
* timer display if timed
* team score / leaderboard context

### Behavior

* interactive
* students can run code and submit during the active window
* system evaluates submissions and awards points automatically
* can be part of a Contest

### LeetCode-style requirement

This is a signature v1 experience. The Code slide must feel recognizably like a stripped-down competitive coding interface rather than just a text box.

---

## 8. Complementary teacher/student slide views

A single slide may render differently for presenter and student.

### Principle

Both views represent the same slide and learning objective, but the information and controls shown may differ by role.

### Examples

* Teacher sees a code demo; students see an explanation of what the code is trying to achieve.
* Teacher sees notes or controls; students see a cleaner instructional version.
* Teacher sees live result controls; students see answer options and timer.

### Constraints

* The two views must remain semantically paired.
* Authoring must not let the slide become two unrelated experiences.
* For v1, this should be implemented simply: one teacher view and one student view per slide.

---

## 9. Session flow

## 9.1 Session states

A session has four states:

### Lobby

* presenter has opened the session
* join code is active
* students join and enter display names
* teams are created and joined
* presenter can see attendance

### Live

* presenter is actively presenting
* current slide is synchronized
* interactive slides can open, close, and reveal results

### Paused

* presenter temporarily pauses progression
* timer behavior depends on pause implementation

### Ended

* session is over
* final leaderboard shown
* post-session summary available

---

## 10. Team system

Team mode is a core v1 feature.

### Team creation

* students can create teams in the lobby
* the creator becomes the team leader
* the leader chooses the team name
* the leader sets team size, subject to presenter-configured max team size

### Team joining

* students can browse available teams
* students can join a team if it has capacity
* students may only belong to one team at a time

### Team scoring

* each participant earns points individually
* individual points contribute to the team total
* leaderboard emphasizes team ranking

### Team leader responsibilities in v1

* create team
* define member count within allowed limits

### Non-goals for v1

* team chat
* advanced captain mechanics
* intra-team role assignment

---

## 11. Navigation rules

These rules are critical to PlayDeck’s live behavior.

### Presenter navigation

* presenter controls the official current slide
* presenter may move forward and backward
* presenter may start or end interactive windows

### Student navigation

Students do **not** have fully free navigation.

Rules:

* students always land on the presenter’s current slide when joining live
* students may navigate back to previously seen **Show** slides
* students may not navigate ahead beyond the current gated point
* students may not skip past an interactive slide that has not yet been completed or passed in session flow
* interactive slides act as progression gates

### Intended effect

Students can review non-interactive content without breaking the live sequence or bypassing active participation moments.

---

## 12. Contests

A Contest is a grouped run of MCQ and/or Code slides that acts like a mini live tournament.

### Contest purpose

* create a burst of competitive energy
* package several interactive slides into one recognizable game segment
* make a section feel more like Kahoot/Quizizz/Gimkit

### Contest rules in v1

* only MCQ and Code slides may belong to a Contest
* slides remain separate slides, but are visually and competitively grouped
* a Contest may have a title
* a Contest may surface an intensified leaderboard between slides
* the presenter can start and end the Contest as a section

### Contest experience

* faster pace
* clearer leaderboard emphasis
* live results after each interactive item or at presenter-defined moments

### v1 simplification

No powerups or attack mechanics in v1. Contests should capture the energy of a mini-tournament without adding game-economy complexity.

---

## 13. Scoring

### Principle

Point values are **automatic**, not manually set by the presenter.

### v1 scoring goals

* reward participation
* reward correctness where applicable
* reward speed where appropriate
* keep rules legible and consistent
* make team competition meaningful

### Proposed v1 scoring model

#### Poll

* awards points for participation
* may include modest speed bonus

#### MCQ

* awards points for correctness
* includes speed bonus

#### Code

* awards points based on successful submission and speed
* may optionally use partial credit later, but v1 can start with success-based scoring

### Team score

* team score = sum of member points

### Presenter control

For v1, presenters should not edit specific point values, but may choose a session mode that influences scoring behavior in the future.

---

## 14. Interactive slide lifecycle

Interactive slides (Poll, MCQ, Code) move through states:

* **not started**
* **live/open**
* **closed/locked**
* **results revealed**

### Presenter actions

* open slide for responses
* close submissions
* reveal results
* move on

### Student experience

* can submit only while slide is live
* sees locked state after submissions close
* sees results when presenter reveals them or when system auto-reveals

---

## 15. Presenter controls

The presenter needs simple but reliable live controls.

### Required controls

* start session
* end session
* move to next slide
* move to previous slide
* jump to a slide
* open interactive slide
* close submissions
* reveal results
* start contest section
* end contest section
* pause/resume session

### Optional v1 if simple enough

* hide/show leaderboard
* restart current interactive slide

---

## 16. Presenter dashboard requirements

The presenter should be able to track the live session clearly.

### Live dashboard must show

* session join code
* current attendance
* list/count of teams
* current slide
* live results for active interactive slide
* team leaderboard
* contest state if active

### Basic performance visibility

For v1, presenter should be able to view at least:

* who joined
* which team each participant belongs to
* whether each participant submitted on interactive slides
* correctness for MCQ and Code where applicable
* current individual score
* current team score

### Post-session summary should include

* final team leaderboard
* individual contribution totals
* slide-by-slide participation counts
* slide-by-slide correctness where relevant

---

## 17. Student experience requirements

### Joining

* join with code or link
* enter display name
* create team or join team in lobby

### In-session

* see live slide progression
* navigate back through eligible Show slides
* participate in Poll, MCQ, and Code slides
* see points awarded
* see team leaderboard when shown

### Code view

The Code slide must feel polished and focused. The student should feel like they are in a compact competitive coding environment.

---

## 18. Authoring requirements

v1 authoring should stay simple.

### Presenter can create

* deck title
* ordered slides
* per-slide type
* teacher-side content
* student-side content
* contest grouping for eligible slides
* timer settings for interactive slides where applicable

### Authoring by slide type

#### Show

* rich text / content
* teacher view
* student view

#### Poll

* question
* answer choices or poll format
* teacher view
* student view

#### MCQ

* question
* choices
* correct answer
* teacher view
* student view
* optional timer

#### Code

* problem title
* problem statement
* example(s)
* starter code
* language
* test setup
* teacher view
* student view
* optional timer

### Save/edit

* presenter can save a draft deck
* presenter can edit an existing deck before presentation

---

## 19. Timer behavior

Timers matter especially for MCQ and Code slides and within Contests.

### v1 timer requirements

* interactive slides may be timed
* presenter can start timer with slide activation
* presenter can close early
* timer expiration closes submissions

### Contest timing

In v1, each interactive slide in a Contest can use its own timer rather than requiring a contest-wide timer system.

---

## 20. Late joiner behavior

Late joiners are likely in club usage and must be handled cleanly.

### Rules

* late joiners can still enter the session while live, unless presenter disables entry
* they land on the current live slide
* they can join an available team if team joining is still open
* they may access previously available Show slides within navigation rules
* they do not gain retroactive points for missed interactive slides

---

## 21. Leaderboard behavior

### v1 priority

The primary leaderboard is the **team leaderboard**.

### Additional visibility

The presenter may also view individual standings and contributions.

### Suggested student-facing behavior

* show team rankings prominently
* optionally surface top contributors within a team or overall

### End-of-session

* display final team rankings
* show individual contribution highlights

---

## 22. Contest and leaderboard UX intent

When a Contest is active, the product should feel more energetic.

### Desired v1 effect

* more obvious scoring updates
* more visible team ranking shifts
* more frequent result moments

This should feel like a mini live tournament without requiring a separate game mode architecture yet.

---

## 23. Functional requirements summary

### Must-have v1 functionality

* Create and save decks
* Support Show, Poll, MCQ, Code slide types
* Support separate teacher and student views per slide
* Start a live session from a deck
* Let students join with code/link and display name
* Team creation and team joining in lobby
* Live synchronized presentation
* Student back-navigation across eligible Show slides
* Interactive slide gating
* Poll/MCQ/Code scoring with automatic points
* Team leaderboard
* LeetCode-style Code slide UX
* Contest grouping across MCQ/Code slides
* Basic live presenter dashboard
* Basic post-session results

### Nice-to-have only if easy in v1

* leaderboard show/hide toggle
* simple contribution highlights
* slide jump controls

---

## 24. Success criteria for v1

A successful v1 should enable the following end-to-end flow:

1. Presenter creates a deck with Show and interactive slides.
2. Presenter starts a live session.
3. Students join, create teams, and choose teams.
4. Presenter runs through the deck live.
5. Students can review Show slides without bypassing interactive gates.
6. Students answer Poll and MCQ slides and complete Code slides.
7. Points are awarded automatically.
8. Team leaderboard updates live.
9. A grouped Contest section feels like a mini competitive tournament.
10. Presenter can review session performance at the end.

---

## 25. Open questions / decisions to finalize

These should be resolved before implementation starts, but they do not block the PRD.

### Product decisions

* Does v1 support only one coding language or multiple?
* Should Polls always award identical participation points, or should speed factor in?
* For Code slides, should points require full success only, or support partial credit?
* Are students allowed to change teams after joining?
* Can team leaders edit team size after team creation?
* Is leaderboard always visible to students, or controlled by presenter?
* Are Contests just a presentational grouping in v1, or do they also change scoreboard emphasis and transitions?

### UX decisions

* How rich should Show slide authoring be in v1?
* How should teacher/student complementary content be authored without making creation too complex?
* Should students see individual score alongside team score at all times?

### Technical decisions

* What is the first supported code execution language?
* What is the minimum viable code runner architecture for live club use?

---

## 26. Recommended v1 implementation priority

### Phase 1: Core presentation and session

* deck creation
* Show slide creation
* live session creation
* join flow
* synchronized slide progression
* teacher/student view separation

### Phase 2: Team mode

* lobby
* create team
* join team
* team size limits
* team leaderboard foundation

### Phase 3: Interactive slides

* Poll
* MCQ
* scoring
* live results

### Phase 4: Code

* LeetCode-style code interface
* run/submit flow
* automatic scoring

### Phase 5: Contest wrapper

* group MCQ/Code slides
* contest UX and leaderboard emphasis
* post-session summary

---

## 27. Final product statement

**PlayDeck is a live interactive teaching platform where every slide is a playground. Presenters create decks with Show, Poll, MCQ, and Code slides; students join live, form teams, and compete through interactive moments and Contest sequences while following the presentation in real time.**