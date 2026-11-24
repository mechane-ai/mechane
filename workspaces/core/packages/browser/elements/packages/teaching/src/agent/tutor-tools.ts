import type { LessonProgress } from '../article/progress-store.ts';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import { describeLesson, writtenValue } from '../spec/describe-lesson.ts';
import type { LessonOutline } from '../spec/describe-lesson.ts';
import {
  changesBetween,
  fieldMap,
  isLessonEntry,
  lessonValueOf,
  nextFrame,
  progressEntry,
  progressOf,
  readLesson,
} from './lesson-bridge.ts';
import type { AnswerSources, LessonAgent, LessonReading, TutorChange } from './lesson-bridge.ts';

/** A tool input property as JSON Schema. */
export type TutorSchemaProperty = {
  readonly type: string | ReadonlyArray<string>;
  readonly description: string;
  readonly enum?: ReadonlyArray<string> | undefined;
};

/** A tool's input as JSON Schema: an object with named properties. */
export type TutorSchema = {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, TutorSchemaProperty>>;
  readonly required: ReadonlyArray<string>;
};

/** The current beat's tutor notes. They are for the tutor and are never shown to the reader. */
export type TutorNotes = {
  readonly goal: string | null;
  readonly misconception: string | null;
  readonly hints: ReadonlyArray<string>;
};

/**
 * Where the reader is: the beat and reveal step, every value as a number and as the reader reads it. A value a
 * prediction the reader has not committed takes its answer from is left out.
 */
export type ReaderPlace = {
  readonly beat: { readonly id: string; readonly title: string; readonly number: number; readonly of: number } | null;
  readonly step: number;
  /** The last reveal step of the beat. */
  readonly steps: number;
  /** The param whose player is running, or null. */
  readonly playing: string | null;
  readonly values: Readonly<Record<string, LessonValue>>;
  /** Each value written in its declared format, as the page shows it. */
  readonly written: Readonly<Record<string, string>>;
  readonly notes: TutorNotes;
  /**
   * What the reader has done, from the article's `lesson-progress`: committed predictions with their answers, reached
   * challenges, hints used and beats visited. Null where the page has no article.
   */
  readonly progress: LessonProgress | null;
  /** The values left out until the reader commits the prediction that takes its answer from each. */
  readonly withheld: ReadonlyArray<string>;
};

/** What a tutor tool returns: plain JSON that says what changed, or why nothing could. */
export type TutorResult =
  | {
      readonly kind: 'ok';
      readonly changed?: ReadonlyArray<TutorChange> | undefined;
      readonly at?: { readonly beat: string | null; readonly step: number } | undefined;
      readonly place?: ReaderPlace | undefined;
      readonly outline?: LessonOutline | undefined;
      readonly note?: string | undefined;
    }
  | { readonly kind: 'error'; readonly message: string };

/** A tool a model can call: its name, what it does, its input as JSON Schema, and the function that runs it. */
export type TutorTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TutorSchema;
  readonly run: (input?: unknown) => Promise<TutorResult>;
};

type BridgeStep = { readonly action: string; readonly args: ReadonlyArray<unknown> };

const NOT_ON_PAGE = 'is not on the page for the agent: it has not rendered yet, or it is read-only or hidden.';
const PAUSED = 'Paused. Every value holds where the player left it.';
const UNCHANGED = 'Nothing changed: the lesson already showed this, or the application refused the change.';

function schema(
  properties: Readonly<Record<string, TutorSchemaProperty>> = {},
  required: ReadonlyArray<string> = [],
): TutorSchema {
  return { type: 'object', properties, required };
}

function textInput(input: unknown, key: string): string | undefined {
  const value = fieldMap(input).get(key);

  return typeof value === 'string' ? value : undefined;
}

/**
 * Tools a tutor model can call beside a reader. They read the outline and where the reader is, set params, show states,
 * move between beats, play, pause and inspect figures. Every tool acts through the UI SDK agent bridge, and none
 * reveals a prediction's answer before the reader commits it.
 */
