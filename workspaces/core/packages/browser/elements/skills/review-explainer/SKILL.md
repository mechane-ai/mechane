---
name: review-explainer
description:
  Review an explorable essay built with the Elements teaching layers before it ships. Use after writing or changing an
  essay with `@mechane-ai/elements/lesson`, `/scene`, `/article` or `/mdx`, or when asked whether an explainer teaches.
---

# Review an explainer

Review as a learner first and as a programmer second. A passing type check says nothing about whether the reader learns.
Report what you checked, what failed and what you could not check. Run the `review-elements` skill as well for keyboard,
themes and widths in general.

## 1. Open these

- The plan (`plan.json`) and the lesson definition (`defineLesson`): the idea, the beats with their goals, the states.
- The **sheet view** (`?view=sheet` in the essay starter, or `view="sheet"`): every beat at each declared state, and its
  "Checks" list. Read every cell; it is the fastest way to see the whole essay.
- The **static view** (`?view=static`): read it start to end as a reader with no script would.
- The essay itself in the browser, at a desktop width and at 360 pixels, with the pointer and with the keyboard alone.
- From Node, with `@mechane-ai/elements/lesson/spec`: `lessonWalk(lesson, 'en-US')` (the outline as text, each state
  with its derived values written out), `describeLesson(lesson)` and `checkLesson(lesson)`. The `write-explainer`
  skill's tutor reference has the command.

## 2. Does it teach

In order of what matters most to a learner:

1. **One idea.** State the essay's idea in one sentence after reading it. If you cannot, or it differs from the plan's
   `idea`, that is the first finding.
2. **One goal per beat, and its figure answers it.** For each beat, read its goal, then look at its sheet row. The
   states should differ in the way the goal describes. A figure that looks the same in every state does not show the
   point.
3. **The reader acts before being told.** A `Predict` comes before the result it asks about, in the first three beats. A
   `Challenge` asks for something the reader can do with the controls they have, and its hints lead there.
4. **Every control changes something visible,** in the same beat, within the same screen. Move each `Param`, slider and
   point and watch the figure. The sheet's check catches a prose param no figure reads; it does not catch a figure that
   reads a value and barely changes.
5. **Concrete before abstract.** The first beat shows a specific case. A symbol appears only after the reader has seen
   the thing it stands for.
6. **Identity is kept.** Step between states and watch: the same object moves, flips or fades, and is never replaced by
   a look-alike. A `Term` for an object lights it in every figure. A thing has one hue in every figure and sentence.
7. **The static reading teaches.** In the static view each beat still makes its point from its first state, the prose
   and the figure descriptions. Prose that says "watch it move" fails here. The present view opens each beat at that
   same first state, so it must be the right opening picture.
8. **Reduced motion.** Turn it on. Every change lands at once, a `Playback` jumps to its end, and nothing waits.
9. **Honest labels.** Synthetic data is called synthetic. Axes and values carry units. A modelled curve or wire is
   dashed. Numbers in prose are `Value`s, not copies.
10. **Tutor notes.** Every beat has a `goal`; beats that correct a belief have a `misconception`; challenges have
    `hints`. If the essay has a tutor, its `answers` come from `answerSources(articleOutline(beats))`, not a map written
    by hand, so every number `Predict` with an `answerFrom` is in it.
11. **Narrow width.** At 360 pixels the prose and controls fit, and a scene scrolls inside its own frame rather than the
    page.
12. **Keyboard.** Every `Param` takes arrow keys; each scene and chart is one Tab stop whose arrow keys reach every
    labelled object; a draggable `ScenePoint` is its own Tab stop, a slider the arrow keys move; a pressable card turns
    on Enter or Space; in the present view Right, Space and Left move.

## 3. Read the code once

These mean the layers were bypassed. The canonical case is a 7,000-line essay with 29 `useState` hooks in one component,
19 `requestAnimationFrame` loops, 124 hand-placed SVG elements, 196 inline style objects and its prose kept as string
arrays.

```sh
grep -rnE "useState|requestAnimationFrame|setInterval|setTimeout|@keyframes" src
grep -rnE "<(svg|rect|circle|line|path|text|g)[ >]" src
grep -rnE "style=\{\{|#[0-9a-fA-F]{3,6}\b|rgb\(" src
```

- `useState` holding a value the reader changes, a beat index or a step: it belongs in the lesson, where prose, the
  sheet, the address and agents can see it.
- A frame loop, a timer or a keyframe animation for meaning: a scene part or `Playback` does it on the shared clock,
  with reduced motion.
- Hand-placed SVG where a scene part exists: it is not inspectable, not reachable by keyboard and not themed. Only
  `SceneCustom` should hold raw SVG.
- Inline styles and color literals: tones come from `Article` `tones`, layout from the parts.
- Prose as string arrays or numbers in strings: prose is markup with `Param` and `Value`.
- A figure that takes props from its parent, or `Beat`, `Figure` or `Param` inside a custom component: the sheet and the
  outline cannot see them. A nested `Beat`, `Figure`, `Predict` or `Challenge` shows an inline error saying so.
- A `ScenePoint` with an `onMove` that rounds or clamps by hand and calls `set`, or that writes component state:
  `sets={{ x: 'name' }}` writes the param on its step grid and inside its range.
- A card `delay` with an index to deal cards in turn: a `SceneStack`'s `stagger` does it, and moves a lone card at once.
- Conditional mounting (`{isShown && <SceneNode …/>}`) instead of `isShown`: the object pops instead of fading.
- A changing id for the same object, such as an index in a list that reorders.
- A `Figure` without `description` or with `reads` missing names its component reads.

## 4. Report

Lead with the verdict: ready, ready after the listed fixes, or not ready. Then list findings in the order of section 2,
each with the beat id, what a reader experiences, and the fix in one sentence:

```text
Beat "weights": the vote figure looks the same at both states, because the wire weight is clamped to 0.2.
Fix: pass values.heartWeight as the wire's weight, and set weightMax to 1.
```

Give code smells after the teaching findings, with file and line. Say which views, widths and input modes you checked,
and name what you did not: a real screen reader, a touch device, a print.
