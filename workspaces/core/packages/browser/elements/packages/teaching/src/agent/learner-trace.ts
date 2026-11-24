import { formatNumber } from '@ui-sdk/core/number';
import type { LessonProgress } from '../article/progress-store.ts';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import { writtenValue } from '../spec/describe-lesson.ts';
import {
  isLessonEntry,
  lessonEntry,
  lessonValueOf,
  paramChanges,
  paramsOf,
  progressEntry,
  progressOf,
  readerSources,
} from './lesson-bridge.ts';
import type { AnswerSources, LessonAgent } from './lesson-bridge.ts';

/**
 * What the reader did: moved a param, changed beat or step, started a player, committed a prediction, asked for a hint
 * or reached a challenge.
 */
export type LearnerEventKind = 'param' | 'beat' | 'step' | 'play' | 'prediction' | 'hint' | 'challenge';

/** One thing the reader did, as plain JSON. Repeated moves of one control close together are one event. */
export type LearnerEvent = {
  /** Milliseconds since the trace began. */
  readonly at: number;
  readonly kind: LearnerEventKind;
  /** The param, `beat`, `step`, or the `Predict` or `Challenge` id. */
  readonly name: string;
  /** Before the change. A hint's count, a player's value at its start. */
  readonly from: LessonValue | null;
  /** After the change. A prediction's guess, a hint's count, a player's value where it stopped. */
  readonly to: LessonValue | null;
  /** A committed prediction's answer. Only a prediction the reader committed has one. */
  readonly answer?: number | string | undefined;
  /** Whether a committed prediction was right, within its tolerance. */
  readonly isCorrect?: boolean | undefined;
  /** The beat the reader was on. */
  readonly beat: string | null;
  /** How the reader made the change: `mouse`, `keyboard`, `touch`, `pen`, `virtual`, or `programmatic` for a play. */
  readonly source: string;
  readonly reason: string;
  /** How many changes this event stands for. */
  readonly count: number;
};

/** A learner trace as plain JSON, for a tutor prompt, a log or `tourFromTrace`. */
export type LearnerRecord = {
  readonly lesson: string;
  /** The beat the reader was on when the trace began. */
  readonly startBeat: string | null;
  /** Milliseconds since the trace began. */
  readonly elapsed: number;
  /** The most events the trace keeps; older ones are dropped first. */
  readonly limit: number;
  /** How many older events were dropped. */
  readonly dropped: number;
  readonly events: ReadonlyArray<LearnerEvent>;
  /** Every move to a beat, by the reader or anyone else, so time on each beat is known. */
  readonly visits: ReadonlyArray<{ readonly at: number; readonly beat: string | null }>;
};

/** A running record of what the reader did. */
export type LearnerTrace = {
  readonly read: () => LearnerRecord;
  readonly subscribe: (listener: () => void) => () => void;
  /** Forgets every event and starts the clock again. */
  readonly clear: () => void;
  /** Stops listening. The record stays readable. */
  readonly stop: () => void;
};

type TracedEvent = Omit<LearnerEvent, 'at' | 'beat' | 'source' | 'reason' | 'count'>;

/** How many events a learner trace keeps unless told otherwise. */
export const LEARNER_TRACE_LIMIT = 400;

/** Changes of one control this close together, in milliseconds, are one event. */
const MERGE_GAP = 900;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const ANSWER_DIGITS = 2;
const MERGED_REASONS: ReadonlySet<string> = new Set(['drag', 'step-key', 'accessibility-adjust']);
/** Progress a page restores or clears is not something the reader did now. */
const UNREAD_PROGRESS: ReadonlySet<string> = new Set(['restore', 'reset']);

