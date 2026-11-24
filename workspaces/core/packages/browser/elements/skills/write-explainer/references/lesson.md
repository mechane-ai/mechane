# Lesson

Import from `@mechane-ai/elements/lesson`. A lesson is one store that every part of an essay reads: prose, controls,
figures, players and agents. Contract 142 holds the rules.

## `defineLesson`

```ts
const lesson = defineLesson({ id, title, params, derived, beats });
```

- `params`: number (`value`, `min`, `max`, `step`, optional `scale: 'log'`, `format`), choice (`value`, `options` of
  `{ id, label }`) and toggle (`value`) params, each with a `label`.
- `derived`: `{ label, format, from }`. `from` receives the params and the derived values declared above it, typed, and
  returns a number. Keep it pure: no randomness, no time, no fetch.
- `beats`: `{ id, title, goal?, misconception?, hints?, steps?, states?, params? }`. Goals, misconceptions and hints are
  tutor notes; the reader never sees them. `states` are `{ id, label, values }`, where `values` set params only.
  `params` names the params the beat owns, which `resetBeat` resets; left out, they are the params its states set.
- It throws a named `Error` for a bad definition, at module load, so a mistake fails before anything renders.
- The result carries `defaults`, `initial` (params and derived values at the opening), `compute(values)` and `reads`
  (the names each derived value reads, found by running it). `lessonGraph(lesson)` gives the same as nodes and edges.

Choice ids and beat ids are literal types: `values.hand` is `'queen-seven' | 'two-king'`, and `set('hand', 'three')`
does not compile.

## `Lesson`

`Article` renders the `Lesson` for you; pass `Lesson` props through its `lessonProps`. Render `Lesson` yourself only for
a lesson outside an article, or an independent second copy.

| Prop                                        | What it does                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `lesson`, `locale`                          | Required. The locale writes every value.                                       |
| `values`, `defaultValues`, `onValuesChange` | Controlled or not. The callback gets the values, then details.                 |
| `beat`, `defaultBeat`, `onBeatChange`       | The current beat id.                                                           |
| `step`, `defaultStep`, `onStepChange`       | The reveal step inside the beat, from 0.                                       |
| `onPlayingChange`                           | Hears a player start or stop.                                                  |
| `shouldSyncUrl`                             | Reads values from the address on mount and writes them back.                   |
| `storageKey`                                | Keeps values across visits. On `Article`, it also keeps the reader's progress. |
| `isReadOnly`                                | A frozen copy, as the beat sheet uses. Hidden from agents.                     |

Change details carry `reason` (`drag`, `step-key`, `playback`, `scroll`, `reset`, `imperative` and others), `source`
(`mouse`, `keyboard`, `touch`, `agent`, `programmatic`) and `cancel()`. An application refuses a change by cancelling:

```tsx
/** The application holds the values and refuses a bias below −8. */
export function HeldLesson({ children }: { readonly children: ReactNode }): ReactNode {
  const [values, setValues] = useState<Partial<ParamValues<typeof lesson.params>>>({ bias: 0 });

  return (
    <Lesson
      lesson={lesson}
      locale="en-US"
      values={values}
      onValuesChange={(next, details) => {
        if (next.bias < -8) {
          details.cancel();
        } else {
          setValues(next);
        }
      }}
    >
      {children}
    </Lesson>
  );
}
```

## `useLesson`

`useLesson(lesson)` is typed by the definition and throws outside a `Lesson` that renders it. `useLessonContext()` is
the untyped form for parts that work in any lesson.

| Field                                       | What it is                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `values`                                    | Every param and derived value now.                                              |
| `set(name, value, origin?)`                 | Sets one param. A value outside its range or options **throws**.                |
| `setMany(values, origin?)`                  | Sets several params in one change.                                              |
| `show(stateId, origin?)`                    | Shows a declared state as the whole picture, looking in the current beat first. |
| `reset(origin?)`                            | Every param of the whole lesson back to its opening value.                      |
| `resetBeat(beat, origin?)`                  | Only the params that beat owns back to their opening values, in one change.     |
| `beat`, `step`                              | Where the reader is.                                                            |
| `goTo(beat, step?)`, `next()`, `previous()` | Move. `next` reveals the next step, then goes to the next beat.                 |
| `locale`, `lesson`                          | The lesson's locale and definition.                                             |

