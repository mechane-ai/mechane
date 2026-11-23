# Figures as JSON

A figure spec names one chart and its props as plain JSON. An agent or a server writes it, `validateFigureSpec` checks
it and `Figure` draws it. Use it when the figure comes from data that is not code: a model's answer, a saved report or
an API response.

```tsx
import {
  Figure,
  chartGuide,
  describeFigure,
  figureCharts,
  validateFigureSpec,
} from '@mechane-ai/elements/charts/figure';
import type { FigureSpec } from '@mechane-ai/elements/charts/figure';
```

| Export               | What it is                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `FigureSpec`         | The spec type: a union with one member per registered chart. `FigureSpecOf<'Histogram'>` is one.     |
| `validateFigureSpec` | Checks the structure of any input. Returns `{ kind: 'ok', spec }` or `{ kind: 'invalid', message }`. |
| `Figure`             | Draws a spec. It takes `selected`, `onSelectedChange` and `status` beside it.                        |
| `describeFigure`     | Returns the figure as short plain text.                                                              |
| `figureCharts`       | `{ chart, family }` for each of the 50 registered charts.                                            |
| `chartGuide`         | One entry per registered chart: `question`, `use`, `avoid`, `family` and a valid `example` spec.     |

## The shape

A `FigureSpec` is `{ chart, props }`. The type is a union with one member for each registered chart, so
`chart: 'Histogram'` goes with the props of `Histogram`, and a TypeScript caller gets the right props for the name.

- `chart` is the exact name of a registered chart, such as `"Histogram"`. The charts and what each answers are in
  [charts](charts.md), and in `chartGuide`.
- `props` are that chart's props, minus what JSON cannot carry: callbacks (`on...`), React slots such as `actions` and a
  function format. Read the chart's declaration file for its props.
- Every spec needs `title` and `locale` in `props`, plus the props the chart cannot draw without.
- A format is an `Intl` options object. A `TimeFormat` names its `timeZone`.
- `ColorLegend`, the table cells, the placeholders and the kits are not registered, so a spec cannot name them.

## Start from the guide

`chartGuide` is the same guidance as the chooser in [charts](charts.md), as data. Read it to pick a chart and to start
from a spec that is known to be valid.

```ts
const entry = chartGuide.find((item) => item.chart === 'DumbbellPlot');

// entry?.question: "How much did each row change between two measurements?"
// entry?.use, entry?.avoid, entry?.family
// entry?.example is a FigureSpec to copy and change.
```

## Write one

```json
{
  "chart": "Histogram",
  "props": {
    "title": "Request latency",
    "description": "Synthetic requests over one hour, in 25 ms bins.",
    "locale": "en-US",
    "source": "Synthetic trace",
    "transforms": ["Binned at 25 ms"],
    "value": { "label": "Latency (ms)", "format": { "maximumFractionDigits": 0 } },
    "count": { "label": "Requests", "format": { "maximumFractionDigits": 0 } },
    "bins": [
      { "id": "b0", "label": "0 to 25 ms", "lowerBound": 0, "upperBound": 25, "count": 120 },
      { "id": "b1", "label": "25 to 50 ms", "lowerBound": 25, "upperBound": 50, "count": 340 },
      { "id": "b2", "label": "50 to 75 ms", "lowerBound": 50, "upperBound": 75, "count": 180 },
      { "id": "b3", "label": "75 to 100 ms", "lowerBound": 75, "upperBound": 100, "count": null }
    ]
  }
}
```

The last bin has `"count": null`. The chart draws it hollow, not as zero.

## Check and draw it

```tsx
import { Notice } from '@mechane-ai/elements/feedback';
import { useState } from 'react';

function AgentFigure({ input }: { readonly input: unknown }) {
  const [selected, setSelected] = useState<string | null>(null);
  const result = validateFigureSpec(input);

  if (result.kind === 'invalid') {
    return <Notice hasError>{result.message}</Notice>;
  }

  return <Figure spec={result.spec} selected={selected} onSelectedChange={(id) => setSelected(id)} />;
}
```

