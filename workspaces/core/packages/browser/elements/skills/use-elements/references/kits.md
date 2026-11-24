# Kits

A kit is a small set of domain components built from the chart families. A kit chooses which figures answer a domain
question, arranges them, shares one tone scope and one linked inspection between them, and writes the words. It adds no
marks, colors or axes.

Import a kit from `@mechane-ai/elements/kits/<kit>`. Every component of the training, operations, evaluation and
interpretability kits:

- takes `locale` and declared formats, never pre-formatted numbers;
- takes the state it shows as a value with a change callback, such as `selected` with `onSelectedChange`;
- takes its visible words as `labels`, a partial object with English defaults;
- handles `status`, empty and invalid input, and refuses bad input with a sentence;
- computes nothing. The application supplies means, intervals, ranks and deltas, or calls
  `@mechane-ai/elements/charts/transforms` first. A list may sort and filter the rows it is given.

An explorable essay is not a kit: it uses the teaching layers in [teaching](teaching.md), which replace the old
explainers kit. The rules for kits are
[contract 141](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/.contracts/141-ui-domain-kits/CONTRACT.md).

| Kit              | Entry                    | Use it for                                                                   |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Training         | `/kits/training`         | Watching and comparing training runs.                                        |
| Operations       | `/kits/operations`       | The health, budgets and events of a service.                                 |
| Evaluation       | `/kits/evaluation`       | Ranking and comparing models on benchmarks.                                  |
| Interpretability | `/kits/interpretability` | Reading learned features, attribution, attention, logit lens and steering.   |
| Research         | `/kits/research`         | Tracking research milestones, paired specimen diffs, work reports, findings. |

## Training

For runs of one experiment. A run keeps one id and one hue in the dashboard, the table and every chart.

- `RunDashboard` draws one `CurveChart` panel per metric with one step cursor. It takes `runs`, `metrics`, `series`
  (metric id, then run id, then points in increasing step), a step axis `x`, `selected` with `onSelectedChange`, and
  `hidden` with `onHiddenChange`.
- `RunTable` is the table and the legend. It takes `title`, `runs`, `columns` for settings, `metrics` as `bar` or
  `spark` columns, `selected`, `hidden`, `sort` with `onSortChange` and `showOnlyDifferences`. Pressing a row asks to
  focus the run, or to clear the focus when it is already focused, so `onSelectedChange` receives an id or `null`.
- `RunsOverview` shows a whole sweep as gray lines with one highlighted run and a median band. Use it when there are
  more runs than hues. It takes `runs`, `x`, `y`, `summary` and `summaryText`.

A `RunRecord` is `{ id, label, state, detail?, tone? }`, with `state` one of `running`, `finished`, `failed` or
`stopped`. `runLimits.runs` is 12. The application supplies the prepared curves, smoothed or not, the settings per run
and the final results. It holds selection, hiding and sorting.

## Operations

For a service in production.

- `ServiceHealth` shows the service state in words, headline tiles with a trend, and time-series panels on one shared
  time axis. It takes `service`, `indicators`, `charts`, `timestampUnit`, `timeFormat` and `locale`. Give a chart series
  the same `id` as its indicator and the two share a hue.
- `BudgetBoard` shows objectives and budgets as bars against targets. It takes `groups` of rows that share a unit, each
  with a `value` axis, and `selected` with `onSelectedChange`.
- `IncidentTimeline` shows deploys, alerts and incidents in three lanes over a `window`. It takes `events`, a
  `timeFormat` that names its time zone, and `selected` with `onSelectedChange`.

The application judges every state and writes its words. Nothing here works out health from a number or a color.

## Evaluation

For models compared on benchmarks. Every model has one id, `EvaluationModel` `{ id, label, detail?, tone? }`.

- `Leaderboard` is a ranked table of models over measure columns. A column has a `kind` of `score`, `interval`,
  `change`, `trend` or `heat`, a `format`, `isHigherBetter` and, except for `change`, a shared `domain`. It takes
  `models`, `columns`, `rows`, `sort` with `onSortChange` and `selected` with `onSelectedChange`. Here `selected` is the
  list of checked model ids, and the rows have no checkboxes without the callback. `leaderboardLimits` is 100 models and
  10 columns.
- `ScoreBreakdown` shows one benchmark by category with a dot per model and an optional interval. It takes `models`,
  `categories`, `scores`, `value` and `selected`.
- `ModelComparison` shows two models head to head: a dumbbell per benchmark and a table of differences. It takes `a`,
  `b`, `rows`, `value`, `isHigherBetter` and `differenceFormat`. Each difference is B minus A.

A score is a number, an estimate with its interval `{ value, low, high }`, or `null` where it was not measured. The
application supplies the ranks, intervals, differences and tests. Resting on a leaderboard row marks that model in the
linked figures.

## Interpretability

For reading what a model learned and how it computes an answer. A feature, such as a sparse autoencoder latent, keeps
one id in the list, the card, the map and the attribution graph, so resting on it in one place lights it in the others.
A kit that holds several figures shares one tone scope and one chart link. The application supplies every activation,
attribution, attention weight and decoded layer. No component runs a model. A `FeatureSummary` is
`{ id, label, source?, explanation?, frequency? }`, and `featureLimits` is 5000 features and 8 search matches. Each
change callback receives `details` with a `reason` of `press`, `input` or `imperative`.

