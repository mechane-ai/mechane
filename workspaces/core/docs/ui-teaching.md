# Teaching

`@mechane-ai/elements/lesson` holds a lesson: named values, controls in prose, players and one shared clock. Import the
rest from its entry: `/scene` for diagrams, `/article` for essays, `/mdx` for an essay in one MDX file, `/lesson/spec`
for plans, checks and the part guide, and `/lesson/agent` for tutor tools, the learner trace and tours. Import the
package CSS once, as the [component guide](components.md) describes.

Applications own what a lesson says, its numbers, where progress is saved beyond local storage, the math typesetter and
the MDX compiler. Elements owns the lesson store, the motion, the diagram geometry, the essay structure and the agent
tools. The rules are [contract 142](../.contracts/142-ui-teaching-layers/CONTRACT.md). Diagrams draw on the plot kernel
under [contract 140](../.contracts/140-ui-data-display/CONTRACT.md), so [charts](ui-charts.md) and scenes share tones,
readout and the keyboard cursor.

## Entries

Each entry's `index.ts` is its public entry and lists everything an application may use. The `lesson` primitive itself
is not exported: parts reach it through `Lesson`, `useLesson` and `useLessonContext`.

| Entry           | Exports                                                                                                                                                                                                                                                                | Use                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/lesson`       | `defineLesson`, `lessonGraph`, `Lesson`, `useLesson`, `useLessonContext`, `Param`, `Value`, `ParamSlider`, `ParamChoice`, `ParamToggle`, `BoundValue`, `Playback`, `usePlayback`, `Transport`, `createTween`, `useTween`, `onFrame`, `isMotionReduced`, `LessonLocale` | Declare the values, show them in prose, move them with controls and players.      |
| `/scene`        | `Scene` and its parts, `useSceneObject`, `useObstacle`, the geometry helpers                                                                                                                                                                                           | Draw a diagram whose objects keep their identity.                                 |
| `/article`      | `Article`, `Beat`, `Figure`, `FigureReference`, `Reveal`, `Scrolly`, `Predict`, `Challenge`, `Aside`, `Footnote`, `Cite`, `References`, `TeX`, `Term`, `DiagramPart`, `articleOutline`, `answerSources`, `articleChecks`                                               | Arrange beats of prose and figures, with exercises and notes.                     |
| `/mdx`          | `Essay`, `essayComponents`                                                                                                                                                                                                                                             | Write the essay as one MDX file.                                                  |
| `/lesson/spec`  | `validateLessonPlan`, `checkLesson`, `describeLesson`, `lessonWalk`, `writtenValue`, `valueProblem`, `explainerGuide`, `explainerParts`                                                                                                                                | Check a plan or a lesson as data, and choose parts. Runs in Node and the browser. |
| `/lesson/agent` | `tutorTools`, `createLearnerTrace`, `summarizeTrace`, `LEARNER_TRACE_LIMIT`, `playTour`, `validateTour`, `tourFromTrace`, `tourHolds`                                                                                                                                  | Let a tutor model read and move a lesson, and record what the reader did.         |

## Choose a part

This section is the library's own `explainerGuide`, as a table. Each entry has `part`, `entry`, `question`, `guidance`
and a short `example`. The `question` is what the reader asks. Read `guidance` for when to use the part and which part
to use instead. `explainerGuide` and `explainerParts` are exported from `@mechane-ai/elements/lesson/spec`, so an agent
reads the same guide at run time.

### `/lesson`

| Part          | The reader asks                                                                              |
| ------------- | -------------------------------------------------------------------------------------------- |
| `Lesson`      | Which values does this explainer let me change, and do the words and pictures agree on them? |
| `Param`       | What happens if I change this number in the sentence?                                        |
| `Value`       | What is the result right now?                                                                |
| `ParamSlider` | How does the figure change as I sweep this value?                                            |
| `ParamChoice` | What if it were this option instead of that one?                                             |
| `ParamToggle` | What changes when I turn this on?                                                            |
| `Playback`    | How does this unfold over time?                                                              |
| `Transport`   | Can I pause it, step through it, or go back?                                                 |

### `/scene`

| Part              | The reader asks                                                     |
| ----------------- | ------------------------------------------------------------------- |
| `Scene`           | How are these parts connected, and what moves when a value changes? |
| `SceneNode`       | What is this thing, and where did it go?                            |
| `SceneWire`       | What feeds into what, and how strongly?                             |
| `SceneGroup`      | Which of these belong together?                                     |
| `SceneBracket`    | What does this run of things add up to?                             |
| `SceneCallout`    | Why does this part matter?                                          |
| `SceneHighlight`  | Where should I look now?                                            |
| `SceneCustom`     | What does this shape look like, when no scene part draws it?        |
| `SceneAxes`       | What do the positions in this picture measure?                      |
| `SceneCurve`      | What is the shape of this function?                                 |
| `ScenePoint`      | Where is this one value on the plane, and what if I move it?        |
| `SceneVector`     | Which way does this push, and how far?                              |
| `SceneProjection` | What are this point’s values on each axis?                          |
| `SceneRegion`     | Which part of the plane is this?                                    |
| `SceneRule`       | Where is the threshold?                                             |
| `SceneCard`       | What is on the other side of this, and which comes first?           |
| `SceneStack`      | How are these cards laid out together?                              |
| `SceneSlot`       | Where does this go?                                                 |
| `SceneCells`      | What is inside this vector or matrix, cell by cell?                 |
| `SceneToken`      | Which piece of text is this, and where does it go?                  |
| `SceneTokens`     | How is this text split into tokens?                                 |
| `SceneFlow`       | How is this result computed from the values I can change?           |
| `LessonFlow`      | Which values does this result depend on?                            |
| `MorphScope`      | Is this the same thing I saw in the diagram, now shown as data?     |

### `/article`

| Part              | The reader asks                                         |
| ----------------- | ------------------------------------------------------- |
| `Article`         | What is this essay about, and where am I in it?         |
| `Beat`            | What is this section trying to show me?                 |
| `Figure`          | What am I looking at here?                              |
| `FigureReference` | Which figure is this sentence talking about?            |
| `Reveal`          | What comes next, once I am ready?                       |
| `Scrolly`         | How does the picture change as I read on?               |
| `Predict`         | What do I expect to happen before I see it?             |
| `Challenge`       | Can I make it do this myself?                           |
| `Aside`           | Is there more to this, if I want it?                    |
| `Footnote`        | Where does this claim come from, or what is the caveat? |
| `Cite`            | Who showed this first?                                  |
| `References`      | Where can I read more?                                  |
| `TeX`             | What is the exact formula?                              |
| `Term`            | Which part of the figure does this word mean?           |
| `DiagramPart`     | Which record of the chart is this part of the drawing?  |

## The lesson

`defineLesson` takes `{ id, title, params, derived?, beats? }` and returns a `LessonDefinition`. It throws an `Error`
that names the problem when a param's default is out of range, a name is declared twice, a derived value reads a name
that is not a param or an earlier derived value, a derived function does not return a number, or a beat state names an
undeclared param.

| Declared     | Fields                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Number param | `kind: 'number'`, `label`, `value`, `min`, `max`, `step`, `format` (`Intl` options or a function), optional `scale: 'linear' \| 'log'`.                                                                                   |
| Choice param | `kind: 'choice'`, `label`, `value` (an option id), `options` of `{ id, label }`.                                                                                                                                          |
| Toggle param | `kind: 'toggle'`, `label`, `value` (a boolean).                                                                                                                                                                           |
| Derived      | `label`, `format`, and `from`, a pure function of the params and the derived values declared before it.                                                                                                                   |
| Beat         | `id`, `title`, optional `goal`, `misconception`, `hints` (tutor notes, never shown to the reader), `steps` (reveal steps after the first view), `states`, `params` (the params it owns; by default those its states set). |
| State        | `id`, `label` and `values`, the params it sets. Plain data.                                                                                                                                                               |

The definition also holds `defaults`, `initial` (every value at the opening), `compute` and `reads`, the names each
derived value reads, found by running it over the defaults and every beat state. `lessonGraph(lesson)` returns those
reads as nodes and edges.

`Lesson` takes the `lesson`, a required `locale` and the state it holds:

| Props                                       | Use                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `values`, `defaultValues`, `onValuesChange` | Hold the param values in the application, or let the lesson hold them.            |
| `beat`, `defaultBeat`, `onBeatChange`       | The current beat id.                                                              |
| `step`, `defaultStep`, `onStepChange`       | The reveal step inside the beat, from 0.                                          |
| `onPlayingChange`                           | Hears a player start (the param name) or stop (`null`), and who asked.            |
| `shouldSyncUrl`, `storageKey`               | Keep the values in the address bar, or in local storage under a key.              |
| `isReadOnly`                                | A frozen copy: controls are disabled, and no change, agent action or player runs. |

Each change callback gets `details` with a `reason`, the `event`, the `source` and `cancel()`. The application can
refuse a change. Values changes carry reasons such as `drag`, `step-key`, `playback`, `shortcut`, `reset`, `restore` and
`imperative`. A name the lesson does not declare, a value outside a param's range or options, or an unknown beat shows a
short inline error in place of the part. A lesson with bad props renders its error and not its children. Nothing throws
during render and nothing is drawn as a guess. The calls `set`, `setMany` and the agent actions throw an `Error` that
names the param and its bounds.

### Parts in prose and under figures

| Part                                        | Does                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Param name`                                | A param in a sentence the reader changes in place: a number to drag or step, a picked option, or a switch.   |
| `Value name labels?`                        | A param or derived value written in its declared format. Assistive technology hears it once it has rested.   |
| `ParamSlider`, `ParamChoice`, `ParamToggle` | A labelled control for a param of that kind, under a figure. Each takes `name`.                              |
| `BoundValue`                                | The number control inside `Param`, usable alone: `min`, `max`, `step`, `scale`, `locale`, `format`, `label`. |
| `Playback name from? to? pace? isLooping?`  | Drives a number param one step at a time. It renders nothing.                                                |
| `Transport for labels?`                     | Play or pause, step back, step forward, a scrub slider and the value, for the `Playback` of a param.         |
| `useLesson(lesson)`                         | Typed `values`, `set`, `setMany`, `show`, `reset`, `resetBeat`, `beat`, `step`, `goTo`, `next`, `previous`.  |
| `useLessonContext()`                        | The same, untyped, for a part that works in any lesson.                                                      |
| `usePlayback(name)`                         | `isPlaying`, `play`, `pause`, `toggle`, `stepBy` and `seek`, for a custom transport.                         |

