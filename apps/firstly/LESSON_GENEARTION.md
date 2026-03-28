# Lesson Generation Direction

Engineer lesson generation as a second-stage pipeline after graph import, not as one giant freeform prompt.

## Current implementation (Firstly app)

- The custom GPT emits a **Markdown** lesson document (see `features/lessons/lesson-gpt-prompt.ts`), not JSON.
- Content is stored in **`lessons.lesson_markdown`** and rendered in the UI with **Markdown + KaTeX** (`features/lessons/components/lesson-markdown.tsx`).
- The database column `structured_lesson_json` may still exist for legacy rows but is no longer edited through the app.
- Longer-term structured storage (`node_lessons`, practice rows, JSON validation) remains a product direction in the sections below.

The custom GPT should take a single lesson node plus a small amount of graph context and produce a **Markdown lesson** that follows the pedagogical constraints below (MathAcademy-like flow, same-form practice, code-verified math). The generator should optimize for:

- tight instructional flow
- small lesson scope
- immediate worked-example scaffolding
- same-form follow-up questions
- deterministic answer checking

The right architecture is:

1. Graph generation remains separate from lesson generation.
2. One lesson node in, one lesson document out (Markdown in the shipped app).
3. Explanations and worked-example narration may be GPT-authored.
4. Math answers, distractors, and correctness must be generated or verified by code.
5. Firstly renders and validates; the model is not the final source of truth.

This preserves the product principle already captured in `AI_IMPORT_DIRECTION.md`: the graph is the backbone.

## External reference model

The target lesson feel should learn from the public pedagogy and lesson structure described by:

- Math Academy: worked-example-first knowledge points, immediate similar follow-up questions, mastery before progression, very fine-grained scaffolding, minimized cognitive load
- PhysicsGraph: focused 5-15 minute lessons, explanation followed quickly by example and 2-3 practice questions, one new thing at a time, strong preparation through prerequisites

We should not model lessons as textbook sections. We should model them as compact learning units with explicit scaffolding.

## Core lesson principle

The critical rule is:

**Questions immediately after a worked example must have the same form as the worked example.**

That means:

- the same underlying problem family
- the same decision procedure
- the same answer modality
- the same structural template
- only the numbers, labels, notation choices, or surface scenario should change

For word problems, the scenario may change, but the mathematical structure and solving method must stay the same.

The learner should be able to look at the worked example, then solve the next 2-3 questions by following the same pattern.

This is the correct interpretation of "MathAcademy-like" for Firstly:

- do not use the worked example merely as inspiration
- do not follow it with loosely related practice
- do not introduce a new form immediately after the example

The first practice questions after an example are not for transfer. They are for scaffolded replication.

## Multiple-choice requirement

All lesson-practice questions in v1 should be multiple choice with exactly five options.

Required rules:

- every practice item uses `format: "multiple_choice"`
- every practice item has exactly 5 options
- exactly 1 option is correct
- distractors must be unique
- distractors must be plausible for the exact problem family
- the correct option must be computable and verifiable outside the model

This should be treated as a product constraint, not a prompt preference.

## Why code must be the source of truth

For math, the model should not be trusted as the final solver.

The model can:

- identify the pedagogical family
- propose the explanation
- propose wording
- propose the scenario for a word problem
- propose solution narration

But code must:

- compute the canonical answer
- validate that the problem instance matches the declared family
- validate that the worked solution agrees with the answer
- validate that the distractors are distinct and non-broken
- validate that the question truly has the same form as the worked example

The product should prefer:

**LLM for exposition, code for truth.**

## Why this is the right design

If we let the model write one monolithic lesson body, we will get:

- drift in problem type
- weak alignment between examples and questions
- bad distractors
- occasional wrong arithmetic or algebra
- unstable imports
- too much prose

Structured JSON with family-based validation is the right v1 target because it lets Firstly:

- validate lesson shape
- reject malformed outputs
- reject mathematically inconsistent content
- guarantee a tight lesson cadence
- later regenerate or remix content without losing structure

