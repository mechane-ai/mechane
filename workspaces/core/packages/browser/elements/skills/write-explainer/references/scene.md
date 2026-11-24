# Scene

Import from `@mechane-ai/elements/scene`. A `Scene` is a diagram with identity, drawn on the chart kernel: every object
has an id, and when its props change it eases to the new state. Describe each state; the scene does the motion.

## The example

A choice param picks the stage, and the scene describes what each stage shows. The camera zooms on one stage, the output
fades in on the last, and the wires stay attached while their nodes move.

```tsx
import { defineLesson, useLesson } from '@mechane-ai/elements/lesson';
import {
  Scene,
  SceneBracket,
  SceneCallout,
  SceneCustom,
  SceneGroup,
  SceneHighlight,
  SceneNode,
  SceneWire,
} from '@mechane-ai/elements/scene';
import type { ReactNode } from 'react';

const inputs = [
  { id: 'x1', name: 'x₁', row: 2.5, weight: 0.6 },
  { id: 'x2', name: 'x₂', row: 1.5, weight: -0.9 },
  { id: 'x3', name: 'x₃', row: 0.5, weight: 0.3 },
] as const;

export const neuron = defineLesson({
  id: 'neuron',
  title: 'Building a neuron',
  params: {
    stage: {
      kind: 'choice',
      label: 'Stage',
      value: 'inputs',
      options: [
        { id: 'inputs', label: 'Inputs' },
        { id: 'weights', label: 'Weights' },
        { id: 'output', label: 'Output' },
      ],
    },
  },
});

/** One scene, three states. Nothing here says how anything moves. */
export function NeuronScene(): ReactNode {
  const { values, locale } = useLesson(neuron);
  const hasWeights = values.stage !== 'inputs';
  const hasOutput = values.stage === 'output';

  return (
    <Scene
      title="Building a neuron"
      description="Synthetic values. Each input is multiplied by its weight; thickness shows the weight's size and hue its sign."
      locale={locale}
      x={[0, 4]}
      y={[0, 3]}
      focus={values.stage === 'weights' ? ['sum', 'x1', 'x2', 'x3'] : null}
      pace="slow"
    >
      {inputs.map((input) => (
        <SceneNode key={input.id} id={input.id} at={[0, input.row]} text={input.name} label={`Input ${input.name}`} />
      ))}
      <SceneNode id="sum" at={[2, 1.5]} shape="circle" text="Σ" label="Weighted sum" tone="series1" />
      <SceneNode id="out" at={[4, 1.5]} shape="pill" text="ŷ" label="Output" isShown={hasOutput} />
      {inputs.map((input) => (
        <SceneWire
          key={input.id}
          from={input.id}
          to="sum"
          weight={hasWeights ? input.weight : 0.2}
          text={hasWeights ? String(input.weight) : undefined}
          label={`Weight from ${input.name} to the sum`}
        />
      ))}
      <SceneWire from="sum" to="out" shape="curve" isShown={hasOutput} label="The sum becomes the output" />
      <SceneGroup id="layer" label="The input layer" text="inputs" around={['x1', 'x2', 'x3']} />
      <SceneBracket of={['x1', 'x2', 'x3']} side="left" label="Three inputs" text="3" />
      <SceneCallout to="sum" side="top" isShown={hasWeights}>
        Each wire multiplies its input by a weight.
      </SceneCallout>
      <SceneHighlight of="out" isShown={hasOutput} />
      <SceneCustom layer="back">
        {({ x, y, color, tone }) => (
          <line
            x1={x.position(2)}
            x2={x.position(2)}
            y1={y.position(0)}
            y2={y.position(3)}
            stroke={color(tone({ id: 'sum', index: 0 }))}
            strokeDasharray="4 4"
          />
        )}
      </SceneCustom>
    </Scene>
  );
}
```

## `Scene`

| Prop                                         | What it does                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `title`                                      | Required. The figure's title, as for a chart.                                                 |
| `description`, `source`, `actions`, `status` | The kernel's figure props.                                                                    |
| `locale`                                     | Left out, the nearest `Lesson`'s.                                                             |
| `x`, `y`                                     | The data box, such as `[0, 4]`. Every position is in these units, and y grows upward.         |
| `height` or `aspect`                         | A named height (`'compact'`, `'regular'`, `'tall'`), or width divided by height.              |
| `focus`                                      | The camera: an id or ids to zoom to, or `null` for the whole box.                             |
| `pace`                                       | `'instant'`, `'fast'`, `'regular'` or `'slow'`. Reduced motion always jumps.                  |
| `weightMax`                                  | The wire weight drawn thickest. Every weight must lie within plus or minus it. Defaults to 1. |
| `selected`, `onSelectedChange`               | Selection, as on a chart, and presses: see Pressable objects below.                           |
| `minWidth`, `labels`                         | Leave `minWidth` out: the derived width is the narrowest at which the drawing is legible.     |

