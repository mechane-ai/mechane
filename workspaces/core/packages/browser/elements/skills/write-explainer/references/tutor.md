# Tutor

Import from `@mechane-ai/elements/lesson/agent`. A tutor is a model beside the reader that reads the lesson and moves it
through the UI SDK agent bridge, as `createAgent` from `@mechane-ai/elements/agent` exposes it. It acts with the same
actions a person's controls use, so the page cannot tell its changes apart except by their `agent` source.

## What an agent can and cannot do

- It reads the lesson's values, beat, step and player, the reader's progress, and each beat's tutor notes.
- It sets params, shows states, moves between beats, plays and pauses.
- It never commits a prediction, never reaches a challenge, and does not see a prediction's answer until the reader
  commits it. That is what keeps the reader's own guesses honest.
- Tutor notes (`goal`, `misconception`, `hints`) reach the tutor and never the reader. Write them for a tutor: what the
  reader should be able to say, the wrong belief to probe, and hints in the order to give them.

## Tools

`tutorTools({ agent, lesson, locale, article?, answers? })` returns tools a model calls: `read_outline`, `read_place`,
`set_param`, `set_params`, `show_state`, `go_to_beat`, `next`, `previous`, `play`, `pause` and `inspect_figure`. Each
has a `name`, a `description`, an `inputSchema` (JSON Schema) and `run(input)`, which resolves to
`{ kind: 'ok', changed?, at?, place?, outline?, note? }` or `{ kind: 'error', message }`.

`answers` maps each number `Predict` id to the lesson value it takes its answer from (its `answerFrom`), such as
`{ 'entropy-guess': 'entropy' }`. The tools withhold that value until the reader commits. Build it from the essay with
`answerSources(articleOutline(beats))`, both from `@mechane-ai/elements/article`, so it cannot drift from the markup; a
missing entry lets the tutor read the answer. The outline also lists the essay's `predictions` and `challenges`.

## The learner trace and tours

- `createLearnerTrace({ agent, lesson, article?, limit? })` records what the reader did: param moves, beat and step
  changes, plays, predictions, hints and challenges. Changes an agent makes are left out. `read()` returns a
  `LearnerRecord`; `subscribe`, `clear` and `stop` manage it.
- `summarizeTrace({ record, lesson, locale, answers? })` writes the record as a few sentences of facts for a prompt.
- A `LessonTour` is a list of steps `{ beat?, step?, state?, values?, say?, hold? }` with `hold` one of `'short'`,
  `'regular'`, `'long'`. `validateTour(tour, lesson)` checks it; `playTour({ agent, lesson, tour, onSay })` plays it on
  the shared clock and pauses when the reader acts. `tourFromTrace(record)` turns a recorded demonstration into a tour
  to edit.

This sample takes `lesson` and the `cardNeuronBeats` fragment from the [worked essay](worked-essay.md).

```ts
const agent = createAgent();

/**
 * The value each `Predict` takes its answer from, read from the beats, so the tools withhold it until the reader
 * commits.
 */
const answers = answerSources(articleOutline(cardNeuronBeats));

/** The tools a tutor model calls. */
export const tools = tutorTools({ agent, lesson, locale: 'en-US', answers });

/** Hand each tool to the model as a definition, and run the one it calls. */
export const definitions = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

export async function callTool(name: string, input: unknown): Promise<string> {
  const tool = tools.find((item) => item.name === name);
  const result = tool === undefined ? { kind: 'error', message: `No tool ${name}.` } : await tool.run(input);

  return JSON.stringify(result);
}

/** What the reader did, as facts for the tutor's prompt. */
export const trace = createLearnerTrace({ agent, lesson });

export function readerFacts(): string {
  return summarizeTrace({ record: trace.read(), lesson, locale: 'en-US', answers });
}

/** A guided walk. Check it before it plays; it pauses when the reader acts. */
export const tour: LessonTour = [
  { beat: 'hand', state: 'queen-seven', say: 'Two cards: the queen counts 12, the seven 7.', hold: 'regular' },
  { beat: 'weights', state: 'against', say: 'A negative weight makes the queen count against.', hold: 'long' },
  { beat: 'bias', values: { bias: -8 }, say: 'Now the neuron needs stronger evidence.' },
];

export function startTour(onSay: (line: string) => void): void {
  const findings = validateTour(tour, lesson);

  if (findings.length > 0) {
    throw new Error(findings.map((finding) => `${finding.path}: ${finding.message}`).join('\n'));
  }

  playTour({ agent, lesson, tour, onSay });
}
```

The tutor's own words go to the reader through your page, not through these tools. Show `onSay` lines and the model's
replies in a `Conversation` from `@mechane-ai/elements/ai`.

## From Node, without a page

`describeLesson(lesson)` (the lesson as JSON), `lessonWalk(lesson, locale)` (the lesson as text, every state with its
derived values written out) and `checkLesson(lesson)` come from `@mechane-ai/elements/lesson/spec` and need no browser.
A lesson file that imports only `defineLesson` loads in Node 22 directly:

```sh
node --input-type=module -e "
import { checkLesson, lessonWalk } from '@mechane-ai/elements/lesson/spec';
import { lesson } from './src/lesson.ts';
console.log(lessonWalk(lesson, 'en-US'));
for (const finding of checkLesson(lesson)) console.log(finding.severity, finding.path, finding.message);
"
```
