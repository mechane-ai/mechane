import type { AgentComponent, createAgent, ObservedChange } from '../../../foundations/src/agent/index.ts';
import type { LessonProgress, PredictionRecord } from '../article/progress-store.ts';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import { onFrame } from '../time/clock.ts';

/** The UI SDK agent bridge a tutor reads and acts through, as `createAgent()` returns it. */
export type LessonAgent = ReturnType<typeof createAgent>;

/** One value that changed: a param, a derived value, the beat or the reveal step. */
export type TutorChange = { readonly name: string; readonly from: LessonValue | null; readonly to: LessonValue | null };

/** The lesson as the bridge reports it now: where the reader is and every value. */
export type LessonReading = {
  /** The lesson's ref in the bridge, for `act` steps. */
  readonly ref: string;
  readonly beat: string | null;
  readonly step: number;
  /** The param whose player is running, or null. */
  readonly playing: string | null;
  /** Every param and derived value. */
  readonly values: Readonly<Record<string, LessonValue>>;
};

/**
 * The lesson value each `Predict` takes its answer from, by the `Predict` id, as its `answerFrom` prop names it. Tutor
 * tools withhold that value until the reader commits the prediction.
 */
export type AnswerSources = Readonly<Record<string, string>>;

/** The sources of changes a person makes with a pointer, a key or assistive technology. */
export const readerSources: ReadonlySet<string> = new Set(['mouse', 'touch', 'pen', 'keyboard', 'virtual']);

const LESSON_VALUE_TYPES: ReadonlySet<string> = new Set(['number', 'string', 'boolean']);

function isLessonValue(value: unknown): boolean {
  return LESSON_VALUE_TYPES.has(typeof value);
}

/** A bridge value as a lesson value, or null when it is not one. */
export function lessonValueOf(value: unknown): LessonValue | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'boolean' ? value : null;
}

/** Whether a value is a plain object, the shape JSON writes with braces. */
export function isPlainObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The fields of a plain object, or an empty map for anything else. */
export function fieldMap(value: unknown): ReadonlyMap<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? new Map<string, unknown>(Object.entries(value))
    : new Map<string, unknown>();
}

function guessOf(value: unknown): number | string | undefined {
  if (typeof value === 'number') {
    return value;
  }

  return typeof value === 'string' ? value : undefined;
}

function idsOf(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

/** The reader's progress a `lesson-progress` value holds, with anything it does not hold left empty. */
export function progressOf(value: unknown): LessonProgress {
  const fields = fieldMap(value);

  const predictions = [...fieldMap(fields.get('predictions'))].flatMap(([id, item]) => {
    const record = fieldMap(item);
    const guess = guessOf(record.get('value'));
    const answer = guessOf(record.get('answer'));

    return guess === undefined || answer === undefined
      ? []
      : [
          [
            id,
            { value: guess, answer, isCorrect: record.get('isCorrect') === true } satisfies PredictionRecord,
          ] as const,
        ];
  });

  const hints = [...fieldMap(fields.get('hints'))].flatMap(([id, count]) =>
    typeof count === 'number' ? [[id, count] as const] : [],
  );

  return {
    predictions: Object.fromEntries(predictions),
    reached: idsOf(fields.get('reached')),
    hints: Object.fromEntries(hints),
    visited: idsOf(fields.get('visited')),
  };
}

/** Whether a snapshot entry or a change belongs to this lesson: the `lesson` primitive named by its title. */
export function isLessonEntry(
  entry: { readonly component: string; readonly label?: string },
  lesson: AnyLesson,
): boolean {
  return entry.component === 'lesson' && entry.label === lesson.title;
}

/** The lesson's entry in the bridge snapshot, or undefined while it is not on the page or is read-only. */
export function lessonEntry(agent: LessonAgent, lesson: AnyLesson): AgentComponent | undefined {
  return agent.snapshot().find((entry) => isLessonEntry(entry, lesson) && entry.offPage !== true);
}

/**
 * The `lesson-progress` entry of the article titled `title` in the bridge snapshot. When no entry has that title and
 * the page has only one, it is that one.
 */
export function progressEntry(agent: LessonAgent, title: string): AgentComponent | undefined {
  const entries = agent.snapshot().filter((entry) => entry.component === 'lesson-progress');

  return entries.find((entry) => entry.label === title) ?? (entries.length === 1 ? entries[0] : undefined);
}

/** The param values a bridge value holds, over the lesson's defaults for any it lacks. */
export function paramsOf(lesson: AnyLesson, value: unknown): Readonly<Record<string, LessonValue>> {
  const reported = fieldMap(value);

  return {
    ...lesson.defaults,
    ...Object.fromEntries(
      [...reported].flatMap(([name, item]) => {
        const typed = lessonValueOf(item);

        return Object.hasOwn(lesson.params, name) && typed !== null ? [[name, typed]] : [];
      }),
    ),
  };
}

/** Reads the lesson through the bridge snapshot, or undefined while the bridge cannot see it. */
export function readLesson(agent: LessonAgent, lesson: AnyLesson): LessonReading | undefined {
  const entry = lessonEntry(agent, lesson);

  if (entry === undefined) {
    return undefined;
  }

  const params = paramsOf(lesson, entry['values']);
  const { beat, step, playing } = entry;

  return {
    ref: entry.ref,
    beat: typeof beat === 'string' ? beat : null,
    step: typeof step === 'number' ? step : 0,
    playing: typeof playing === 'string' ? playing : null,
    values: { ...params, ...lesson.compute(params) },
  };
}

/** Every value that differs between two readings, the beat, step and player first. */
export function changesBetween(before: LessonReading, after: LessonReading): ReadonlyArray<TutorChange> {
  const place = [
    { name: 'beat', from: before.beat, to: after.beat },
    { name: 'step', from: before.step, to: after.step },
    { name: 'playing', from: before.playing, to: after.playing },
  ];

  const values = Object.keys(after.values).map((name) => ({
    name,
    from: before.values[name] ?? null,
    to: after.values[name] ?? null,
  }));

  return [...place, ...values].filter((change) => change.from !== change.to);
}

/** The params that differ between the values before and after a reported lesson change. */
export function paramChanges(lesson: AnyLesson, change: ObservedChange): ReadonlyArray<TutorChange> {
  const before = fieldMap(change.previous);
  const after = fieldMap(change.value);

  return Object.keys(lesson.params).flatMap((name) => {
    const from = lessonValueOf(before.get(name));
    const to = lessonValueOf(after.get(name));
    const isKnown = isLessonValue(to);

    return isKnown && from !== to ? [{ name, from, to }] : [];
  });
}

/** Resolves after the next shared frame, once the page has drawn what an action changed. */
export async function nextFrame(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  const frame = { stop: (): void => undefined };

  frame.stop = onFrame(() => {
    frame.stop();
    resolve();
  });

  return await promise;
}