`pace` is `'fast'` (12 steps a second), `'regular'` (6) or `'slow'` (2); `playbackPaces` holds the numbers. A pace can
also be a timed run, `{ run, isEased? }`: `run` is `'short'`, `'regular'` or `'long'` (2, 5 or 10 seconds for the whole
range, from `playbackRuns`), so a 320-step training run and a 10-step one take the same time. `isEased` starts the run
fast and settles it on the tween curve. A run started part of the way along takes its share of the time. Both kinds move
on the one clock, land on the param's step grid and report the reason `playback`. A player stops at its end, or starts
over from `from` when `isLooping` is set. It stops when the tab is hidden or the reader changes its value. With reduced
motion, play shows the end at once.

## How values flow

One store holds everything a reader, the application or an agent may read or set. A change goes through the UI SDK
change path, so it carries its reason and source and the application can refuse it.

- **Params** are the only values that are set. A number lands on its step grid.
- **Derived values** follow the params. They are never set. `from` is pure and may read only names declared before it.
  `valueProblem` says why a value is refused, and a derived name is reported as one that follows the params.
- **States** are named sets of param values in a beat. `showState(id)`, and `show(id)` from `useLesson`, shows a state
  as the whole picture: every param the state does not name takes the lesson's opening value. A state looks the same
  live, on the sheet and in a tour. `setMany` changes the params you name and keeps the rest. Both are one change, so
  readers see one move and not one per param. `showState` looks in the current beat first.
