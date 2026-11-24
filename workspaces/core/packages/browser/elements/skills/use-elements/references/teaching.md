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
