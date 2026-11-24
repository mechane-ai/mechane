import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import { valueProblem } from '../spec/findings.ts';
import type { LessonFinding } from '../spec/findings.ts';
import { onFrame } from '../time/clock.ts';
import type { LearnerRecord } from './learner-trace.ts';
import { fieldMap, isLessonEntry, isPlainObject, readerSources, readLesson } from './lesson-bridge.ts';
import type { LessonAgent } from './lesson-bridge.ts';

/** How long a tour stays on a step, in seconds, by name. Tours name a pace and never hold raw durations. */
export const tourHolds = { short: 1.5, regular: 3, long: 6 } as const;

/** A named time a tour stays on one step. */
export type TourHold = keyof typeof tourHolds;

/** One step of a tour: where to go, what to show, what to say and how long to stay. Every field is optional. */
export type LessonTourStep = {
  readonly beat?: string | undefined;
  /** The reveal step inside the beat, from 0. */
  readonly step?: number | undefined;
  /** A state the beat declares, shown in one change. */
  readonly state?: string | undefined;
  readonly values?: Readonly<Record<string, LessonValue>> | undefined;
  /** What the tutor says at this step, handed to `onSay`. */
  readonly say?: string | undefined;
  /** Defaults to `regular`. */
  readonly hold?: TourHold | undefined;
};

/** A guided walk through a lesson as plain JSON, written by an author or recorded with `tourFromTrace`. */
export type LessonTour = ReadonlyArray<LessonTourStep>;

/** Where a playing tour is: running, paused because the reader acted, finished, stopped or failed on a step. */
export type TourStatus = 'playing' | 'paused' | 'done' | 'stopped' | 'failed';

/** A tour that is playing. */
export type TourPlayer = {
  readonly status: () => TourStatus;
  /** The step shown now, from 0, or -1 before the first. */
  readonly index: () => number;
  /** Why the tour failed, or null. */
  readonly error: () => string | null;
  readonly pause: () => void;
  /** Goes on from the step it paused on, with that step's hold started again. */
  readonly resume: () => void;
  readonly stop: () => void;
  readonly subscribe: (listener: () => void) => () => void;
};

const MS_PER_SECOND = 1000;
const STEP_KEYS: ReadonlySet<string> = new Set(['beat', 'step', 'state', 'values', 'say', 'hold']);
const ENDED: ReadonlySet<TourStatus> = new Set(['done', 'stopped', 'failed']);
const TOUR_KINDS: ReadonlySet<string> = new Set(['beat', 'step', 'param', 'play']);
/** The trace kinds whose end value a tour step sets: a param moved or a player stopped. */
const VALUE_KINDS: ReadonlySet<string> = new Set(['param', 'play']);

/**
 * Plays a tour through the agent bridge on the shared clock: each step moves the lesson, says its line and holds. The
 * tour pauses when the reader changes the lesson, and `resume` goes on.
 */