- **Resets** come in two sizes. `reset()` returns every param of the lesson to its opening value, the reader's work in
  every beat included. `resetBeat(beat)` returns only the params that beat owns: its `params`, or else every param its
  states set. Both are one change with the reason `reset`, and a player moving a reset param stops. A figure's Reset
  button is a `resetBeat`; `reset` is for starting the whole essay over. `show` keeps its meaning: it shows a state as
  the whole picture, so it too sets params outside the beat.
- **Beats and steps** are where the reader is. `setBeat(id, step)`, `next` and `previous` move through reveal steps and
  then beats. Moving to a beat does not apply its states.
- **Playback** moves one number param along its grid on the shared clock. Its changes have the reason `playback`, and a
  player an agent starts moves its param as the agent.
- **Saved values** come from the address bar (`shouldSyncUrl`) or local storage (`storageKey`) once the lesson is on the
  page, with the reason `restore`. A value in the address that no param takes is skipped.

`Value` and `Param` are only readers and setters of these names. A figure reads `useLesson(lesson).values`. Never copy a
value into prose or a figure.

## The clock

Every move that carries meaning runs on one frame loop in `teaching/src/time`. `createTween(initial)` returns a tween
with `get`, `to(target, pace?)`, `jump`, `subscribe` and `destroy`; `useTween(target, pace?)` returns an eased copy of a
target. A pace is `'instant'`, `'fast'` (140 ms), `'regular'` (320 ms) or `'slow'` (640 ms). A new target in the middle
of a move starts from what is on screen. `onFrame(listener)` subscribes to the one loop, and `isMotionReduced()` reports
the reader's preference. A reader who asked for reduced motion gets the end state at once, and the first render shows
the end state on the server and in the browser. No teaching component starts its own frame loop, timer or CSS keyframe
for motion that carries meaning.

