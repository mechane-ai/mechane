# The plan format

`LessonPlan` is exported as a type from `@mechane-ai/elements/lesson/spec`. A plan is plain JSON, so a model can write
it and `validateLessonPlan(input: unknown)` can check it. Its params and beats are the shapes `defineLesson` takes.

## Fields

| Field      | Holds                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| `id`       | The lesson id, such as `"card-neuron"`. It names the lesson in the agent bridge and in storage keys. |
| `title`    | The essay's title, a claim rather than a topic where possible.                                       |
| `audience` | Who reads it and what they already know.                                                             |
| `idea`     | The one sentence the reader should leave with.                                                       |
| `params`   | Values the reader changes, by name.                                                                  |
| `derived`  | Values computed from the params, by name, in computing order. Optional.                              |
| `beats`    | The steps of the argument, in reading order. At least one.                                           |

A param is one of three kinds:

```json
{
  "rate": {
    "kind": "number",
    "label": "Learning rate",
    "value": 0.1,
    "min": 0.05,
    "max": 1.2,
    "step": 0.05,
    "format": { "maximumFractionDigits": 2 }
  },
  "token": {
    "kind": "choice",
    "label": "Followed token",
    "value": "cat",
    "options": [
      { "id": "cat", "label": "cat" },
      { "id": "dog", "label": "dog" }
    ]
  },
  "isMasked": { "kind": "toggle", "label": "Causal mask", "value": false }
}
```

- `value` is the opening value. It must lie in the range or be one of the option ids.
- `format` is `Intl.NumberFormat` options. Use `{ "style": "percent" }` for shares, and
  `{ "style": "unit", "unit": "bit" }` for units `Intl` knows.
- `scale: "log"` gives each tenfold the same drag distance. It needs `min` above zero.
- Name a toggle as a question that is true or false: `isMasked`, `hasBias`.

A derived value names what it reads and its formula in words. The code comes later, in `defineLesson`:

```json
{
  "sum": {
    "label": "Weighted sum",
    "format": { "maximumFractionDigits": 1 },
    "reads": ["hand", "heartWeight", "spadeWeight", "bias"],
    "formula": "heart rank × heart weight + spade rank × spade weight + bias"
  }
}
```

A beat is a `LessonBeat` with two planning fields:

| Field           | Holds                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `id`, `title`   | The beat's id, used by `<Beat id>`, and its heading.                                                   |
| `goal`          | One sentence the reader can say after the beat. A tutor reads it; the reader never sees it.            |
| `misconception` | The wrong belief the beat corrects. Tutor note.                                                        |
| `hints`         | Sentences a tutor or a `Challenge` gives, in order. Tutor note.                                        |
| `steps`         | Reveal steps after the first view, for the present view. Defaults to 0.                                |
| `states`        | `{ id, label, values }` each. `values` set params only. The first opens the static and present views.  |
| `figure`        | `{ part, question, shows? }`: a part from `explainerParts` or a chart name, and the reader's question. |
| `ask`           | `{ kind: "predict" \| "challenge", prompt }`.                                                          |

Read the parts and their questions from Node:

```sh
node --input-type=module -e "
import { explainerGuide } from '@mechane-ai/elements/lesson/spec';
for (const entry of explainerGuide) console.log(entry.part + ': ' + entry.question);
"
```

Charts are listed with their questions in `chartGuide` from `@mechane-ai/elements/charts/figure`. A beat's figure is a
chart when the picture is data on axes, and a scene part when it is things and their connections.

## What the validator says

These are real messages for a plan that has the common mistakes:

```text
error params.temperature.min - A log scale needs min above zero. Use a linear scale, or start at a small positive value.
error derived.weights.reads - "weights" reads "scores", which is declared after it. defineLesson computes in order, so move "scores" above it.
error beats[0].figure.part - "AttentionDiagram" is not a teaching part or a chart. Choose a part from explainerGuide or a chart from chartGuide.
error beats[1].states[0].values.weights - "weights" is a derived value; a state sets params only, and the derived values follow.
error beats[2].figure.shows - "mask" is not a param or a derived value.
advice beats[0].goal - Beat "overview" has no goal. Add one sentence the reader should be able to say after it.
advice beats[0].states - Beat "overview" introduces 3 new params (temperature, heads, isMasked). Introduce one per beat, so the reader can tell what each one does.
advice beats - None of the first three beats asks for a prediction or a challenge. Add a Predict early, so the reader commits to a guess.
advice beats[1].figure - This beat shows no figure. Give it one, or fold its prose into the beat before.
advice derived.weights - No figure shows "weights" and no value reads it. List it in a figure's shows, or remove it.
```

The advice also names a param that no state moves, and a run of more than seven beats with no beat titled "Recap".

## From the plan to the lesson

Copy `params` and each beat's `id`, `title`, `goal`, `misconception`, `hints`, `steps` and `states` into `defineLesson`
as TypeScript literals. Leave `figure` and `ask` in the plan: they become `<Figure>`, `Predict` and `Challenge` in the
essay. Write each derived value's `from` as a pure function of the names in its `reads`. Do not import `plan.json` into
`defineLesson`: JSON widens `"kind": "number"` to a string, and the lesson loses its types.

Keep `plan.json` beside the essay. When the argument changes, change the plan first and run the validator again.