/** The reader's acts between two progress values: predictions committed, hints asked for and challenges reached. */
function progressEvents(before: LessonProgress, after: LessonProgress): ReadonlyArray<TracedEvent> {
  const predictions = Object.entries(after.predictions).flatMap(([name, record]) =>
    Object.hasOwn(before.predictions, name)
      ? []
      : [
          {
            kind: 'prediction' as const,
            name,
            from: null,
            to: record.value,
            answer: record.answer,
            isCorrect: record.isCorrect,
          },
        ],
  );

  const hints = Object.entries(after.hints).flatMap(([name, count]) => {
    const was = before.hints[name] ?? 0;

    return count > was ? [{ kind: 'hint' as const, name, from: was, to: count }] : [];
  });

  const reached = new Set(before.reached);

  const challenges = after.reached
    .filter((name) => !reached.has(name))
    .map((name) => ({ kind: 'challenge' as const, name, from: null, to: null }));

  return [...predictions, ...hints, ...challenges];
}

/**
 * Records what the reader does in a lesson, in order, through the agent bridge: param, beat and step moves, players
 * started, and the article's predictions, hints and challenges. Changes an agent makes are left out, and so are a
 * player's own steps. It keeps the last `limit` events.
 */
export function createLearnerTrace({
  agent,
  lesson,
  article = lesson.title,
  limit = LEARNER_TRACE_LIMIT,
  now = () => performance.now(),
}: {
  readonly agent: LessonAgent;
  readonly lesson: AnyLesson;
  /** The title of the article whose progress to read. Defaults to the lesson's title, or the page's only article. */
  readonly article?: string | undefined;
  readonly limit?: number | undefined;
  /** The clock, in milliseconds. Defaults to `performance.now`. */
  readonly now?: (() => number) | undefined;
}): LearnerTrace {
  const opening = lessonEntry(agent, lesson);
  const startBeat = typeof opening?.['beat'] === 'string' ? opening['beat'] : null;

  const state: {
    started: number;
    startBeat: string | null;
    beat: string | null;
    values: Readonly<Record<string, LessonValue>>;
    dropped: number;
    events: ReadonlyArray<LearnerEvent>;
    visits: LearnerRecord['visits'];
  } = {
    started: now(),
    startBeat,
    beat: startBeat,
    values: paramsOf(lesson, opening?.['values']),
    dropped: 0,
    events: [],
    visits: [],
  };

  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function add(event: LearnerEvent): void {
    const last = state.events.at(-1);
    const isSameControl = last?.kind === event.kind && last.name === event.name && last.reason === event.reason;
    const isMerged = isSameControl && MERGED_REASONS.has(event.reason) && event.at - last.at <= MERGE_GAP;

    const events = isMerged
      ? [...state.events.slice(0, -1), { ...last, at: event.at, to: event.to, count: last.count + 1 }]
      : [...state.events, event];

    state.dropped += Math.max(events.length - limit, 0);
    state.events = events.slice(-limit);

    notify();
  }

  /** Writes where a player the reader started stopped, whoever stopped it. */
  function stopped(name: string): void {
    const index = state.events.findLastIndex((event) => event.kind === 'play' && event.name === name);
    const to = state.values[name] ?? null;

    if (index === -1 || state.events[index]?.to !== null) {
      return;
    }

    state.events = state.events.map((event, at) => (at === index ? { ...event, to } : event));

    notify();
  }

  function lessonEvents(key: string, value: unknown, previous: unknown): ReadonlyArray<TracedEvent> {
    switch (key) {
      case 'beat':
      case 'step':
        return [{ kind: key, name: key, from: lessonValueOf(previous), to: lessonValueOf(value) }];
      case 'playing':
        return typeof value === 'string'
          ? [{ kind: 'play', name: value, from: state.values[value] ?? null, to: null }]
          : [];
      default:
        return [];
    }
  }

  const stop = agent.subscribe((change) => {
    const at = Math.round(now() - state.started);
    const isLesson = isLessonEntry(change, lesson);
    const isProgress = change.component === 'lesson-progress' && change.ref === progressEntry(agent, article)?.ref;

    if (isLesson && change.key === 'beat') {
      state.beat = typeof change.value === 'string' ? change.value : null;
      state.visits = [...state.visits, { at, beat: state.beat }].slice(-limit);
    }

    const moved = isLesson && change.key === 'values' ? paramChanges(lesson, change) : [];

    if (isLesson && change.key === 'values') {
      state.values = paramsOf(lesson, change.value);
    }

    if (isLesson && change.key === 'playing' && typeof change.previous === 'string') {
      stopped(change.previous);
    }

    const isReaderProgress = isProgress && change.source !== 'agent' && !UNREAD_PROGRESS.has(change.reason);
    // A Transport starts its player without a pointer event, so a start counts unless the agent made it.
    const isReaderPlay = change.key === 'playing' && change.source !== 'agent';
    const isReaderLesson = isLesson && (readerSources.has(change.source) || isReaderPlay);

    const events: ReadonlyArray<TracedEvent> = isReaderProgress
      ? progressEvents(progressOf(change.previous), progressOf(change.value))
      : [];

    const lessonMoves: ReadonlyArray<TracedEvent> = isReaderLesson
      ? [
          ...moved.map((item) => ({ kind: 'param' as const, ...item })),
          ...lessonEvents(change.key, change.value, change.previous),
        ]
      : [];

    for (const event of [...events, ...lessonMoves]) {
      add({ ...event, at, beat: state.beat, source: change.source, reason: change.reason, count: 1 });
    }
  });

  return {
    read: () => ({
      lesson: lesson.id,
      startBeat: state.startBeat,
      elapsed: Math.round(now() - state.started),
      limit,
      dropped: state.dropped,
      events: state.events,
      visits: state.visits,
    }),
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      state.started = now();
      state.startBeat = state.beat;
      state.dropped = 0;
      state.events = [];
      state.visits = [];

      notify();
    },
    stop,
  };
}