`validateFigureSpec(input)` takes `unknown`, so it accepts parsed JSON. The check is structural and never throws. It
confirms:

- the input is an object with a `chart` string that is registered;
- `props` is an object holding every required prop of the chart, each with the right JSON kind;
- no value anywhere in `props` is a function;
- `locale`, when present, is a non-empty string.

It does not check the deeper values. Each chart checks its own values and shows an invalid figure with the reason. A
chart name that is not registered gets up to three close names:

```ts
validateFigureSpec({ chart: 'Histogramm', props: { title: 'Request latency', locale: 'en-US' } });
// { kind: 'invalid', message: '"Histogramm" is not a registered chart. Did you mean Histogram?' }

validateFigureSpec({ chart: 'Bar', props: {} });
// { kind: 'invalid', message: '"Bar" is not a registered chart. Did you mean BarChart, BreakdownBar, RankedBars?' }
```

Other messages state the first problem found:

| Input                           | `message`                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A `Histogram` with no `bins`    | ``Histogram needs the prop `bins` (an array).``                                                         |
| A `Histogram` with `count: 5`   | ``Histogram needs `count` as an object, not a number.``                                                 |
| A `Histogram` with `locale: ''` | ``Histogram needs `locale` as a non-empty string, such as "en-US".``                                    |
| A function inside `props`       | `A figure spec is plain JSON, and its props hold a function. Pass callbacks to Figure beside the spec.` |
| A string, an array or `null`    | ``A figure spec is an object with `chart` and `props`.``                                                |

`Figure` takes `spec: unknown` and these props beside it:

- `selected` and `onSelectedChange(id, details)` reach only the charts that take a selection. A press or Enter on a
  record calls `onSelectedChange`. Leave both out for a read-only figure. A `Waterfall` drawn without a callback still
  draws, and a press does nothing.
- `status` is `'ready'`, `'loading'` or `'refreshing'`, and replaces the spec's own `status` while newer data loads.

`Figure` runs `validateFigureSpec` itself. For a bad spec it draws the shared invalid figure, with the spec's `title`
and `locale` when they are strings, and the reason as its message. It never throws. Call `validateFigureSpec` first when
you want the message elsewhere, as above.

## Read it back as text

`describeFigure(spec)` returns a short plain-text account of a figure for a place that cannot draw it, such as a chat
transcript, a log or an agent reading its result back. It names the chart and its title, then the description, how much
of the data is drawn when `coverage` is set, the source, the transforms and how many records the spec holds. It does not
restate the values.

```ts
const text: string = describeFigure(result.spec);
```

For the spec above, `describeFigure` returns:

```text
A histogram, "Request latency", with 4 bins. Synthetic requests over one hour, in 25 ms bins. Source: Synthetic trace. Transforms: Binned at 25 ms.
```

With `"coverage": { "shown": 640, "total": 1200, "unit": "requests" }` added to `props`, it adds a sentence after the
description:

```text
A histogram, "Request latency", with 4 bins. Synthetic requests over one hour, in 25 ms bins. 640 of 1,200 requests shown. Source: Synthetic trace. Transforms: Binned at 25 ms.
```

These two texts came from running `describeFigure` on those specs.

## Rules for an agent that writes a spec

- Pick the chart from the question, with the chooser in [charts](charts.md) or `chartGuide`. Do not invent a chart name.
- Start from the chart's `example` in the guide when you can. It is a valid spec.
- Write only props the chart declares. Do not add a function, a color, a pixel height or a formatter.
- Use a declared format and a `locale`. Put the unit in the axis `label`. Write a time format as options with a
  `timeZone`, never as a function.
- Write a missing value as `null`. Never write it as zero.
- Put prepared values in the spec. Name each step you applied in `transforms` and the data's origin in `source`.
- Set `coverage` when the spec holds a sample or a window.
- Read the figure back after drawing it. The readout, the exact-value table and the invalid message state what was
  drawn.
