---
name: plan-lesson
description:
  Plan an explorable explanation before writing any component. Use when asked to explain a topic, a paper or a research
  result as an interactive essay with `@mechane-ai/elements`, or before changing the beats of an existing lesson.
---

# Plan a lesson

An explorable essay is an argument the reader takes part in, not a tour of a model's features. Write the argument as a
`LessonPlan` first: plain JSON that names the one idea, the values the reader holds, and the beats. Check it with
`validateLessonPlan`, and write components only once it has no errors. Then follow the `write-explainer` skill.

The plan is cheap to change. A beat cut here saves a figure, its prose and its states later.

## The procedure

1. **Find the one idea.** Write the sentence the reader should be able to say afterwards, with its mechanism: "Each step
   multiplies the loss by (1 − 2 × rate)², so it falls for rates under 1 and grows past it." A topic ("learning rates")
   or a list ("rates, momentum and schedules") is not an idea. If the source has three ideas, plan three essays.
2. **Name the reader.** `audience` says who reads it and what they already know. Every beat builds only on that and on
   the beats before it.
3. **Choose the params.** A param is a value the reader holds and changes: a number with its range, step and format, a
   choice of two to five options, or a toggle. Keep two to five. Each must change something the reader can see. A value
   the reader only reads is a derived value, not a param.
4. **Name the derived values.** Each derived value lists the names it `reads` and its `formula` in words. Declare them
   in computing order: a derived value reads params and derived values declared above it.
5. **Cut the beats.** One beat is one step of the argument: one `goal` sentence the reader can say after it, the
   `misconception` it corrects, and at most one new param. Start concrete: a specific hand of cards, one token, one
   weight. Generalise in a later beat. Add a beat titled "Recap" after every seven.
6. **Pick one figure per beat by its question.** Write the reader's question first ("How much does each card count
   toward the sum?"), then choose the part whose `question` in `explainerGuide` matches, or a chart from `chartGuide`.
   `shows` lists the params and derived values the figure draws. Never invent a part name.
7. **Decide where the reader acts.** Put a `predict` ask before a result the reader could guess wrong, in one of the
   first three beats. Put a `challenge` ask after the reader has the tool to reach it. The reader's own action should
   cause each change the beat is about.
8. **Declare the states worth seeing.** Each beat's `states` set params to show the beat's point. Order them: the first
   state is the beat's opening picture, which the static view prints and the present view opens at each time the
   presenter reaches the beat. The beat sheet draws every state. A beat that introduces a param has a state that moves
   it.
9. **Validate and fix.** Run the validator below. Fix every error, then read every advice and either follow it or state
   in one sentence why the plan declines it.

Read [the plan format](references/plan-format.md) for each field and the validator's messages, and
[a worked plan](references/worked-plan.md) for a complete plan with the reasons behind each choice.

## Check the plan

In the essay starter, `src/main.tsx` lists every finding of `plan.json` under the essay as "Lesson checks". From any
directory where `@mechane-ai/elements` is installed, run the validator in Node:

```sh
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { validateLessonPlan } from '@mechane-ai/elements/lesson/spec';
const { isValid, findings } = validateLessonPlan(JSON.parse(readFileSync('plan.json', 'utf8')));
for (const finding of findings) console.log(finding.severity, finding.path, finding.message);
console.log(isValid ? 'valid' : 'invalid');
process.exitCode = isValid ? 0 : 1;
"
```

Each finding has a `severity`, a `path` such as `beats[2].states[0].values.rate`, and a sentence that says what to do.
An `error` is something `defineLesson` would refuse. An `advice` is teaching practice. The plan is valid when no finding
is an error.

## A good plan

- The `idea` is one sentence with a mechanism, and the last beat's `goal` restates it.
- Every beat has a goal, a figure whose question the goal answers, and a state for each param it introduces.
- The reader commits to a prediction before the first surprise, and reaches a challenge with their own hands.
- Every param appears in some figure's `shows` or in a derived value's `reads`.
- The beats read as a chain: each goal needs the one before it.

## Failure modes

| The plan                                      | Why it fails                                        | Fix                                                 |
| --------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Beats named after parts of a model or a paper | A tour of features has no argument to follow        | Rewrite each title as a claim the beat demonstrates |
| A param no figure shows                       | The reader moves a control and nothing answers      | Add it to a figure's `shows`, or remove it          |
| Three params introduced in the first beat     | The reader cannot tell which change did what        | One new param per beat                              |
| A figure for every paragraph                  | Each figure costs attention; most repeat the last   | One figure per beat; reuse it across states         |
| No `predict` in the first three beats         | The reader watches instead of thinking              | Ask before the first result they could get wrong    |
| An abstract first beat: "Let x be an input"   | Nothing to hold on to                               | Start with one concrete case, then generalise       |
| States that set derived values                | Derived values follow the params; the plan is wrong | Set the params that produce the value               |
| Synthetic numbers presented as measurements   | The reader trusts a fiction                         | Say "synthetic" in the audience-facing text         |