export function tutorTools({
  agent,
  lesson,
  locale,
  article = lesson.title,
  answers = {},
}: {
  readonly agent: LessonAgent;
  readonly lesson: AnyLesson;
  readonly locale: string;
  /** The title of the article whose progress to read. Defaults to the lesson's title, or the page's only article. */
  readonly article?: string | undefined;
  /** The lesson value each `Predict` takes its answer from, by its id. Tools withhold it until the reader commits. */
  readonly answers?: AnswerSources | undefined;
}): ReadonlyArray<TutorTool> {
  const missing: TutorResult = { kind: 'error', message: `The lesson "${lesson.title}" ${NOT_ON_PAGE}` };

  function progress(): LessonProgress | null {
    const entry = progressEntry(agent, article);

    return entry === undefined ? null : progressOf(entry['progress']);
  }

  /** The values an uncommitted prediction takes its answer from. */
  function withheld(committed: LessonProgress | null): ReadonlySet<string> {
    return new Set(
      Object.entries(answers).flatMap(([id, name]) =>
        committed !== null && Object.hasOwn(committed.predictions, id) ? [] : [name],
      ),
    );
  }

  function shown<T>(record: Readonly<Record<string, T>>, hidden: ReadonlySet<string>): Readonly<Record<string, T>> {
    return Object.fromEntries(Object.entries(record).filter(([name]) => !hidden.has(name)));
  }

  function placeOf(reading: LessonReading): ReaderPlace {
    const index = lesson.beats.findIndex((beat) => beat.id === reading.beat);
    const beat = lesson.beats[index];
    const committed = progress();
    const hidden = withheld(committed);
    const values = shown(reading.values, hidden);

    return {
      beat: beat === undefined ? null : { id: beat.id, title: beat.title, number: index + 1, of: lesson.beats.length },
      step: reading.step,
      steps: beat?.steps ?? 0,
      playing: reading.playing,
      values,
      written: Object.fromEntries(
        Object.entries(values).map(([name, value]) => [name, writtenValue({ lesson, name, value, locale })]),
      ),
      notes: { goal: beat?.goal ?? null, misconception: beat?.misconception ?? null, hints: beat?.hints ?? [] },
      progress: committed,
      withheld: [...hidden],
    };
  }

  async function act(steps: ReadonlyArray<BridgeStep>, unchanged: string = UNCHANGED): Promise<TutorResult> {
    const before = readLesson(agent, lesson);

    if (before === undefined) {
      return missing;
    }

    const result = await agent.act({
      steps: steps.map((step) => ({ ref: before.ref, action: step.action, args: [...step.args] })),
    });

    await nextFrame();

    const after = readLesson(agent, lesson) ?? before;
    const hidden = withheld(progress());
    const changed = changesBetween(before, after).filter((change) => !hidden.has(change.name));

    if (!result.ok) {
      return { kind: 'error', message: result.error?.message ?? 'The bridge refused the step.' };
    }

    return {
      kind: 'ok',
      changed,
      at: { beat: after.beat, step: after.step },
      ...(changed.length === 0 && { note: unchanged }),
    };
  }

  const paramNames = Object.keys(lesson.params);
  const beatIds = lesson.beats.map((beat) => beat.id);
  const stateIds = [...new Set(lesson.beats.flatMap((beat) => (beat.states ?? []).map((state) => state.id)))];

  return [
    {
      name: 'read_outline',
      description:
        'Reads the lesson as plain JSON: its params with ranges, derived values with what they read, and beats with tutor notes and states. Call it once at the start.',
      inputSchema: schema(),
      run: async () => ({ kind: 'ok', outline: describeLesson(lesson) }),
    },
    {
      name: 'read_place',
      description:
        "Reads where the reader is now: the beat and reveal step, every value as a number and as written on the page, the current beat's tutor notes, and the reader's progress. Prediction answers stay hidden until the reader commits.",
      inputSchema: schema(),
      run: async () => {
        const reading = readLesson(agent, lesson);

        return reading === undefined ? missing : { kind: 'ok', place: placeOf(reading) };
      },
    },
    {
      name: 'set_param',
      description:
        'Sets one param, as the agent. A number must be in its range, a choice takes an option id or label, a toggle takes true or false. Returns what changed.',
      inputSchema: schema(
        {
          name: { type: 'string', description: 'The param to set.', enum: paramNames },
          value: { type: ['number', 'string', 'boolean'], description: 'Its new value.' },
        },
        ['name', 'value'],
      ),
      run: async (input) => {
        const name = textInput(input, 'name');
        const fields = fieldMap(input);

        return name === undefined || !fields.has('value')
          ? { kind: 'error', message: 'set_param needs name, a param name, and value.' }
          : await act([{ action: 'setParam', args: [name, fields.get('value')] }]);
      },
    },
    {
      name: 'set_params',
      description:
        'Sets several params at once, as the agent, in one change, so the page never shows a mix of old and new values. Each value follows the rules of set_param.',
      inputSchema: schema(
        {
          values: { type: 'object', description: `Param names to their new values. Params: ${paramNames.join(', ')}.` },
        },
        ['values'],
      ),
      run: async (input) => {
        const values = fieldMap(fieldMap(input).get('values'));

        return values.size === 0
          ? { kind: 'error', message: 'set_params needs values, an object of param names to values.' }
          : await act([{ action: 'setParams', args: [Object.fromEntries(values)] }]);
      },
    },
    {
      name: 'show_state',
      description:
        'Shows a state a beat declares in one change: the values it names are set and the rest return to their opening values. Use it to show the reader an example the author prepared.',
      inputSchema: schema({ state: { type: 'string', description: 'The state id.', enum: stateIds } }, ['state']),
      run: async (input) => {
        const state = textInput(input, 'state');

        return state === undefined
          ? { kind: 'error', message: 'show_state needs state, a state id.' }
          : await act([{ action: 'showState', args: [state] }]);
      },
    },
    {
      name: 'go_to_beat',
      description: 'Moves the lesson to a beat, at its first reveal step unless step says otherwise.',
      inputSchema: schema(
        {
          beat: { type: 'string', description: 'The beat id.', enum: beatIds },
          step: { type: 'number', description: 'The reveal step, from 0. Defaults to 0.' },
        },
        ['beat'],
      ),
      run: async (input) => {
        const beat = textInput(input, 'beat');
        const step = fieldMap(input).get('step') ?? 0;

        return beat === undefined
          ? { kind: 'error', message: 'go_to_beat needs beat, a beat id.' }
          : await act([{ action: 'setBeat', args: [beat, step] }]);
      },
    },
    {
      name: 'next',
      description: 'Shows the next reveal step, or the next beat at its first step.',
      inputSchema: schema(),
      run: async () => await act([{ action: 'next', args: [] }]),
    },
    {
      name: 'previous',
      description: 'Hides the last reveal step, or goes back to the previous beat with every step shown.',
      inputSchema: schema(),
      run: async () => await act([{ action: 'previous', args: [] }]),
    },
    {
      name: 'play',
      description: 'Starts the player of a number param, or the only player when the lesson has one.',
      inputSchema: schema({ name: { type: 'string', description: 'The param whose player starts.' } }),
      run: async (input) => {
        const name = textInput(input, 'name');

        return await act([{ action: 'play', args: name === undefined ? [] : [name] }]);
      },
    },
    {
      name: 'pause',
      description: 'Stops the player that is running.',
      inputSchema: schema(),
      run: async () => await act([{ action: 'pause', args: [] }], PAUSED),
    },
    {
      name: 'inspect_figure',
      description:
        "Points at one object of a figure by its id, opening the figure's readout as a reader's hover would. Name the figure by its title.",
      inputSchema: schema(
        {
          figure: { type: 'string', description: 'The title of the figure.' },
          id: { type: 'string', description: 'The id of the object in the figure.' },
        },
        ['figure', 'id'],
      ),
      run: async (input) => {
        const figure = textInput(input, 'figure');
        const id = textInput(input, 'id');

        if (figure === undefined || id === undefined) {
          return { kind: 'error', message: 'inspect_figure needs figure, a title, and id, an object id.' };
        }

        const entry = agent.snapshot().find((item) => item.label === figure && !isLessonEntry(item, lesson));

        if (entry === undefined) {
          return { kind: 'error', message: `No figure titled "${figure}" is on the page for the agent.` };
        }

        if (!entry.actions.includes('inspect')) {
          return {
            kind: 'error',
            message: `The ${entry.component} "${figure}" offers agents ${entry.actions.length === 0 ? 'no actions' : entry.actions.join(', ')}, not inspect.`,
          };
        }

        const before = lessonValueOf(entry['inspected']);
        const result = await agent.act({ steps: [{ ref: entry.ref, action: 'inspect', args: [id] }] });

        await nextFrame();

        const after = lessonValueOf(agent.snapshot().find((item) => item.ref === entry.ref)?.['inspected']);

        return result.ok
          ? { kind: 'ok', changed: before === after ? [] : [{ name: `${figure} inspected`, from: before, to: after }] }
          : { kind: 'error', message: result.error?.message ?? 'The bridge refused the step.' };
      },
    },
  ];
}