## Recommended lesson shape

Do not structure a lesson as:

- one long introduction
- one or two examples
- one large pool of mixed practice

Instead, structure a lesson as repeated micro-stages.

Each micro-stage should look like:

1. Explanation
2. Worked example
3. 2-3 same-form multiple-choice questions

Then the lesson may move to the next nearby variation and repeat the same pattern.

This is the correct lesson rhythm for v1.

## Micro-stage rules

Each micro-stage should teach or rehearse exactly one narrow maneuver.

Allowed progression inside a lesson:

- base case or simplest form
- same method with a constant factor
- same method with an added constant term
- same method in a lightly reworded scenario

Not allowed inside the immediate follow-up block:

- switching to a different solving method
- requiring a new identity or theorem
- introducing an unseen representation
- broad cumulative review
- changing from direct computation to proof

The local rule is:

**Near transfer first, broader transfer later.**

## Example from finite linear series

For a lesson like finite linear series, the structure should be:

1. Explanation of `\sum_{n=1}^N n = \frac{1}{2}N(N+1)`
2. Worked example: compute `\sum_{n=1}^{100} n`
3. 2-3 questions of the exact same form:
   - only `N` changes
4. Explanation of constant-factor variant
5. Worked example: compute `\sum_{n=1}^{100} 4n`
6. 2-3 questions of the exact same form:
   - only coefficient and bounds change
7. Explanation of linear-expression variant
8. Worked example: compute `\sum_{n=1}^{200} (3n + 2)`
9. 2-3 questions of the exact same form:
   - only coefficients, signs, and bounds change

That is the pattern we want the generator to learn.

## Proposed lesson-generation contract

For each lesson node, the generator should receive:

- title
- goalText
- kind (`concept` or `problem`)
- prerequisite lesson summaries
- immediate downstream lesson summaries
- subject metadata
- optional difficulty target

The generator should return a strict JSON document such as:

```json
{
  "lesson": {
    "title": "Finite Linear Series",
    "goal": "Evaluate finite linear series by decomposing them into standard summation forms.",
    "kind": "concept"
  },
  "stages": [
    {
      "stageKey": "sum_first_n_integers",
      "teachingFocus": "Use the closed form for the sum of the first N integers.",
      "familyKey": "finite_linear_series_sum_n_mcq_v1",
      "explanation": {
        "blocks": [
          {
            "kind": "explanation",
            "content": "..."
          }
        ]
      },
      "workedExample": {
        "familyKey": "finite_linear_series_sum_n_mcq_v1",
        "problem": {
          "prompt": "Calculate \\sum_{n=1}^{100} n."
        },
        "steps": [
          {
            "kind": "reasoning",
            "content": "Use \\sum_{n=1}^{N} n = \\frac{1}{2}N(N+1) with N = 100."
          },
          {
            "kind": "result",
            "content": "5050"
          }
        ],
        "templateSpec": {
          "operation": "sum_n",
          "parameterSlots": ["N"]
        }
      },
      "practice": [
        {
          "familyKey": "finite_linear_series_sum_n_mcq_v1",
          "derivedFromWorkedExample": true,
          "prompt": "\\sum_{n=1}^{50} n =",
          "format": "multiple_choice",
          "options": ["1245", "2275", "1275", "1075", "1255"],
          "answer": {
            "correctIndex": 2
          },
          "validatorSpec": {
            "operation": "sum_n",
            "N": 50
          }
        }
      ]
    }
  ],
  "progression": {
    "blocks": [
      {
        "kind": "bridge",
        "content": "Next we keep the same summation idea but handle linear expressions like an + b."
      }
    ]
  },
  "metadata": {
    "lessonScope": "micro_cluster",
    "estimatedMinutes": 10
  }
}
```

## Required schema ideas

The schema should explicitly encode same-form alignment.

Minimum required fields:

- `familyKey`
- `derivedFromWorkedExample`
- `templateSpec`
- `validatorSpec`
- `format`
- `options`
- `answer.correctIndex`