function durationText(milliseconds: number, locale: string): string {
  const seconds = milliseconds / MS_PER_SECOND;
  const isLong = seconds >= SECONDS_PER_MINUTE;

  return formatNumber(isLong ? seconds / SECONDS_PER_MINUTE : seconds, locale, {
    style: 'unit',
    unit: isLong ? 'minute' : 'second',
    unitDisplay: 'long',
    maximumFractionDigits: 0,
  });
}

function total(values: ReadonlyArray<number>): number {
  const sum = { value: 0 };

  for (const value of values) {
    sum.value += value;
  }

  return sum.value;
}

function timesText(count: number): string {
  return count === 1 ? 'once' : `${count} times`;
}

function dwellSentence(record: LearnerRecord, lesson: AnyLesson, locale: string): string | undefined {
  const starts = [{ beat: record.startBeat, at: 0 }, ...record.visits];

  const spans = starts.map((start, index) => ({
    beat: start.beat,
    time: (starts[index + 1]?.at ?? record.elapsed) - start.at,
  }));

  const order = [...new Set(spans.map(({ beat }) => beat))].flatMap((beat) => (beat === null ? [] : [beat]));

  const parts = order.flatMap((beat) => {
    const time = total(spans.filter((span) => span.beat === beat).map((span) => span.time));
    const index = lesson.beats.findIndex((item) => item.id === beat);

    return time < MS_PER_SECOND
      ? []
      : [`${durationText(time, locale)} on beat ${index + 1} (${lesson.beats[index]?.title ?? beat})`];
  });

  return parts.length === 0 ? undefined : `Spent ${parts.join(', then ')}.`;
}