- `FeatureCard` answers "what is this feature?": its name, id and explanation, how often it fires, the contexts that
  activate it most, and the output tokens it promotes and suppresses. It takes `feature` and, each optional, `density`
  (`bins`, a `value` axis and a `count` axis), `examples` (`examples`, a `domain`, `valueFormat`, optional `palette` and
  `context`) and `logits` (`tokens` of `{ id, token, value }` and a `value` axis). It leaves out what is absent. Use
  `size="compact"` in grids and side panels, `actions` for controls beside the name, and `frequencyFormat` for the
  share. It owns no state.
- `FeatureList` answers "which features exist, and which one should I open?" as a sortable, searchable table. Each row
  is a `FeatureSummary` with optional `maxActivation` and a `profile`, one value per layer. It takes `title`,
  `features`, `frequencyDomain` (starts at zero), `frequencyFormat`, `activationFormat` and optional `profileDomain`.
  The application holds `selected` with `onSelectedChange`, `query` with `onQueryChange` and `sort` with `onSortChange`.
  It filters and sorts the rows it is given, and refuses duplicate ids.
- `AttributionWorkbench` answers "which features carry the answer from the prompt to the output?" It is an
  `AttributionGraph` beside a panel for the node in focus. It takes the graph's props (`title`, `locale`, `layers`,
  `nodes`, `edges`, `weightLabel`, `weightFormat`, and optional `valueLabel`, `valueFormat` and `direction`) and
  `details`, a `FeatureCardData` per node id. The application holds `selected` with `onSelectedChange` and `pinned` with
  `onPinnedChange`. Pointing at a node shows its card, pressing keeps it, and pinning builds a subgraph. A key of
  `details` that is not a node is refused.
- `AttentionHeadGrid` answers "what does each head look at?" One attention pattern per head over the same tokens and the
  same 0 to 1 scale, with the selected head enlarged beside the lines from each token. It takes `title`, `tokens`,
  `heads` (`id`, `label`, optional `description`, `weights` with null for a masked pair), `mask` of `none` or `causal`,
  and `minPanelWidth`. The application holds `selected` (the enlarged head) with `onSelectedChange` and `pair`, the
  token pair every head marks, with `onPairChange`. Its id is `matrixCellId(destination, source)`: the token that
  attends, then the token attended to. Left out, `pair` is kept by the grid. It draws at most 32 heads
  (`attentionHeadLimits`). Weights show where a head reads from, not what it computes.
- `LogitLens` answers "at which layer does the answer form?" A grid of the model's top next-token guess at every layer
  and prompt position, shaded by probability, and a curve of chosen tokens by layer for the selected position. It takes
  `title`, `columns` (the prompt tokens), `layers` (`id`, `label`, `depth`), `cells` (the top prediction and probability
  per layer and position), optional `tracks` (`id`, `columnId`, `token` and one probability per layer) and
  `valueFormat`. The application holds `selected`, a cell id from `tokenGridCellId(layerId, columnId)`, with
  `onSelectedChange`, and decodes every layer.
- `EmbeddingAtlas` answers "where is a feature on the map, and what is it?" An `EmbeddingMap` with a search box, a list
  of matches and a card for the open feature. It takes the map's props (`title`, `points`, `groups`, `x`, `y` and the
  others), `landmarks` (`id`, `x`, `y`) and `details`, a `FeatureCardData` per landmark id. The application holds
  `query` with `onQueryChange` and `selected` with `onSelectedChange`, and projects the points. A landmark with no
  details is refused.
- `SteeringPanel` answers "what does the model do when I change a feature's strength?" A slider per feature beside
  next-token predictions, with a tick for each token before steering, and optionally the text before and after. It takes
  `title`, `features` (`id`, `label`, `min`, `max`, `step`, optional `neutral` and `description`), `values` by feature
  id, `predictions` (each with a `baseline`), and optional `prompt`, `completions` (`baseline`, `steered`) and
  `strengthFormat`. The application holds `values` with `onValuesChange`, which Reset also calls with every neutral
  strength, and generates the outputs for the current setting.

```tsx
import { FeatureCard, FeatureList } from '@mechane-ai/elements/kits/interpretability';

<FeatureList
  title="Layer 20 features"
  locale="en-US"
  features={[
    { id: 'f-1', label: 'Golden Gate Bridge', frequency: 0.0004, maxActivation: 9.2 },
    { id: 'f-2', label: 'Suspension bridges', frequency: 0.0011, maxActivation: 6.8 },
  ]}
  frequencyDomain={[0, 0.002]}
  frequencyFormat={{ style: 'percent', maximumFractionDigits: 2 }}
  activationFormat={{ maximumFractionDigits: 1 }}
  selected={openFeature}
  onSelectedChange={(id) => setOpenFeature(id)}
/>;

<FeatureCard locale="en-US" size="compact" feature={{ id: 'f-1', label: 'Golden Gate Bridge', frequency: 0.0004 }} />;
```

## Put a kit on a page

The dashboard and the table each keep a tone scope over `runs`, so a run has one hue in both. The application holds
selection and hiding and passes them to both.

```tsx
import { RunDashboard, RunTable } from '@mechane-ai/elements/kits/training';

<>
  <RunDashboard
    title="Validation"
    locale="en-US"
    runs={runs}
    metrics={metrics}
    series={series}
    x={{ label: 'Training step', format: { maximumFractionDigits: 0 } }}
    selected={selected}
    onSelectedChange={(id) => setSelected(id)}
    hidden={hidden}
    onHiddenChange={(ids) => setHidden(ids)}
    hasLegend={false}
  />
  <RunTable
    title="Runs"
    locale="en-US"
    runs={runs}
    selected={selected}
    onSelectedChange={(id) => setSelected(id)}
    hidden={hidden}
    onHiddenChange={(ids) => setHidden(ids)}
  />
</>;
```
