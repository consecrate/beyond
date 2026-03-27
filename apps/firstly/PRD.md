# Firstly Product Requirements Document

## 1. Product overview

**Product name:** Firstly
**Tagline:** **From your first step to your true potential.**

Firstly is a math-first learning product that turns messy goals, notes, and problems sets into a clear path to mastery. It does this through four connected artifacts:

1. a **skill graph** showing what to learn and in what order
2. a **problem breakdown** showing the prerequisite skills behind a target problem
3. a **lesson unit** for each skill or cluster of skills
4. a **practice set** that lets the learner apply the concept immediately

Firstly is not a generic tutor and not a chat product. Its differentiation is **structure**: prerequisite-aware decomposition, deliberate sequencing, and lesson flows that help learners build mastery step by step.

The product is inspired by the feel of Math Academy style instruction: tight sequencing, explicit examples, and practice immediately after explanation. Learner-visible content must always be original and generated for Firstly.

---

## 2. Product vision

When a college STEM student or self-directed learner encounters a topic they do not understand, Firstly should give them the fastest path from confusion to traction.

The product should be especially strong in two entry points:

- **Intent-driven entry:** “I want to learn this topic.”
- **Problem-driven entry:** “I need to solve this, but I am missing something.”

In both cases, Firstly should produce one recommended path and act confidently.

---

## 3. Core job to be done

> **When I’m stuck, Firstly is the best tool to help me build mastery step-by-step.**

This means:

- it identifies what matters
- it removes unnecessary prerequisite sprawl
- it gives the learner a clear next step
- it makes the original problem feel easier after prerequisite work

---

## 4. Target users

### Primary users

- **College STEM students** working through coursework, homework, exam prep, and lecture material
- **Autodidacts** learning technical or mathematical topics independently

### Why these users first

These users often have:

- messy inputs rather than polished prompts
- concrete pain, such as a hard problem set or unclear lecture notes
- a high tolerance for structured learning if it clearly gets them unstuck
- a strong need for math notation, exactness, and logical sequencing

### Out of scope for v1

- K-12 classroom workflows
- teacher dashboards
- school administration tools
- generalized tutoring for all subjects from day one

---

## 5. Product principles

### 5.1 Start from mess

Firstly should accept incomplete notes, rough goals, copied problem sets, screenshots, and PDFs. The burden of structure belongs to the product, not the learner.

### 5.2 Structure over conversation

Firstly should feel like a learning engine, not a chatbot. The primary interface is the graph and the lesson flow, not an open chat box.

### 5.3 One path, clear direction

Firstly should generate one recommended path and act confidently when the input is clear.

### 5.4 Refuse false precision

When the input is ambiguous enough that a graph would likely be wrong, the system should refuse to structure until clarified rather than inventing a shaky prerequisite map.

### 5.5 Do not over-prerequisite

A graph with too many nodes is a trust failure. Add prerequisite nodes only when they are genuinely required for the target learner and target problem.

### 5.6 Basics before stretch

When starting from problems, Firstly should isolate the missing basics, teach and drill them, then bring the learner back to the original target.

### 5.7 Math first

Firstly should be built for mathematics first. Other domains may follow later, but the initial product should optimize for mathematical correctness, notation, decomposition, and progression.

---

## 6. MVP scope

### Included in MVP

- Input via **text**, **image**, and **PDF**
- **Math notation support** as a hard requirement
- **Skill graph** generation from learning intent, notes, or topic input
- **Problem breakdown** from pasted or uploaded problems
- **Full lesson units** for nodes or clusters of nodes
- **Practice sets** attached to lessons
- Ability to **mark “I already know this”**
- Ability to **delete nodes**
- Session-scoped experience with **no memory across sessions**
- No chat UI

### Explicitly out of scope for MVP

- Persistent learner profiles
- Cross-session memory or saved progress
- Social or collaborative features
- Open-ended tutoring chat
- Teacher tools, grading, LMS features
- PlayDeck integration or shared feature surface beyond infrastructure reuse

---

## 7. User experience

## 7.1 Entry points

### A. Learn a topic

A learner pastes a topic, rough goal, chapter heading, or messy notes. Firstly returns:

- a skill graph
- a recommended order
- lesson units for the graph
- practice sets for each lesson

### B. Solve a hard problem set

A learner pastes or uploads problems they cannot solve. Firstly returns:

- a breakdown of the target problems into prerequisite skills
- a recommended learning path from foundational to target
- lessons and practice sets for those prerequisites
- a path back to the original problems

These are the two first moments of value and the primary wedge for the product.

---

## 8. Core user stories

- As a college STEM student, I can paste a topic or rough notes and get a skill graph that tells me what to learn first.
- As an autodidact, I can paste a hard problem and see which prerequisite ideas I am missing.
- As a learner, I can open a lesson for a node and get a clear teach-example-practice progression.
- As a learner, I can practice a concept immediately after learning it.
- As a learner, I can mark a node as already known so the path gets shorter.
- As a learner, I can delete irrelevant nodes if the graph includes something I do not want.
- As a learner, I do not need to use chat to move forward. The graph and lessons are enough.

---

## 9. Functional requirements

## 9.1 Inputs

The system must accept:

- free-text input
- image uploads
- PDF uploads
- mathematical notation in both input and output

The system should support messy inputs such as:

- incomplete lecture notes
- copied homework prompts
- screenshots of worksheets
- PDFs containing equations and problem statements

## 9.2 Skill graph generation

The system must:

- generate a directed acyclic graph or equivalent ordered structure
- identify prerequisite relationships between skills
- avoid circular dependencies
- avoid redundant or low-value nodes
- produce one recommended path when the input is sufficiently clear

The graph should feel minimal but sufficient.

## 9.3 Problem decomposition

For target problems, the system must:

- identify the underlying prerequisite skills
- order those skills from foundational to target
- connect each prerequisite to a lesson and practice set
- make it clear how the learner returns to the target problem after prep work

## 9.4 Lesson generation

Firstly should generate full lesson units modeled on a tight instructional cadence:

1. **Introduction** of the concept
2. **Worked example** with explicit reasoning
3. **Practice problems** on the same concept with new surface forms
4. **Progression** to nearby variants or harder forms when appropriate

Lessons should feel compact, structured, and mathematically exact rather than chatty or essay-like.

## 9.5 Practice generation

Practice sets should:

- reinforce the specific node or sub-skill being learned
- use novel examples rather than trivial rephrasing of the worked example
- be tightly aligned to the target prerequisite
- prepare the learner to return to the original problem with more confidence

## 9.6 Learner controls

The learner must be able to:

- mark a node as **I already know this**
- delete a node from the graph

These controls should immediately affect the remaining path.

## 9.7 Session model

The product should remember nothing across sessions in v1.

- no persistent learner profile
- no saved graph state
- no long-term adaptation
- each session starts fresh

## 9.8 Ambiguity handling

If the input is too ambiguous to support a high-confidence graph, the system should refuse to structure until clarified.

Examples:

- mixed-topic uploads with no obvious target
- notation that could mean multiple things
- image or PDF quality too poor for reliable extraction

In these cases, the product should clearly explain why it cannot proceed yet.

## 9.9 UI boundary

The product should not include a chat interface in v1.

Core surfaces are:

- graph view
- lesson view
- practice view
- problem breakdown view

---

## 10. Non-goals

Firstly is not:

- a generic AI tutor
- a conversation-first product
- a flashcard or spaced repetition app
- a school system or LMS
- a note-taking app
- a collaborative whiteboard
- a live presentation tool
- an extension of PlayDeck’s session or deck model

---

## 11. Quality bar and failure modes

Trust is fragile here. The main ways Firstly can fail are:

### 11.1 Wrong prerequisites

If the graph teaches the wrong upstream concepts, the learner loses trust quickly.

### 11.2 Too many prerequisites

If the graph becomes bloated, the learner feels trapped in prerequisite purgatory instead of helped.

### 11.3 Weak lessons

If generated lessons feel generic, fluffy, or unhelpful, the product loses its educational value.

### 11.4 Mathematically incorrect examples

This is a critical failure. Incorrect reasoning or notation damages trust immediately.

### 11.5 Messy graphs

If the graph has no clear direction, logic, or narrative, the core product promise breaks.

### 11.6 Slow latency

If generation is too slow, the product becomes unusable in the moments when learners need it most.

### 11.7 Quality bar

A successful output should feel:

- minimal but sufficient
- logically ordered
- mathematically correct
- clearly connected to the user’s stated goal or problem
- useful without requiring a conversation to interpret it

---

## 12. Success metrics

### Primary success metric

- **Learners complete prerequisite work and report that it made the original problem easier.**

### Supporting metrics

- completion rate of prerequisite lessons and practice
- percentage of sessions that reach a generated graph
- percentage of sessions that open at least one lesson
- learner feedback on graph usefulness and lesson quality
- time to first useful output

---

## 13. Technical and content requirements

### 13.1 Math notation

Math notation support is a hard requirement. Inputs and outputs must handle mathematical symbols and expressions reliably.

### 13.2 OCR and parsing

Since image and PDF input are in MVP scope, the product must support:

- OCR or equivalent text extraction
- equation parsing good enough for learner-visible structure and lesson generation
- graceful failure when extraction quality is not sufficient

### 13.3 Originality and compliance

Learner-visible lessons, examples, and practice must be original. The team may study external pedagogy patterns, but must not ship copied lesson content, examples, or problem text without rights.

---

## 14. Phasing

### MVP

- math-first scope
- text, image, and PDF input
- graph generation
- problem decomposition
- lesson generation
- practice generation
- mark-known and delete-node controls
- session-only experience
- no chat UI

### Later

- persistent progress
- saved maps and lesson history
- broader STEM or non-math domains
- smarter adaptation based on prior mastery
- richer control over path depth and lesson pacing

---

## 15. Open questions

These are still worth resolving, but do not block the PRD direction:

- What is the latency budget for graph generation versus lesson generation?
- How compact should the default graph be for a typical college STEM learner?
- When a learner deletes a node, should dependent nodes be recomputed automatically or only hidden?
- What is the best representation for math-heavy PDFs that contain both prose and equations?
- How should the product communicate refusal when ambiguity is high without feeling brittle?

---

## 16. Product summary

Firstly is a math-first product for college STEM students and autodidacts who need a clear path through confusion. It starts from either a learning goal or a hard problem, produces one recommended prerequisite-aware path, and turns that path into lessons and practice. It does not chat. It structures. It teaches. It gets the learner back to the hard thing with stronger footing.