In the article view, going to a beat does not apply its states: the reader keeps the values they set. The present view
opens a beat that declares states at its first one, each time the presenter moves to it; the static view and the sheet
draw states too. Elsewhere, only `show`, a `ScrollyStep` with `state` and a tutor's `show_state` apply a state. A state
is the whole picture: a param it does not name takes the value the lesson opened with, so a state looks the same live,
on the sheet and in a tour. To change some params and keep the rest, use `setMany`.

`show` and `reset` act on the whole lesson. A Reset button under one beat's figure that calls `reset` also clears what
the reader set in every other beat; give it `resetBeat('that-beat')`. It reports the reason `reset`, like `reset`, and
stops a player that moves one of the beat's params. When a beat's states set a shared param, such as a temperature every
beat reads, list the beat's own params in `params` so its reset leaves the shared one alone.

A control of yours that calls `set` keeps the value on the param's step and inside its range, and passes the event's
details as the origin so the change reports a reader's source:
`set('bias', bias, { reason: details.reason, event: details.event })`. A draggable `ScenePoint` needs no handler: its
`sets` prop writes the params for it.

```tsx
/** A button that shows a declared state, and one that resets this beat's params. */
export function StateButtons(): ReactNode {
  const { show, resetBeat, beat, next } = useLesson(lesson);

  return (
    <>
      <Button onClick={() => show('skeptic')}>Show a skeptical neuron</Button>
      <Button onClick={(event) => resetBeat('bias', { reason: 'reset', event: event.nativeEvent })}>Start again</Button>
      <Button onClick={() => next()}>{beat === 'learning' ? 'Done' : 'Next'}</Button>
    </>
  );
}
```

## Prose and controls

- `<Param name="rate" />` in a sentence: a number the reader drags or steps with the arrow keys, a choice that opens an
  inline picker, a toggle that switches.
- `<Value name="loss" />`: a param or derived value in its declared format. `labels` names a toggle's on and off.
- `<ParamSlider name />`, `<ParamChoice name />`, `<ParamToggle name />`: labelled block controls, for under a figure.
  `ParamChoice` suits two to five options.
- `BoundValue` is the number-in-a-sentence control without a lesson: `value` with `onValueChange` or `defaultValue`,
  `min`, `max`, `step`, optional `scale`, `locale`, `format` and `label`. Inside a lesson, use `Param`.

A name the lesson does not declare draws a short inline error in the danger color. Read the page, not only the types.

## Time

`<Playback name from? to? pace? isLooping? />` drives a number param on the shared clock. It renders nothing. `pace` is
`'fast'` (12 steps a second), `'regular'` (6) or `'slow'` (2), or a timed run: `{ run: 'short' | 'regular' | 'long' }`
crosses the whole range in 2, 5 or 10 seconds however many steps it has, so a 320-step training run fits in `long`. Add
`isEased: true` for a run that starts fast and settles, such as a blend. It pauses when the tab is hidden or the reader
moves the value, and with reduced motion `play` jumps to the end.

`<Transport for="name" labels? />` plays, pauses, steps and scrubs it. Every `Playback` needs a `Transport` the reader
can reach, or the beat sheet flags it. `usePlayback(name)` returns `{ isPlaying, play, pause, toggle, stepBy, seek }`
for a control of your own.

```tsx
/** Plays the bias from −10 to 10 and lets the reader pause and scrub it. */
export function BiasSweep(): ReactNode {
  const player = usePlayback('bias');

  return (
    <>
      <Playback name="bias" from={-10} to={10} pace="regular" />
      <Transport for="bias" />
      <Button onClick={() => player.seek(0)}>{player.isPlaying ? 'Playing' : 'Back to zero'}</Button>
    </>
  );
}
```

For motion inside your own component, `useTween(target, pace?)` returns an eased copy of a record of numbers on the same
clock. Prefer a scene part, which already eases.
