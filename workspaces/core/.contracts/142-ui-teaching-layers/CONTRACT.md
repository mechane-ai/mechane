---
name: ui-teaching-layers
message: Teach from one lesson store, one clock and the plot kernel; authors describe states, never animations.
paths: ["packages/browser/elements/packages/teaching/**"]
---

## Rules

Keep a lesson's state in one store. `defineLesson` declares each parameter with its range, step and format, each
derived value as a pure function of the values before it, and each beat with its states as plain data. Prose, controls,
figures, players and agents read and set those names through the `Lesson` primitive. A teaching component keeps no
other state that a reader, the application or an agent would need to read or set.

Change the store only through the UI SDK change path, so every change carries its reason and source and the
application can refuse it. Reject a value outside a parameter's declared range or options with an error that names the
parameter and the bounds. A component given a name the lesson does not declare shows a short inline error. It never
throws during render and never draws a guess.

Describe states, never animations. A component given new props moves to them by itself. Every move runs on the one
shared clock in `teaching/src/time` through `createTween` or `useTween`. No teaching component starts its own frame
loop, timer or CSS keyframe for motion that carries meaning. A reader who asked for reduced motion gets the end state
at once, and the first render shows the end state on the server and in the browser.

Give every object in a diagram a stable `id`. The object with that id is the same thing across states, steps and
figures: it eases to its new place, size, tone and face, and fades when it appears or leaves. A wire follows its
endpoints on every frame. An id that names the same thing in a scene and a chart of one link scope is inspected in
both together.

Draw a scene with the plot kernel under the data display contract: its scales, paths, label placement, tones, frame,
readout and keyboard cursor. A scene is a figure, so every labelled object is an item the arrow keys reach and the
readout names. Node boxes come from named sizes or declared pixels, never from measured content. Turning, lifting,
tilting and stacking are built-in states of a node. A drawing the scene parts lack goes through `SceneCustom`, which
hands the author the scene's scales and tones.

Render the same children in every view of an article. The `article`, `present`, `static` and `sheet` views differ in
arrangement only: no content exists in one view and not in another, and the `static` view needs no script to be
read. Beat titles, tutor notes, step counts and states live in the lesson definition, never only in markup.

Count only what the reader did. A change whose source is an agent never commits a prediction or reaches a
challenge, and a prediction's answer stays hidden from agents until the reader commits. Tutor notes are never shown
to the reader.

Give agents the same lesson people get. The store's values, beat and step are in the agent snapshot and its actions
are `setParam`, `setParams`, `showState`, `reset`, `setBeat`, `next`, `previous`, `play` and `pause`. A player an
agent starts moves its param as the agent. `validateLessonPlan` accepts a lesson plan as plain data and
`checkLesson` a defined lesson, and each returns every finding with a path and a sentence. `explainerGuide` names
each part with the question it answers and one example. A tutor reads and acts through the UI SDK agent bridge and
nothing else.

Import another Elements family only through its public entry file. Each teaching folder's `index.ts` is a public
entry of the package and lists everything an application may use. Add no dependency for typesetting, drawing or
motion: the application supplies a math typesetter as a function, and math without one shows its source.

Take every visible string that is not the author's content from one `labels` prop with plain English defaults.

## Checks

Render each part's stories in light and dark themes, at 320 pixels and with reduced motion.
Step a scene between two states and confirm each object moves once, its wires stay attached, and reduced motion jumps.
Change one parameter from prose, from a control and through the agent bridge, and confirm every reader of it agrees.
Render one essay in all four views and compare the text of each beat.
Search a changed file for `requestAnimationFrame`, `setInterval`, a color literal and an import of a family's
internal file.

## Local adaptations

`teaching/src/time/clock.ts` owns the only frame loop. `Playback` and `Scene` read it through `onFrame`.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
