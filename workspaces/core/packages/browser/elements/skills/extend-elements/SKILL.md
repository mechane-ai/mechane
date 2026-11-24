---
name: extend-elements
description:
  Implement or change a shared component in the Mechane Elements source repository, including its UI SDK behavior,
  StyleX appearance, or agent-visible state.
---

# Extend Elements

Find the closest component in the owning family under `packages/` and read its public entry and story. When several
controls already provide the desired behavior together, compose them in a recipe. Add a shared component when the
library needs to own a repeated interaction or prevent an invalid combination of inputs.

For a new interaction, open `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md` from the Elements package directory. This
is the guide for the pinned SDK. Use an existing UI SDK behavior where one fits. Keep one owner for keyboard, pointer,
and agent actions. Use the family's StyleX tokens and density choices and export the supported API from its public
entry.

## A UI SDK component first

Wrap the SDK component when one names the interaction, and add only the Elements styling and the supported props.

| The interaction                                 | Start from                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A row of controls with one Tab stop             | `@ui-sdk/react/toolbar`, as `packages/collections/src/control-toolbar.tsx`               |
| One choice from a short row                     | `@ui-sdk/react/segmented-control`, as `packages/forms/src/selection.tsx`                 |
| Choosing, dropping or pasting files             | `@ui-sdk/react/file-input`, as `packages/forms/src/file-picker.tsx`                      |
| A typed date                                    | `@ui-sdk/react/date-input`, as `packages/forms/src/dates/date-inputs.tsx`                |
| A region that follows new content to its end    | `@ui-sdk/react/scroll-area`, as `packages/ai/src/conversation.tsx`                       |
| Rows or cells with one Tab stop and a selection | `createGridFocus` and `createSelection`, as `packages/collections/src/table-results.tsx` |
| A long list that renders only what shows        | `createVirtualizer`, as `packages/collections/src/use-table-window.ts`                   |

A control that can sit in a toolbar or outside one reads the toolbar around it, as `useToolbarButton` does. A part of
the SDK toolbar throws outside its root.

## A primitive of your own

When no UI SDK component fits, define one primitive beside the component and keep every rule of the interaction in it.
`packages/charts/src/chart.tsx` and `packages/core/src/route-link.tsx` are the references.

```tsx
import { createChange, definePrimitive } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

type RatingOptions = {
  readonly value?: number | undefined;
  readonly defaultValue?: number | undefined;
  readonly onValueChange?: ((value: number, details: ChangeDetails<'item-press'>) => void) | undefined;
};

const rating = definePrimitive({
  name: 'rating',
  options: { value: 'number', defaultValue: 'number', onValueChange: 'callback' },
  controlled: ['value'],
  state: (options: RatingOptions) => ({ value: options.value ?? options.defaultValue ?? 0 }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);

    return {
      setValue: (value: number, event?: Event) =>
        change('value', value, event === undefined ? { reason: 'item-press' } : { reason: 'item-press', event }),
    };
  },
  slots: (slot) => ({
    root: slot({ role: 'group' }),
    star: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { key }) => ({ 'data-filled': Number(key) <= state.value ? '' : undefined }),
      press: ({ api, key }, event) => api.setValue(Number(key), event),
    }),
  }),
  agent: { actions: ['setValue'] },
});

const parts = createParts(rating, { root: 'div', star: 'button' });
```

- Name the primitive for what a reader calls it. An agent finds it by that name and by its accessible label.
- State an application owns goes in `controlled`, and every change to it goes through `createChange` with a reason and
  the event, leaving `event` out when there is none. Use `dispatch` for a request that is not state, such as asking the
  application to select a record.
- Put the role on the slot with `role`, never in `attrs`. Attribute values are strings. Style states through the data
  attributes the slot writes, such as `':is([data-filled])'` in StyleX.
- Always write the `agent` key. A component an agent only reads declares `agent: { actions: [] }`. One whose value is
  always one of its items adds `closed: true`, and returns the items as data when they are not rendered.
- Give a composite one Tab stop and move a cursor inside it. A press on a part leaves focus on the composite.
- Merge incoming props with `mergeProps` from `@ui-sdk/react/primitive`, with the StyleX output first.
- Keep the `definePrimitive` result private to its module. Export typed parts or a hook with an explicit return type,
  because the package build cannot name the primitive's inferred type.

Give interactive components a meaningful accessible name. Advertise actions only when the visible control can perform
them. Derive visible items and readings from the authorized data currently on screen. Route actions through the same
selection, navigation, or submit callback used by a person. The application supplies permissions, pending state,
accepted results, and errors. A requested change to a controlled value is complete when the owner supplies the new
state.

Check a representative task in the family story with keyboard and the public `/agent` bridge. Check what the agent sees
once the control is disabled, its selection changes, or its data is loading. For sensitive controls also inspect
compound snapshots and action results for private values. Update the page recipe if the preferred consumer composition
changes.

## A chart

Read contract `workspaces/core/.contracts/140-ui-data-display/CONTRACT.md` and the chart guide
`workspaces/core/docs/ui-charts.md` first. Copy the structure of `packages/charts/src/trend/curve-chart.tsx` and its
story.

1. Choose the family by the reader's question. A chart that no family fits needs a new kernel part first, and only when
   a named chart needs it. Add the part to `packages/charts/src/plot` or `figure`, keep the edit additive, and export it
   from `plot/index.ts`, which is the public kernel entry `@mechane-ai/elements/charts/plot`.
2. Draw with the kernel only: `numericPlot` or `categoryPlot`, `PlotSurface`, `PlotAxes`, `PlotClip` and the marks
   (`LineMark`, `AreaMark`, `BandMark`, `DotMark`, `BarMark`, `RuleMark`, `IntervalMark`, `LabelMark`, `SymbolMark`,
   `RingMark`, `LinkMark`, `ConnectorMark`, `GuideMark`). Do not write a scale, a tick, an axis or a path again, and do
   not restyle a mark. The marks carry the channel meanings.