An object placed outside the box, a weight beyond `weightMax`, or a wire to an id that does not exist shows an error in
the figure instead of a guess.

## Objects

Every object takes `isShown` (false fades it out and takes it out of the keyboard order), and most take `isActive`
(keeps it bright while unrelated objects recede), `tone`, `emphasis` and `label`. A `label` is the full sentence for the
readout and assistive technology, and makes the object an item the arrow keys reach. `text` is what is drawn.

- `SceneNode`: `id`, `at` (`[across, up]`), `text`, `isCode` for token text or code, `size` (`'small'`, `'medium'`,
  `'large'` or `{ width, height }` in pixels), `shape` (`'box'`, `'pill'`, `'circle'`, `'plain'`), `offset` in pixels,
  `turn` (0 front to 1 back, with `back` as the other face and `backTone` as its hue), `lift` (0 to 1), `tilt` and
  `rotate` in degrees, `order`, `stagger`, `delay`, `pace`, and `children` for rich content such as a compact chart that
  keeps its state as the node moves.
- `SceneWire`: `from`, `to`, `id` (defaults to `from>to`), `weight` (thickness by size, hue by sign), `text`, `textSide`
  (`'auto'` above a level wire and right of an upright one, or a side), `shape` (`'straight'`, `'curve'`, `'elbow'`),
  `isDashed` for a modelled connection, `hasArrow` (default true), and `bend`: pixels a straight wire's middle bows off
  its line, positive above an across wire. A wire does not avoid other objects, so bend one that would cross a node
  between its ends, or put one end on another row.
- `SceneGroup`: `id`, `around` (ids), `label`, `text`, `padding`. An outline that follows its members.
- `SceneBracket`: `of` (ids), `side` (`'top'`, `'right'`, `'bottom'`, `'left'`), `label`, `text`.
- `SceneCallout`: `to` (an id), `side` (`'auto'` or a side), `width`, and one sentence of prose as children.
- `SceneHighlight`: `of` (an id or ids), `tone`, `padding`. A halo; the objects themselves are not changed.

`stagger` deals objects in turn. On a node it is `{ group, index, step? }`: nodes of one group that change in the same
update start one `step` apart (`'short'`, `'regular'` or `'long'`, default `'regular'`) in `index` order, and a node
that changes alone starts at once. Cards take it from their `SceneStack`. `delay` is a fixed wait on every change, in
milliseconds or as `{ index, step }`; it also delays a lone move, so prefer `stagger` for a deal or a cascade.

## Pressable objects

A card that turns or a node that acts when pressed needs no handler of its own. Give the `Scene` `onSelectedChange`: a
press on a labelled object, or Enter or Space on the keyboard cursor, calls it with that object's id. `selected={null}`
keeps the press an action rather than a lasting selection, and a pointer press then dims nothing. Say what the press
does in `labels.press`, which ends the plot's accessible name (default "Press Enter or Space to activate a part.").

```tsx
<Scene
  title="The first card"
  x={[0, 2]}
  y={[0, 1]}
  selected={null}
  onSelectedChange={() => set('isRevealed', !isRevealed)}
  labels={{ press: 'Press Enter or Space to turn the card over.' }}
>
  <SceneCard id="first" at={[1, 0.5]} rank="Q" suit="heart" isFaceUp={isRevealed} />
</Scene>
```

## Identity

An id names a thing, not a place. Keep it while the thing moves, turns or changes value, and change it only when the
thing itself is different: dealing a new card is a new id, moving a card is the same id. An object that appears after
the first paint fades in, and one with `isShown={false}` fades out. Render every object of every state and toggle
`isShown`, rather than mounting objects conditionally, so a disappearance eases.

The same id in a scene, a chart and a `Term` of one article is the same record: inspecting it in one marks it in the
others, and `tones` on `Article` gives it one hue everywhere.

## `SceneCustom`

The escape hatch for a drawing no part provides. Its child is a function that receives
`{ x, y, box, view, tone, color }` and returns SVG in plot pixels: `x.position(value)` and `y.position(value)` map data
units through the camera, `tone({ id, index })` resolves a tone through the scope, and `color(tone)` gives the colour
for `fill` or `stroke`. `layer` is `'back'` (under the wires) or `'front'` (the default). It is called on every camera
frame. What it draws is not inspectable or reachable by keyboard, so prefer a part when one exists, and put the meaning
in a labelled part.

## Writing a new part

A part an essay needs and the scene lacks belongs in Elements, under contract 142 and the `extend-elements` skill:
`useSceneObject` registers an id with its target geometry and returns the eased values, and `useSceneContext` gives the
scales, box, registry and pace.