Recommended meaning:

- `familyKey`: canonical problem family
- `derivedFromWorkedExample`: must be `true` for the immediate follow-up block
- `templateSpec`: structural description of the maneuver used in the worked example
- `validatorSpec`: parameter values needed for code to compute the canonical answer

## Same-form validation requirement

Firstly should reject practice items that do not match the worked-example family.

Validation must check:

1. The practice item and worked example share the same `familyKey`.
2. The same symbolic structure is used.
3. Only allowed parameter slots vary.
4. The solution path is the same at the family level.
5. The answer format is unchanged.

Examples:

- allowed: `\sum_{n=1}^{100} n` -> `\sum_{n=1}^{50} n`
- allowed: `3n + 2` -> `8n - 14`
- allowed: a rectangle-area word problem -> a differently worded rectangle-area problem with the same algebraic setup
- not allowed: sum of `n` -> sum of `n^2`
- not allowed: direct arithmetic progression evaluation -> derivation/proof task
- not allowed: one-step substitution -> conceptual classification question

## Content-engineering principles

The lesson generator prompt/spec should enforce these rules:

1. Teach only what this node is responsible for.
   Use prerequisites as assumed knowledge, not content to reteach.

2. Keep each stage extremely tight.
   One stage should correspond to one narrow maneuver.

3. Use explicit mathematical reasoning.
   Worked examples should show why each step is correct, not just state the answer.

4. Practice should vary surface form, not underlying structure.
   Immediate practice is for reproducing the maneuver, not discovering a new one.

5. Progression should bridge, not sprawl.
   Move only to the next nearby variation.

6. No fluff, motivational filler, or conversational tutoring tone.
   Lessons should read like precise instructional material.

7. Every statement should be renderable and auditable.
   Avoid ambiguous freeform structures that cannot be validated later.

## Two-prompt generation strategy

Use two prompt shapes instead of one universal prompt.

### 1. Concept lesson generator

Use for nodes whose job is to teach a concept, distinction, identity, or narrow procedure.

It should produce:

- compact explanation blocks
- one worked example per stage
- 2-3 same-form multiple-choice questions after each example
- a short progression bridge

### 2. Problem lesson generator

Use for nodes whose job is a performance outcome or problem family.

It should produce:

- a short recap of the decision procedure
- worked problem solutions with explicit strategy selection
- repeated same-form practice blocks
- less exposition, more solve-check-compare structure

This separation matters because "teach the formula" and "apply the formula in a standard family of problems" are different instructional jobs.

## Practice-generation design

Practice should be family-based and code-checked in v1.

Recommended flow:

1. GPT outputs a practice blueprint, not just final prose.
2. Each practice item includes:
   - `familyKey`
   - parameter choices
   - `templateSpec`
   - expected answer shape
   - worked solution explanation
   - `validatorSpec`
3. Firstly validates that:
   - the item matches the declared family
   - the item matches the worked-example form
   - the answer is internally consistent
   - the solution agrees with the canonical answer
   - all 5 options are distinct
   - distractors are plausible for the family

In other words, GPT proposes the pedagogical form, but correctness is checked outside the model.

## Distractor design

Distractors should not be random.

They should come from family-specific error models such as:

- arithmetic slips
- sign errors
- dropped factors
- off-by-one mistakes
- incorrect substitution into a correct formula
- forgetting to distribute a constant

This is important because plausible distractors reinforce recognition of the exact procedure.

## Recommended internal representation

Current schema in `SCHEMA.md` has:

- `node_lessons.intro_markdown`
- `node_lessons.worked_example_markdown`
- `node_lessons.progression_markdown`
- `practice_problems` as separate rows

That is directionally good, but the generator should target a richer internal representation before flattening.

Recommended internal representation:

- `lesson_outline`
- `stages[]`
- `stages[].explanation`
- `stages[].workedExample`
- `stages[].practice[]`
- `progression_blocks[]`
- `generator_metadata`

Then, if needed for v1 persistence, we can map that into the current tables by:

- concatenating explanation blocks into `intro_markdown`
- concatenating worked examples into `worked_example_markdown`
- storing the bridge in `progression_markdown`
- inserting each validated practice item into `practice_problems`

This keeps the generation format future-friendly without requiring the UI schema to be solved immediately.

## Prompt spec the custom GPT should follow

The custom GPT should be instructed to do all of the following:

- infer the single teaching objective of the node from `title` plus `goalText`
- identify prerequisite knowledge that can be assumed
- avoid reteaching upstream nodes unless absolutely necessary
- produce a lesson as repeated micro-stages
- ensure every worked example is followed by 2-3 same-form practice questions
- make every practice question multiple choice with exactly 5 options
- ensure examples and questions are original, not copied from source inspiration
- use notation consistently across the lesson
- include sufficient steps for a college STEM learner
- keep each section compact and mathematically exact

The generator should also be told what not to do:

- no giant essay introductions
- no repeated definitions across stages
- no practice questions that require unseen techniques
- no progression into downstream lessons' responsibilities
- no drift from the worked-example family in immediate follow-up questions
- no freeform math answers that are not code-verifiable

## Generation pipeline recommendation

Design the system as these stages:

1. Node selection
   Pick one lesson node to generate.

2. Context packaging
   Build a small prompt context containing:
   - current node
   - prerequisite node titles/goals
   - downstream node titles/goals
   - lesson style rules
   - family constraints

3. Lesson outline pass
   Ask the model for a compact structured outline:
   - teaching objective
   - stage plan
   - worked-example families
   - allowed parameter variation
   - explicit exclusions

4. Lesson body pass
   Generate the full structured lesson JSON from the approved outline format.

5. Validation pass
   Check:
   - required fields present
   - every practice item is multiple choice with 5 options
   - every immediate follow-up item matches the worked-example family
   - answers and solutions are internally consistent
   - output maps cleanly into storage and rendering

6. Persistence and render mapping
   Convert the validated lesson JSON into `node_lessons` plus `practice_problems`.

The outline pass is important because it reduces the chance that the model quietly makes the lesson too broad.

## Quality rubric for lesson generation

Use a rubric to evaluate generated lessons before accepting them:

- Scope discipline: does the lesson stay within the node's responsibility?
- Clarity: are explanations concise and explicit?
- Mathematical correctness: are reasoning and answers consistent with code?
- Example quality: does each worked example reveal the exact procedure?
- Practice alignment: do the immediate questions have the same form as the worked example?
- Distractor quality: are wrong answers plausible and non-duplicate?
- Progression quality: does the bridge lead naturally to the next nearby variation?
- Atomicity: does the lesson feel like a compact knowledge-point sequence rather than a textbook section?

If a lesson fails this rubric, regenerate with targeted feedback rather than accepting mediocre output.

## Immediate product recommendation

Markdown lesson storage and rendering in Firstly are in place (`lesson_markdown` + KaTeX). Next milestones for stronger guarantees:

1. define the lesson JSON schema around `stages[]` (if/when you need machine validation beyond Markdown)
2. define family keys and template specs for the first practice families
3. define the concept prompt and problem prompt
4. build a validator that enforces same-form practice and 5-option MCQ shape (when practice is structured)
5. implement code-first canonical answer generation in the product pipeline
6. map validated JSON into `node_lessons` / `practice_problems` when that schema is wired

That sequencing gives us a controllable spine before we scale content generation.

## Critical files to read before implementation

- `AI_IMPORT_DIRECTION.md`
- `PRD.md` (especially lesson cadence and product boundary)
- `SCHEMA.md` (especially `node_lessons` and `practice_problems`)
- `features/sessions/skill-tree-import-actions.ts`
- `features/sessions/components/session-skill-tree-import-dialog.tsx`
- `features/sessions/components/session-text-panel.tsx`
- `features/lessons/queries.ts`
- `features/lessons/actions.ts`
- `app/(app)/sessions/[sessionId]/page.tsx`