export function playTour({
  agent,
  lesson,
  tour,
  onSay,
}: {
  readonly agent: LessonAgent;
  readonly lesson: AnyLesson;
  readonly tour: LessonTour;
  /** Hears each step's line, with the step's index. */
  readonly onSay?: ((say: string, index: number) => void) | undefined;
}): TourPlayer {
  const state: {
    status: TourStatus;
    index: number;
    waited: number;
    last: number | null;
    isMoving: boolean;
    error: string | null;
  } = { status: 'playing', index: -1, waited: 0, last: null, isMoving: false, error: null };

  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function end(status: TourStatus, error: string | null = null): void {
    state.status = status;
    state.error = error;

    stopFrames();
    stopChanges();
    notify();
  }

  async function show(step: LessonTourStep): Promise<void> {
    const reading = readLesson(agent, lesson);

    if (reading === undefined) {
      end('failed', `The lesson "${lesson.title}" is not on the page for the agent.`);

      return;
    }

    const isMove = step.beat !== undefined || step.step !== undefined;

    const actions = [
      ...(isMove ? [{ action: 'setBeat', args: [step.beat ?? reading.beat, step.step ?? 0] }] : []),
      ...(step.state === undefined ? [] : [{ action: 'showState', args: [step.state] }]),
      ...(step.values === undefined ? [] : [{ action: 'setParams', args: [step.values] }]),
    ];

    const result =
      actions.length === 0
        ? { ok: true, error: undefined }
        : await agent.act({ steps: actions.map(({ action, args }) => ({ ref: reading.ref, action, args })) });

    if (!result.ok) {
      end('failed', result.error?.message ?? 'The bridge refused a tour step.');

      return;
    }

    if (step.say !== undefined) {
      onSay?.(step.say, state.index);
    }
  }

  function advance(): void {
    state.index += 1;
    state.waited = 0;
    state.last = null;

    const step = tour[state.index];

    if (step === undefined) {
      state.index = tour.length - 1;

      end('done');

      return;
    }

    state.isMoving = true;

    notify();

    void show(step).then(() => {
      state.isMoving = false;
    });
  }

  const stopFrames = onFrame((now) => {
    const isWaiting = state.status === 'playing' && !state.isMoving;

    if (!isWaiting) {
      state.last = null;

      return;
    }

    state.waited += state.last === null ? 0 : now - state.last;
    state.last = now;

    const hold = tourHolds[tour[state.index]?.hold ?? 'regular'] * MS_PER_SECOND;

    if (state.waited >= hold) {
      advance();
    }
  });

  const stopChanges = agent.subscribe((change) => {
    const isOurs = isLessonEntry(change, lesson) || change.component === 'lesson-progress';

    const isReaderAct = isOurs && readerSources.has(change.source);

    if (!isReaderAct || state.status !== 'playing') {
      return;
    }

    state.status = 'paused';

    notify();
  });

  advance();

  return {
    status: () => state.status,
    index: () => state.index,
    error: () => state.error,
    pause() {
      if (state.status === 'playing') {
        state.status = 'paused';

        notify();
      }
    },
    resume() {
      if (state.status !== 'paused') {
        return;
      }

      state.status = 'playing';
      state.waited = 0;
      state.last = null;

      notify();
    },
    stop() {
      if (!ENDED.has(state.status)) {
        end('stopped');
      }
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function stepFindings({
  lesson,
  input,
  index,
  beat,
}: {
  readonly lesson: AnyLesson;
  readonly input: unknown;
  readonly index: number;
  /** The beat the tour is on before this step, when the tour has named one. */
  readonly beat: string | undefined;
}): ReadonlyArray<LessonFinding> {
  const path = `[${index}]`;
  const fields = fieldMap(input);
  const named = fields.get('beat');
  const target = lesson.beats.find((item) => item.id === (typeof named === 'string' ? named : beat));
  const step = fields.get('step');
  const state = fields.get('state');
  const hold = fields.get('hold');
  const isWholeStep = typeof step === 'number' && Number.isInteger(step) && step >= 0;
  const lastStep = target?.steps ?? 0;
  const isStepPast = isWholeStep && target !== undefined && step > lastStep;
  const states = target === undefined ? lesson.beats.flatMap((item) => item.states ?? []) : (target.states ?? []);

  return [
    ...[...fields.keys()]
      .filter((key) => !STEP_KEYS.has(key))
      .map((key) =>
        tourError(`${path}.${key}`, `A tour step takes beat, step, state, values, say and hold, not "${key}".`),
      ),
    ...(named === undefined || target !== undefined
      ? []
      : [
          tourError(
            `${path}.beat`,
            `"${JSON.stringify(named)}" is not a beat. The beats: ${lesson.beats.map((item) => item.id).join(', ')}.`,
          ),
        ]),
    ...(step === undefined || isWholeStep ? [] : [tourError(`${path}.step`, 'step must be a whole number from 0.')]),
    ...(isStepPast
      ? [tourError(`${path}.step`, `Beat "${target.id}" has reveal steps 0 to ${lastStep}, not ${step}.`)]
      : []),
    ...(state === undefined || states.some((item) => item.id === state)
      ? []
      : [
          tourError(
            `${path}.state`,
            `"${JSON.stringify(state)}" is not a state ${target === undefined ? 'of any beat' : `of beat "${target.id}"`}.`,
          ),
        ]),
    ...[...fieldMap(fields.get('values'))].flatMap(([name, value]) => {
      const problem = valueProblem({ lesson, name, value });

      return problem === undefined ? [] : [tourError(`${path}.values.${name}`, problem)];
    }),
    ...(fields.get('values') === undefined || isPlainObject(fields.get('values'))
      ? []
      : [tourError(`${path}.values`, 'values must be an object of param names and values.')]),
    ...(fields.has('say') && typeof fields.get('say') !== 'string'
      ? [tourError(`${path}.say`, 'say must be a sentence.')]
      : []),
    ...(hold === undefined || (typeof hold === 'string' && Object.hasOwn(tourHolds, hold))
      ? []
      : [
          tourError(
            `${path}.hold`,
            `hold must be one of ${Object.keys(tourHolds).join(', ')}; a tour names a pace, not milliseconds.`,
          ),
        ]),
    ...(fields.size === 0
      ? [tourAdvice(path, 'This step does nothing. Give it a beat, a state, values or something to say.')]
      : []),
  ];
}

function tourError(path: string, message: string): LessonFinding {
  return { path, message, severity: 'error' };
}

function tourAdvice(path: string, message: string): LessonFinding {
  return { path, message, severity: 'advice' };
}

/**
 * Checks a tour against its lesson before it plays: known beats, reveal steps in range, declared states, values the
 * params take and named holds. Every finding has a path and a sentence.
 */
export function validateTour(tour: unknown, lesson: AnyLesson): ReadonlyArray<LessonFinding> {
  if (!Array.isArray(tour)) {
    return [tourError('', 'A tour is an array of steps.')];
  }

  const steps: ReadonlyArray<unknown> = tour;

  const beats = steps.map((_, index) => {
    const named = steps
      .slice(0, index)
      .map((item) => fieldMap(item).get('beat'))
      .findLast((item) => typeof item === 'string');

    return typeof named === 'string' ? named : undefined;
  });

  const findings = steps.flatMap((input, index) =>
    isPlainObject(input)
      ? stepFindings({ lesson, input, index, beat: beats[index] })
      : [tourError(`[${index}]`, 'A tour step is an object.')],
  );

  const isSilent = steps.length > 0 && steps.every((input) => !fieldMap(input).has('say'));

  return [
    ...findings,
    ...(isSilent ? [tourAdvice('', 'This tour says nothing. Add say to the steps the reader should notice.')] : []),
  ];
}

/**
 * Turns a recorded demonstration into a tour an author can edit: each beat move becomes a step, and the param moves
 * after it become that step's values. Add `say` lines and change holds by hand.
 */
export function tourFromTrace(record: LearnerRecord): LessonTour {
  const moves = record.events.filter((event) => TOUR_KINDS.has(event.kind));

  const groups = moves.flatMap((event, index) => (index === 0 || event.kind === 'beat' ? [index] : []));

  return groups.map((start, groupIndex) => {
    const group = moves.slice(start, groups[groupIndex + 1] ?? moves.length);
    const beat = group.find((event) => event.kind === 'beat')?.to;
    const step = group.findLast((event) => event.kind === 'step')?.to;

    const values = Object.fromEntries(
      group.flatMap((event) => (VALUE_KINDS.has(event.kind) && event.to !== null ? [[event.name, event.to]] : [])),
    );

    return {
      ...(typeof beat === 'string' && { beat }),
      ...(typeof step === 'number' && { step }),
      ...(Object.keys(values).length > 0 && { values }),
      hold: 'regular',
    };
  });
}