## The scene

`Scene` is a figure: it takes the shared figure props (`title`, `description`, `source`, `status` and so on), the
selection props, and:

| Prop                 | Use                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `x`, `y`             | The data box's extents. Positions are in these units, and `y` grows upward as on a chart.         |
| `height` or `aspect` | A plot height by name, or the width divided by the height for a scene that keeps its proportions. |
| `focus`              | The camera: an id or ids to zoom to, or `null` for the whole box.                                 |
| `pace`               | How fast changes ease. A part may override it with its own `pace`.                                |
| `minWidth`           | The narrowest plot in pixels; below it the plot scrolls. Left out, the width the drawing needs.   |
| `weightMax`          | The wire weight drawn thickest. Weights must lie within plus or minus this. Defaults to 1.        |
| `locale`, `labels`   | `locale` falls back to the nearest `Lesson`. `labels` is a partial `SceneLabels`.                 |

### Placing things

- **Identity.** Give every object a stable `id`. The object with that id is the same thing across states, steps and
  figures: it eases to its new place, size, tone and face, and fades when it appears or leaves. Two objects with one id
  are reported as an error. A scene draws at most `sceneLimits.objects` (1200).
- **Position.** `at` is the center in data units as `[x, y]`. `offset` shifts it in pixels, across then down. A node's
  box comes from a named size (`small`, `medium`, `large`) or an exact `{ width, height }`, never from measuring
  content. The scene makes room so objects on one row do not touch and each wire keeps room for its arrow and text,
  unless an object is `isFloating`. That derived width is the narrowest legible one, so leave `minWidth` out. A wire
  runs straight between its ends and does not avoid what lies between them: give it `bend` to bow it around.
- **Motion.** Change a prop and the object moves. `delay` waits before a change starts, as milliseconds or
  `{ index, step }` in a stagger (`sceneStaggers`: short, regular, long). A `stagger` deals in turn: on a `SceneStack`
  (a step name) or a `SceneNode` (a group, an `index` and a `step`), members that change in the same update start one
  step apart, and one that moves alone starts at once. `isShown={false}` fades an object out and takes it out of the
  keyboard order. `turn`, `lift`, `tilt` and `rotate` are states of a node.
- **Attention.** `isActive` keeps an object at full strength while the rest recede; a `SceneSlot`'s only outlines it.
  `emphasis="context"` draws it gray. `SceneHighlight`, `SceneCallout` and the camera `focus` point the reader; a
  highlight marks one object without dimming the rest.
- **Readout.** An object with a `label` is an item the arrow keys reach and the readout names. The label is the full
  sentence; `text` is what is drawn.
- **Presses.** `selected` and `onSelectedChange` on the `Scene` make labelled objects act when pressed: a press, or
  Enter or Space on the keyboard cursor, calls `onSelectedChange` with the object's id. `selected={null}` keeps the
  press an action, such as turning a card: `onSelectedChange={(id) => set('faceUp', id)}`, and a pointer press then dims
  nothing. `labels.press` ends the plot's accessible name with what a press does, such as "Press Enter or Space to turn
  the card over."; the default is "Press Enter or Space to activate a part."