3. Take `FigureProps`, plus `FigureSelectionProps` when a record can be selected. Name state the way the others do:
   `selected` with `onSelectedChange`, `range` with `onRangeChange`. No `format*` function props: use `PlotAxis`,
   `valueFormat` and `timeFormat`, and write text with `formatValue` and `formatTime`. `locale` is required. Height is a
   `PlotHeight`.
4. Write ticks with `axisTicks` or `timeAxisTicks` and `tickTexts` from `plot`, and place labels with `freeLabelSpot`.
   Give `FigureFrame` a `seriesLegend` for a legend that names things (above the plot) and a `scaleLegend` for a color
   or size scale (below it). Resolve tones with `useTones()` and never hard-code a color. Spread `useLinkedInspection()`
   into `Chart` when item ids mean the same thing in other charts.
5. Validate first and return `FigureInvalid` with the reason. Never repair, clamp, reorder or drop. Refuse input above a
   `<chart>Limits` object with a message that names it. Handle `status`, empty input and `coverage`.
6. Keep every prop except callbacks and `ReactNode` slots plain JSON, then register the chart so a figure spec can name
   it. In `packages/charts/src/spec/figure-spec.ts`, add its props to `FigureChartProps`, and a new family to
   `FigureFamily`. In `spec/figure-registry.tsx`, add an entry with the component, its family, its required props with
   their JSON kinds and `isSelectable`. Render the chart from its spec and compare it with the direct call.
7. Keep statistics out. If the chart needs a bin, quantile, density or fit, add a named function to
   `packages/charts/src/transforms` with a `describe...` footnote, and take the result as props.
8. Add a guide entry in `spec/chart-guide.tsx`: the `question` the chart answers in a reader's words, `use` for when to
   choose it, `avoid` for the chart that is better otherwise, and a small valid `example` spec. Build the data with the
   helpers in `spec/guide-data.ts` where they fit. The types require one entry for every registered chart. The entry
   feeds the wall. Write the chart into the chooser tables of the package `README.md`, `docs/ui-charts.md` and the
   `use-elements` charts reference, which are the guide written out.
9. Write the stories: `Charts/<ChartName>` with a default, an interactive story and a `States` story, in `en-US` with
   deterministic data.
10. Check the wall. `Charts/Wall`, in `spec/wall.stories.tsx`, draws every registered chart from its guide example
    through `Figure`, so the new chart appears in its family story and in `All` with no further edit. A new family also
    needs a title and a place in the wall's list. Review it in light and dark themes and at phone width. Inspect a
    record by pointer, touch and keyboard. Compare the frame, axes, ticks, legend, readout, footnote and each state with
    its neighbors.
11. Add the chart to the family `index.ts`, with its types and its limits. Run `mise run fix` and `mise run check` from
    the factory root.

## A kit component

A kit under `packages/kits/src/<kit>` composes charts and collections for a domain question. It adds no marks, scales,
axes or colors. If you want to draw an SVG mark, use or request a chart instead.

- Follow contract `workspaces/core/.contracts/141-ui-domain-kits/CONTRACT.md`. Import other families only through their
  public `index.ts` entries.
- Take `locale` and declared formats. Take the state the application owns as a value with a change callback. Take the
  words as one partial `labels` prop with English defaults.
- Use one `ToneScope` over the things shown in more than one figure, and one `ChartLink` or `ChartGrid` where figures
  share ids. Use the table cells from `charts/cells` inside `DataTable` columns.
- Handle `status`, empty, partial and invalid input. Refuse bad input with a sentence.
- Compute no statistic. The application supplies means, intervals, ranks and deltas.
- Write one stories file titled `Kits/<Kit name>` with a story per component, one page that composes them and a `States`
  story. Export the components from the kit's `index.ts` and add the entry to `package.json`.

## A teaching part

The teaching layers live in `packages/teaching/src`: `lesson`, `time`, `scene`, `article`, `mdx`, `spec` and `agent`.
Read contract `workspaces/core/.contracts/142-ui-teaching-layers/CONTRACT.md` first. A part an essay keeps drawing by
hand, with `SceneCustom` or raw SVG, is a candidate.

- Put a scene part in the scene folder that owns its kind: `scene/plane` for coordinate marks, `scene/shapes` for cards,
  cells and tokens, `scene/flow` and `scene/morph`, or the folder root for a core part. Copy `scene/scene-node.tsx` for
  a part on the HTML layer, or `scene/scene-bracket.tsx` for an SVG one.
- Register the object with `useSceneObject` and draw from the eased values it returns. Never start a frame loop, a timer
  or a keyframe: the one clock in `time/clock.ts` moves everything, and reduced motion takes the end state.
- Give it a stable `id`, `isShown`, a `label` that makes it a keyboard item, `tone` resolved through the tone scope, and
  a `labels` prop for its own words. Report author errors with `problem`, not by throwing.
- Inside `packages/teaching/src`, import the defining file, never a folder's `index.ts`. Export the part from its
  folder's `index.ts`, which is the public entry.
- Add it to `explainerParts` and the guide in `spec/explainer-guide.ts` with the reader's `question`, `guidance` that
  names the better part otherwise, and an `example` that compiles. Add it to `essayComponents` in
  `mdx/essay-components.ts` so MDX essays can use it.
- Write `Teaching/<Name>` stories beside it: a default with synthetic machine-learning content said to be synthetic,
  states, narrow and reduced motion. Describe it in the `write-explainer` skill's scene references.
