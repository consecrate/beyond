# Firstly AI Direction

## Where we are now

Firstly currently has a narrow AI integration focused on live session graph editing.

- The current AI chat helps mutate the skill tree in a session.
- It can create lessons, edit lesson titles/goals, and change prerequisite edges.
- It does **not** yet represent the final long-term content architecture for MathAcademy-like lesson generation.

The app already has strong graph primitives and schema groundwork, but the actual learner-facing lesson/practice experience is still mostly ahead of us.

That means this is a good time to simplify before a larger in-app AI pipeline hardens.

## Our direction

We are moving away from app-native AI generation as the main workflow.

Instead, we want to use a **custom GPT** to:

- break broad topics into the right set of lessons
- organize those lessons into a prerequisite structure
- later generate MathAcademy-like lesson content from those lessons

Firstly itself should remain responsible for:

- storing the canonical graph
- validating imports
- rendering the skill tree
- later rendering lessons and practice

So the model is:

**Custom GPT generates. Firstly imports and owns the structure.**

## Import boundary

The import schema should contain only:

- `lessons`
- `edges`

No session title is needed in the import payload.
The session already exists in Firstly, and the import should build the skill tree inside that session.

## Lesson node shape

Each lesson in the import should include:

- `key` — stable internal reference used by edges
- `kind` — either `concept` or `problem`
- `title` — learner-facing lesson title
- `goalText` — what the learner should be able to do, and what bigger direction this lesson is building toward

Example:

```json
{
  "lessons": [
    {
      "key": "intro-recurrence-relations",
      "kind": "concept",
      "title": "Introduction to Recurrence Relations",
      "goalText": "Understand what a recurrence relation is and compute early terms from a recursive definition."
    },
    {
      "key": "classify-basic-recurrence-problems",
      "kind": "problem",
      "title": "Classify Basic Recurrence Problems",
      "goalText": "Classify standard recurrence relations by order, linearity, and homogeneity in exam-style problems."
    }
  ],
  "edges": [
    {
      "from": "intro-recurrence-relations",
      "to": "classify-basic-recurrence-problems"
    }
  ]
}
```

## What we want from the custom GPT

If the user says something like:

> I want to study Recursion for Discrete Maths

the GPT should **not** produce one giant lesson.

It should produce a graph of small, sharp, teachable units — the right granularity for MathAcademy-like lessons.

For example, instead of a huge node like `Recursion`, it should generate smaller units such as:

- Introduction to Recurrence Relations
- First-Order Recurrence Relations
- Linear vs Nonlinear Recurrence Relations
- Homogeneous vs Inhomogeneous Recurrence Relations
- Classifying Recurrence Relations
- Solving Basic Recurrence Classification Problems

These nodes should be sized so each one can later become a tight, focused lesson with:

- a clean explanation
- worked examples
- contrast with nearby concepts
- focused practice

## MathAcademy-like standard

We want lessons to feel MathAcademy-like:

- tight and explicit
- one idea at a time
- concrete worked examples
- careful distinctions between similar concepts
- immediate practice after explanation
- no fluff

This means the graph generator must optimize for **lesson atomicity**, not broad topic coverage.

In other words:

**small, precise, teachable lessons beat large umbrella nodes.**

## Graph structure requirements

The skill tree should not be treated as a linear chain.

It should be a **directed acyclic graph (DAG)**.

That means:

- one lesson can require multiple prerequisites
- one prerequisite can feed several downstream lessons
- advanced lessons may depend on 3 or 4 parallel prerequisites
- problem lessons can depend on concept lessons and on simpler problem lessons

We should anticipate this from the start and not force everything into a single ordered line.

## Concept lessons and problem lessons

There are two valid kinds of lessons in the graph:

### Concept lessons

These teach ideas, distinctions, procedures, or representations.

Examples:

- Introduction to Recurrence Relations
- Order of a Recurrence Relation
- Homogeneous vs Inhomogeneous Recurrence Relations

### Problem lessons

These represent problem families or target performance outcomes.

Examples:

- Solve Basic Recurrence Classification Problems
- Solve Second-Order Homogeneous Recurrence Problems with Distinct Real Roots
- Solve Mixed Recurrence Exam Problems

Problem lessons can build on concept lessons, and more advanced problem lessons can build on simpler problem lessons.

## Why `goalText` matters

`goalText` is not just a summary.

It should provide downstream direction for later lesson generation.

A weak goal text says:

> Learn homogeneous recurrence relations.

A strong goal text says:

> Classify linear recurrence relations as homogeneous or inhomogeneous so the learner can choose the correct solving method later.

That second kind of goal text is much more useful for generating high-quality lessons and for keeping the tree purpose-driven.

## Current product principle

The graph is the backbone.

The custom GPT should first generate the right graph.
Later, it can generate the actual lesson content from that graph.

So the immediate next step is **not** lesson-body generation yet.
The immediate next step is to engineer the custom GPT so it reliably produces the right lesson nodes and prerequisite edges.

## Immediate next step

Design the custom GPT specification so that it:

- breaks broad topics into MathAcademy-sized lessons
- supports both `concept` and `problem` lesson kinds
- writes strong directional `goalText`
- produces a prerequisite DAG rather than a linear list
- outputs the importable `lessons` + `edges` schema consistently