- **Escape hatch.** `SceneCustom` hands a function the scene's scales, box, view, `tone` and `color`, and draws SVG in
  plot pixels. New parts build on `useSceneObject`.

### Parts

| Group  | Parts                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Core   | `SceneNode`, `SceneWire`, `SceneGroup`, `SceneBracket`, `SceneCallout`, `SceneHighlight`, `SceneCustom`, `SceneLayer`.   |
| Plane  | `SceneAxes`, `SceneCurve`, `ScenePoint`, `SceneVector`, `SceneProjection`, `SceneRegion`, `SceneRule`.                   |
| Shapes | `SceneCard`, `SceneStack`, `SceneSlot`, `SceneCells`, `SceneToken`, `SceneTokens`.                                       |
| Flow   | `SceneFlow` inside a `Scene`, and `LessonFlow`, a scene sized to the flow. `MorphScope` trades two figures of one thing. |

`SceneNode` takes `id`, `at`, `text`, `label`, `size`, `shape` (`box`, `pill`, `circle`, `plain`), `tone`, `isCode`,
`back` and `children` for rich content such as a compact chart. `SceneWire` takes `from`, `to`, `weight` (thickness
shows its size, hue its sign), `text`, `shape` (`straight`, `curve`, `elbow`), `bend` in pixels, `isDashed` and
`hasArrow`, and follows its ends on every frame. `SceneGroup` outlines the ids in `around`; `SceneBracket` spans the ids
in `of` on a `side`.

The plane parts draw in data units. `SceneCurve` takes `points` or a function `of`, with `fillTo`; `ScenePoint` takes
`at` and is a slider when it gets `onMove` or `sets`, with `snap` and `along`: the reader drags it, or reaches it with
Tab and moves it with the arrow keys, Home and End, and it speaks its values in each param's format. A point that sets
both `x` and `y` moves x with Left and Right and y with Up and Down. `sets={{ x: 'weight' }}` names the lesson number
params a move writes, in one change, on each param's step grid and inside its range (the type `ScenePointSets` is
exported); `SceneRegion` takes `between`, `above`, `below` or `points`; `SceneRule` takes `x` or `y`; `SceneVector`
takes `to` and `from`; `SceneProjection` follows a point with `of`.

`SceneCard` is a playing card (`rank` and `suit`) or a generic card (`text`), with `isFaceUp`, `lift`, `tilt` and
`size`. A face-down card reads "A card, face down" and renders only its back, so neither a screen reader nor an agent
can name it; keep its `id` free of its rank and suit, since ids reach the page and agents. `SceneNode` takes `backTone`
for the hue of its back face. A `SceneStack` places the cards it lists in `cards` as a `pile`, `fan`, `row` or `column`,
and takes `stagger` to deal them, and a `SceneSlot` marks a place. `SceneCells` draws a vector or matrix from `values`
or `cells`, with `palette` (`sequential` or `diverging`) and `highlight`; each cell takes a `tone` and `isMuted`, and
column labels wrap and overhang rather than being cut. `SceneTokens` lays a text out as tokens, each with an optional
`tokenId` and `probability`.

`SceneFlow` draws a lesson's derivation: each param and derived value is a node in layers, wired to what it reads.
Params are inline controls, and a change glows through what it touches. `MorphScope` takes `figures` by name and `show`;
each thing drawn in both figures, matched by id, travels to its place in the new one.

## The article

`Article` takes the `lesson`, a required `locale` and `title`, and renders the `Lesson`, the tone scope and one chart
link for you.

| Prop                                              | Use                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `authors`, `date`, `summary`                      | The title block. `date` is an ISO date.                                                                |
| `tones`                                           | The tone of each id every figure and term of the article shares, declared once.                        |
| `view`                                            | `'article'` (default), `'present'`, `'static'` or `'sheet'`.                                           |
| `math`                                            | A function `(tex, { isDisplay }) => ReactNode` that typesets `TeX`. Without it, math shows its source. |
| `storageKey`                                      | Keeps the lesson's values, and the reader's progress under `${storageKey}.progress`.                   |
| `progress`, `defaultProgress`, `onProgressChange` | The reader's progress, held by the application.                                                        |
| `labels`                                          | The words the article writes around the content, `defaultArticleLabels` by default.                    |
| `lessonProps`                                     | Props for the `Lesson`: controlled values, beat and step, address bar sync.                            |
| `hasContents`                                     | `false` leaves the contents list out of the article and static views, at every width.                  |

