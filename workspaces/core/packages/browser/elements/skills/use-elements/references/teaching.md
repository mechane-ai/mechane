# Teaching layers

For an explorable explanation: an essay whose reader changes values in the prose, watches diagrams move between states,
predicts results and reaches challenges. Five entries work together.

| Entry                               | Holds                                                                                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mechane-ai/elements/lesson`       | `defineLesson`, `Lesson`, `useLesson`, `Param`, `Value`, block controls, `Playback`, `Transport`, `BoundValue`                                                                     |
| `@mechane-ai/elements/scene`        | `Scene` and its parts: nodes, wires, notes, the plane, cards, cells, tokens, flows, morphs                                                                                         |
| `@mechane-ai/elements/article`      | `Article`, `Beat`, `Figure`, `FigureReference`, `Reveal`, `useRevealed`, `Scrolly`, `Predict`, `Challenge`, `Term`, `DiagramPart`, notes, `TeX`, `articleOutline`, `answerSources` |
| `@mechane-ai/elements/mdx`          | `Essay` and `essayComponents`, for one `.mdx` file as the essay                                                                                                                    |
| `@mechane-ai/elements/lesson/spec`  | `validateLessonPlan`, `checkLesson`, `describeLesson`, `lessonWalk`, `explainerGuide`                                                                                              |
| `@mechane-ai/elements/lesson/agent` | `tutorTools`, `createLearnerTrace`, `summarizeTrace`, `playTour`, `validateTour`, `tourFromTrace`                                                                                  |

The ideas, in one breath: one lesson store holds every value the reader, the application or an agent may change; a scene
object with a stable id eases to its new props by itself, so you describe states and never write an animation; an
article renders the same beats as a scrolling essay, a presentation, a static page and a beat sheet.

## Four things a port gets wrong

- `show` and `reset` act on the whole lesson. A figure's Reset button calls `resetBeat(beat)`, which returns only the
  params that beat owns (its `params`, or those its states set) to their opening values.
- A host whose own rail lists the beats holds the beat through `Article`'s `lessonProps` (`beat` and `onBeatChange`) and
  sets `hasContents={false}`, so the page has one contents list.
- A figure's controls go in the article `Figure`'s `header` or `footer`, which frame it. A chart or scene inside keeps
  its title only as its accessible name; the caption is printed, so do not repeat the beat heading in it.
- A card that turns, or a node that acts, when pressed needs no click handler of its own: give the `Scene`
  `selected={null}` and `onSelectedChange={(id) => ...}`. A press, or Enter or Space on the keyboard cursor, calls it
  with the labelled object's id. A face-down `SceneCard` renders only its back, so keep its id free of its rank and
  suit.

## When to switch skills

- Asked to explain a topic, a paper or a result interactively: follow the `plan-lesson` skill before writing a
  component.
- Building or changing the essay: follow the `write-explainer` skill. Start a new one with
  `pnpm exec mechane-elements-catalog --new-essay <directory>`.
- Checking someone's essay: follow the `review-explainer` skill.

## Moved from the explainers kit

`/kits/explainers` no longer exists. `BoundValue` is in `/lesson`; inside a lesson, `<Param name>` replaces it. `Term`,
`DiagramPart` and `FigureReference` are in `/article`. `NumberedFigure` is `Figure`, `StorySteps` is `Scrolly` with
`ScrollyStep`s, and `Explainer` is `Article`, which numbers figures from the markup instead of a `figures` list.

## Name clashes

- `/article` exports `Figure`, a numbered figure around a chart or scene. `/charts/figure` exports another `Figure`,
  which draws a JSON figure spec. Alias one when a file needs both.
