---
name: write-explainer
description:
  Write an explorable explanation with the Elements teaching layers from a validated lesson plan. Use when building or
  changing an interactive essay, a lesson, a scene diagram or an MDX essay with `@mechane-ai/elements`.
---

# Write an explainer

Start from a lesson plan that `validateLessonPlan` accepts. If there is none, follow the `plan-lesson` skill first.

The layers do the work a hand-written essay repeats: one lesson store holds every value, one clock moves everything,
scenes ease between states, and the article arranges the same children as an essay, a presentation, a static page and a
beat sheet. You describe states. You never write an animation.

## Set up

For a new essay, scaffold the starter and run it:

```sh
pnpm exec mechane-elements-catalog --new-essay my-essay
cd my-essay && pnpm install && pnpm dev
```

It holds `plan.json`, `src/lesson.ts` (the lesson), `src/figures.tsx` (the figures), `src/essay.mdx` (the prose) and
`src/main.tsx`, which renders the essay with a "Lesson checks" list under it. In an existing application, import
`@mechane-ai/elements/styles.css` once and render an `Article` in TSX, or an `Essay` for an MDX file.

## The procedure

1. **Define the lesson.** Copy the plan's params and beats into `defineLesson` in its own file, and write each derived
   value's `from` as a pure function. Every component imports this one definition.
2. **Write one beat at a time,** in plan order. For each beat:
   - prose with `<Param name>` where the reader changes a value and `<Value name>` where they read one;
   - its figure: a component that reads `useLesson(lesson)` and draws a chart or a `Scene`, wrapped in
     `<Figure id caption description reads>`;
   - its ask: `Predict` before the result, or `Challenge` once the reader has the controls;
   - `Playback` with a `Transport` for anything that unfolds in time, and `Term` for words that name a figure's object.
3. **Look at the beat sheet after every beat.** Open the `sheet` view (`/?view=sheet` in the starter). It draws every
   beat at each declared state, read-only, with a "Checks" list. It is your eyes: if a state looks the same as another,
   the figure does not show the beat's point. Fix every check before the next beat.
4. **Read the static view** (`/?view=static`). Every beat opens at its first state with each figure's description after
   it. If the essay does not teach there, the prose leans on motion.
5. **Run the checks.** `checkLesson(lesson)` from `@mechane-ai/elements/lesson/spec` must return no findings you have
   not decided to keep. Then review with the `review-explainer` skill.

[The worked essay](references/worked-essay.md) is a complete essay built this way, type checked against the package. The
package ships a second, larger one as a recipe: `pnpm exec mechane-elements-catalog counting cards` prints its path
(`recipes/counting-cards.tsx`) and its Storybook story (`Recipes/Counting Cards`). It deals a deck with `SceneStack`
stagger, reveals with `useRevealed` and morphs cards into bars; its story builds the tutor `answers` with
`answerSources`.

## Choose the part by the reader's question

Take the part from `explainerGuide` (in `@mechane-ai/elements/lesson/spec`), whose examples compile. Do not invent one.

| The reader asks                                               | Part                                         |
| ------------------------------------------------------------- | -------------------------------------------- |
| What happens if I change this number in the sentence?         | `Param`                                      |
| What is the result right now?                                 | `Value`                                      |
| How does the figure change as I sweep this value?             | `ParamSlider`, `ParamChoice`, `ParamToggle`  |
| How does this unfold over time? Can I pause it?               | `Playback` with `Transport`                  |
| How are these parts connected, and what moves?                | `Scene`, `SceneNode`, `SceneWire`            |
| What does this run of things add up to? Why does it matter?   | `SceneGroup`, `SceneBracket`, `SceneCallout` |
| Where should I look now?                                      | `SceneHighlight`, or the scene's `focus`     |
| What is the shape of this function? What if I move the point? | `SceneAxes`, `SceneCurve`, `ScenePoint`      |
| Which way does this push? Where is the threshold?             | `SceneVector`, `SceneRule`, `SceneRegion`    |
| What is on the other side, and which comes first?             | `SceneCard`, `SceneStack`, `SceneSlot`       |
| What is inside this vector or matrix?                         | `SceneCells`                                 |
| How is this text split into tokens?                           | `SceneTokens`, `SceneToken`                  |
| How is this result computed from what I can change?           | `LessonFlow`, `SceneFlow`                    |
| Is this the same thing, now shown as data?                    | `MorphScope`                                 |
| How does the picture change as I read on?                     | `Scrolly` with `ScrollyStep`                 |
| What do I expect before I see it? Can I make it do this?      | `Predict`, `Challenge`                       |
| Which part of the figure does this word mean?                 | `Term`                                       |
| A trend, a distribution, a comparison of measured data        | a chart, chosen from `chartGuide`            |

## Rules, and why

- **No `useState` for what the lesson holds.** A value in component state is invisible to the prose, the sheet, the URL,
  storage and agents. Read it with `useLesson(lesson)` and change it with `set`. A draggable `ScenePoint` writes its
  params through `sets`, which keeps them on their step grid and inside their range; do not round in a handler.
- **No `requestAnimationFrame`, timer or CSS keyframe for motion.** Change a part's props and it eases on the shared
  clock, which also gives reduced motion its end state. Drive time with `Playback`.
- **No hand-placed SVG where a scene part exists.** Parts are inspectable, keyboard-reachable and themed. Draw what no
  part draws with `SceneCustom`, which hands you the scene's scales and tones.
- **Stable ids name things, not slots.** The Queen of Hearts is `queen-hearts` in every state and figure, so it moves
  instead of being replaced, and a `Term` lights it everywhere. Swap the id only when the thing itself changes.
- **Write `Beat`, `Figure`, `Param`, `Playback`, `Transport`, `Predict` and `Challenge` directly in the article's
  children.** The article reads that markup to build the outline, the sheet and its checks. It does not render your own
  components to look inside them. A `Beat`, `Figure`, `Predict` or `Challenge` inside one shows an inline error in the
  page:
  `… sits inside a component of your own, so the outline, the beat sheet and the tutor miss it. Write it directly in the Article's children.`
  Plain elements and fragments are fine.
- **Give every `Figure` a `description` and its `reads`.** The description is the static view and the screen reader.
  `reads` lists the lesson names your figure component reads, which the markup cannot show.
- **A figure takes no props from its parent.** The sheet renders each figure alone under a read-only lesson at each
  state, so everything it shows must come from `useLesson`.
- **Declare tones once** on `Article` with `tones`, by the ids the figures use. Never write a color.
- **Prose never copies a number.** Write `<Value name="sum" />`, so the sentence agrees with the figure.
- **Say synthetic data is synthetic,** in the summary or a figure's description.
- **Ids of figures differ from beat ids.** Beats, figures, footnotes and references all become element ids in the page,
  and the checks name any two parts that share one.

## References

- [Lesson](references/lesson.md): `defineLesson`, `Lesson`, `useLesson`, prose controls, `Playback` and `Transport`.
- [Scene](references/scene.md): the box, nodes, wires, notes, the camera, `SceneCustom`.
- [Scene parts](references/scene-parts.md): the plane, cards, cells, tokens, `SceneFlow`, `MorphScope`.
- [Article and views](references/article.md): beats, figures, asks, notes, math, the four views and their checks.
- [MDX](references/mdx.md): one `.mdx` file as the essay.
- [Tutor](references/tutor.md): tutor tools, the learner trace and tours.