function paramSentence({
  lesson,
  name,
  events,
  locale,
}: {
  readonly lesson: AnyLesson;
  readonly name: string;
  readonly events: ReadonlyArray<LearnerEvent>;
  readonly locale: string;
}): string {
  const param = lesson.params[name];
  const label = param?.label ?? name;
  const count = total(events.map((event) => event.count));
  const last = events.at(-1)?.to ?? null;
  const now = last === null ? '' : ` It is now ${writtenValue({ lesson, name, value: last, locale })}.`;
  const numbers = events.flatMap((event) => [event.from, event.to]).filter((value) => typeof value === 'number');

  if (param?.kind === 'number' && numbers.length > 0) {
    const low = writtenValue({ lesson, name, value: Math.min(...numbers), locale });
    const high = writtenValue({ lesson, name, value: Math.max(...numbers), locale });

    return `Moved ${label} ${timesText(count)}, between ${low} and ${high}.${now}`;
  }

  return `Changed ${label} ${timesText(count)}.${now}`;
}

function answerText({
  lesson,
  locale,
  answers,
  event,
  value,
}: {
  readonly lesson: AnyLesson;
  readonly locale: string;
  readonly answers: AnswerSources;
  readonly event: LearnerEvent;
  readonly value: LessonValue | null;
}): string {
  const source = answers[event.name];

  if (value === null) {
    return 'nothing';
  }

  if (source !== undefined) {
    return writtenValue({ lesson, name: source, value, locale });
  }

  return typeof value === 'number'
    ? formatNumber(value, locale, { maximumFractionDigits: ANSWER_DIGITS })
    : String(value);
}

function verdictText(event: LearnerEvent): string {
  if (typeof event.answer === 'number') {
    return event.isCorrect === true ? 'close' : 'too far';
  }

  return event.isCorrect === true ? 'right' : 'wrong';
}

/**
 * A few sentences of plain facts about what the reader did, for a tutor prompt: time on each beat, how each param
 * moved, plays, predictions, hints and challenges. It interprets nothing.
 */
export function summarizeTrace({
  record,
  lesson,
  locale,
  answers = {},
}: {
  readonly record: LearnerRecord;
  readonly lesson: AnyLesson;
  readonly locale: string;
  /** Where each prediction's answer comes from, so guesses and answers are written in its format. */
  readonly answers?: AnswerSources | undefined;
}): string {
  if (record.events.length === 0) {
    return 'The reader has not acted yet.';
  }

  function byName(kind: LearnerEventKind): ReadonlyMap<string, ReadonlyArray<LearnerEvent>> {
    return Map.groupBy(
      record.events.filter((event) => event.kind === kind),
      (event) => event.name,
    );
  }

  const params = [...byName('param')].map(([name, events]) => paramSentence({ lesson, name, events, locale }));

  const plays = [...byName('play')].map(([name, events]) => {
    const end = events.at(-1)?.to ?? null;
    const reached = end === null ? '' : `, last stopping at ${writtenValue({ lesson, name, value: end, locale })}`;

    return `Started the ${lesson.params[name]?.label ?? name} player ${timesText(events.length)}${reached}.`;
  });

  const predictions = record.events.flatMap((event) => {
    const guess = answerText({ lesson, locale, answers, event, value: event.to });
    const answer = answerText({ lesson, locale, answers, event, value: event.answer ?? null });

    return event.kind === 'prediction'
      ? [`Predicted ${guess} for "${event.name}"; the answer was ${answer}, counted as ${verdictText(event)}.`]
      : [];
  });

  const hints = [...byName('hint')].map(([name, events]) => {
    const count = Number(events.at(-1)?.to ?? 0);

    return `Asked for ${count === 1 ? '1 hint' : `${count} hints`} on the challenge "${name}".`;
  });

  const steps = record.events.filter((event) => event.kind === 'step').length;
  const challenges = record.events.filter((event) => event.kind === 'challenge');

  return [
    dwellSentence(record, lesson, locale),
    ...params,
    ...plays,
    steps === 0 ? undefined : `Moved through reveal steps ${timesText(steps)}.`,
    ...predictions,
    ...hints,
    ...challenges.map((event) => `Reached the challenge "${event.name}".`),
    record.dropped === 0
      ? undefined
      : `The trace keeps the last ${record.limit} events; ${record.dropped} earlier ones are not in it.`,
  ]
    .filter((sentence) => sentence !== undefined)
    .join(' ');
}