Structure: a `Beat` takes the id of a beat the lesson declares, and its title, tutor notes, reveal steps and states come
from the lesson. `Figure` takes `id`, `caption`, `description`, `reads` and `size` (`'wide'` by default or `'text'`),
and numbers figures in reading order. Its `header` and `footer` hold the figure's controls: either one sets the figure
in a hairline frame, with a strip above or below the visual ruled off from it. `isFramed` frames a figure that has no
controls, so an essay that frames its figures frames them all; a figure with a strip cannot set `isFramed={false}`. The
static view and the sheet make the strips inert, and a chart's `report` frame inside stands in for the figure's border.
A chart or scene inside a `Figure` sits in a `CaptionScope` from `/charts`: it keeps its title as its accessible name
and prints neither the title nor the description. The figure's number and caption are printed, and its `description` is
the text the static view prints. `FigureReference to` writes "Figure 2" as a link. `Reveal at` shows its content from a
reveal step in the present view and at once in the others, and `useRevealed(at)` gives a figure the same answer for
parts it reveals itself. `Scrolly figure` keeps one figure in view while `ScrollyStep` children, each with `values` or a
`state`, set the lesson as the reader scrolls. `Aside`, `Footnote id`, `Cite id` and `References items` carry notes and
sources. `TeX` writes TeX source, inline or with `isDisplay`. `Term inspects` and `DiagramPart inspects label` point
from prose or a hand-drawn SVG into the figures, and back.

`Predict` takes an `id`, a `prompt`, and either `options` with an `answer` id, or `min`, `max`, `step`, `format` and an
`answer` or an `answerFrom` lesson value, with an optional `tolerance`. `Challenge` takes an `id`, a `prompt`,
`isReached` (a function of the values by name) and `hints`. Both show their `children` once they are answered or
reached.

### The four views

Every view renders the same children. The views differ in arrangement only: no content exists in one view and not in
another.

| View      | What it is                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `article` | A scrolling essay with a contents list; below 1,120 px it folds into a sticky bar that never covers a focused control or a linked target. Scrolling a beat into the reading band makes it the lesson's beat; scrolling never changes values.                                                                                                                       |
| `present` | One beat fills the screen. Right or Space shows the next reveal step or beat, Left goes back. A beat the presenter moves to opens at its first declared state. A `Scrolly` in the beat shows its figure beside a short list of its steps, which are walked before the reveal steps, and the beat's footnotes sit on its slide. Keys inside a control stay with it. |
| `static`  | Every beat open at its first state, every reveal shown, each figure followed by its description. It needs no script to be read.                                                                                                                                                                                                                                    |
| `sheet`   | For authors, reviewers and agents: every beat at each declared state, read-only and scaled to fit, with its tutor notes, then a list of checks.                                                                                                                                                                                                                    |

Beat titles, tutor notes, step counts and states live in the lesson definition, never only in markup. The checks list in
the sheet is `articleChecks(lesson, articleOutline(children))`: a lesson beat the article does not render, a rendered
beat the lesson lacks, a beat with no figure, a figure with no description, two parts that give the page one element id
(beats, figures, footnotes and references), a `Playback` with no `Transport`, a `Param` in prose that changes no figure
of its beat, and a `Predict` or `Challenge` outside every `Beat`. `articleOutline` reads the markup before it renders,
so figure numbers agree on the server and in the browser. It cannot see into a component of your own, so a `Beat`,
`Figure`, `Predict` or `Challenge` written inside one shows an inline error. Write them directly in the `Article`'s
children.

### A host that holds the beat

An application whose own navigation lists the beats, such as a rail in an `AppShell`, holds the beat: it passes `beat`
and `onBeatChange` through `lessonProps`, and `hasContents={false}` leaves the article's own list out at every width
without changing the text's measure. Scrolling a beat into the reading band reports it to the host with the reason
`scroll`, and a beat the host sets scrolls into view.

### Progress counts only the reader

The reader's progress is a UI SDK primitive named `lesson-progress`. Its value holds `predictions` (by id, with the
guess, the answer when committed and whether it was right), `reached` (challenge ids in order), `hints` (how many by
challenge id) and `visited` (beat ids in order). `emptyProgress` is the empty value.

- A prediction commits once, and only a reader's press commits it. An agent that tries gets a message that it needs the
  reader. A prediction's answer from `answerFrom` is read when the reader commits.
- A challenge is reached when a change whose source is not an agent makes `isReached` true.
- A hint shows only for a reader's press.
- A beat the reader opens on in the article or present view, or moves to, counts as visited.
- A change with the source `agent` is refused before `onProgressChange` hears of it. `restore` and `reset` are not acts.

## MDX

`Essay` renders a compiled MDX file as an `Article`. It takes the `Article` props except `children` and `view`, plus
`content` (the file's default export), optional `components`, and `view`. Without `view`, the address parameter
`?view=present`, `static` or `sheet` decides, and the server and first browser render show `article`. `essayComponents`
maps Markdown elements to the article's typography and every teaching part to its own name, and math written with
`remark-math` reaches `TeX` when the application adds that plugin. The file needs no imports for `Beat`, `Param`,
`Figure`, `Scene` and the rest. `EssayMeta` describes `export const meta` of a file: `title`, `authors`, `date` and
`summary`, spread onto `Essay`.

The application brings its own MDX compiler, such as `@mdx-js/rollup`, and a typesetter passed as `math`. Add no
dependency to Elements for either.

Start from the starter:

```sh
pnpm exec mechane-elements-catalog --new-essay my-essay
```

It copies `templates/essay` into a new or empty directory, names the package after the directory and pins `^` the
installed version. It refuses a directory that already has files. The starter is a small essay on synthetic data: a
`plan.json`, a lesson, figures, `essay.mdx`, an entry file and its own `AGENTS.md` and README.

## Plans, checks and the guide

`/lesson/spec` treats lessons as plain data, in Node and in the browser.

| Export                         | What it does                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `LessonPlan`                   | The type of a plan: `id`, `title`, `audience`, `idea`, `params`, optional `derived` (with `reads` and a `formula`), `beats`.     |
| `validateLessonPlan(input)`    | Returns `{ isValid, findings }`. It never throws. A plan is valid when no finding is an `error`.                                 |
| `checkLesson(lesson)`          | Teaching advice for a defined lesson: no goal, several new params in one beat, a param no state moves, a long run with no recap. |
| `describeLesson(lesson)`       | The lesson as JSON: params, derived values with what they read, and beats with notes and states.                                 |
| `lessonWalk(lesson, locale)`   | The lesson as text an agent reads, with each state's values written in their formats.                                            |
| `writtenValue`, `valueProblem` | A value as the reader sees it, and why a lesson would refuse a value.                                                            |
| `explainerGuide`               | The guide above, as data.                                                                                                        |

A finding is `{ path, message, severity }`, where `path` reads like `beats[2].states[0].values.temperature`. An `error`
means `defineLesson` would refuse it. `advice` is practice the author may decline. A plan's beat may add a `figure` (a
part from the guide or a chart name, the question it answers and what it shows) and an `ask` (`predict` or `challenge`,
with a prompt).

## Agents

The UI SDK bridge is the only route. A tutor reads and acts through `createAgent()` from `@mechane-ai/elements/agent`.

The lesson is a `lesson` entry in the agent snapshot, named by its title, with the `values`, `beat`, `step` and
`playing`. Its actions are `setParam`, `setParams`, `showState`, `reset`, `setBeat`, `next`, `previous`, `play` and
`pause`, and they are shown unless the lesson is read-only. An article adds a `lesson-progress` entry that agents read
and call no action on. The host's `allow` function still decides which steps run.

```ts
import { createAgent } from '@mechane-ai/elements/agent';

const agent = createAgent();
const entry = agent.snapshot().find((item) => item.component === 'lesson');

if (entry !== undefined) {
  await agent.act({ steps: [{ ref: entry.ref, action: 'setParam', args: ['batch', 64] }] });
}
```

A change an agent makes has the source `agent`. It moves the lesson and can be refused, and it never commits a
prediction, reaches a challenge or shows a hint.

### Tutor tools

`tutorTools({ agent, lesson, locale, article?, answers? })` returns `TutorTool`s, each
`{ name, description, inputSchema, run }`. `inputSchema` is JSON Schema, and `run` is async and returns a `TutorResult`:
`{ kind: 'ok', ... }` with what changed, or `{ kind: 'error', message }`. The host passes them to its model.
`registerTutorTools` is not part of the library, because the SDK cannot register custom WebMCP tools.

| Tool                             | Does                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `read_outline`                   | The lesson as JSON: params with ranges, derived values with what they read, beats with notes and states.     |
| `read_place`                     | The beat and step, every value as a number and as written, the beat's tutor notes and the reader's progress. |
| `set_param`, `set_params`        | Set one param or several in one change, as the agent.                                                        |
| `show_state`                     | Show a beat state, which sets every param it does not name to the opening value.                             |
| `go_to_beat`, `next`, `previous` | Move between beats and reveal steps.                                                                         |
| `play`, `pause`                  | Start the player of a number param, or stop it.                                                              |
| `inspect_figure`                 | Point at one object of a figure, named by its title and the object's id.                                     |

`article` is the title of the article whose progress to read; it defaults to the lesson's title or the page's only
article. `answers` maps each `Predict` id to the lesson value its answer comes from. Get it with
`answerSources(articleOutline(children))` from `/article`. Until the reader commits that prediction, the tools leave the
value out of `read_place`, out of what changed, and list its name in `withheld`. Tutor notes come from the lesson and
are never shown to the reader.

### The learner trace

`createLearnerTrace({ agent, lesson, article?, limit?, now? })` records, through the bridge, what the reader did: param
moves, beat and step moves, players started, and from `lesson-progress` predictions, hints and challenges. Each event
has `at`, `kind`, `name`, `from`, `to`, the `source` and `reason`, and a `count`, because moves of one control close
together are one event. Changes an agent makes, restores and a player's own steps are left out. `read()` returns a
`LearnerRecord` as plain JSON, with `visits` for time on each beat. It keeps the last `limit` events
(`LEARNER_TRACE_LIMIT` is 400) and counts the `dropped`. `summarizeTrace({ record, lesson, locale, answers? })` writes a
few sentences of plain facts for a tutor prompt. It interprets nothing.

### Tours

A `LessonTour` is a list of steps, each with optional `beat`, `step`, `state`, `values`, `say` and `hold` (`short`,
`regular` or `long`; `tourHolds` is 1.5, 3 and 6 seconds). `playTour({ agent, lesson, tour, onSay })` moves the lesson
through the bridge on the shared clock, calls `onSay` with each line, and returns a `TourPlayer` with `status`, `index`,
`error`, `pause`, `resume`, `stop` and `subscribe`. It pauses when the reader acts on the lesson, and `resume` goes on.
`validateTour(tour, lesson)` checks beats, steps, states, values and holds before it plays, with the same findings as a
plan. `tourFromTrace(record)` turns a recorded demonstration into a tour to edit.

## Add a part

A part that draws in a scene calls `useSceneObject` with a stable `id`, a `kind`, a `frame` and any more numbers to
ease. State that a reader, the application or an agent could read or set belongs in a UI SDK primitive, not in a hook. A
part takes every visible string that is not the author's content from one `labels` prop with plain English defaults,
takes tones from the tone scope, and adds no dependency for typesetting, drawing or motion. Add the part to its folder's
`index.ts`, to `explainerGuide` with a question, guidance and an example, and to `essayComponents`.

## Stories

Each part has stories under its folder. Render them in light and dark themes, at 320 pixels and with reduced motion.
Step a scene between two states and confirm each object moves once and its wires stay attached. Change one param from
prose, from a control and through the agent bridge, and confirm every reader of it agrees. Render one essay in all four
views and compare the text of each beat. `recipes/explorable-essay.tsx` is a short essay in one TSX file, and
`recipes/counting-cards.tsx` (story `Recipes/Counting Cards`) is a full example that uses every layer.
