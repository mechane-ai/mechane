import { formatNumber } from '@ui-sdk/core/number';
import type { ValueFormat } from '../../../charts/src/index.ts';
import type { AnyLesson, LessonBeat, LessonParam, LessonValue, ToggleValue } from '../lesson/define-lesson.ts';

/** A number format as plain JSON: the `Intl` options, or null for a format the author wrote as a function. */
export type OutlineFormat = Readonly<Intl.NumberFormatOptions> | null;

/** A param in an outline: its name, kind, label and opening value, with its range or options. */
export type OutlineParam =
  | {
      readonly name: string;
      readonly kind: 'number';
      readonly label: string;
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly scale: 'linear' | 'log';
      readonly format: OutlineFormat;
    }
  | {
      readonly name: string;
      readonly kind: 'choice';
      readonly label: string;
      readonly value: string;
      readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    }
  | { readonly name: string; readonly kind: 'toggle'; readonly label: string; readonly value: ToggleValue };

/** A derived value in an outline, with the names it reads. */
export type OutlineDerived = {
  readonly name: string;
  readonly label: string;
  readonly format: OutlineFormat;
  readonly reads: ReadonlyArray<string>;
};

/** A declared state with the derived values it leads to. */
export type OutlineState = {
  readonly id: string;
  readonly label: string;
  /** The params the state sets. */
  readonly values: Readonly<Record<string, LessonValue>>;
  /** Every derived value once the state is shown over the opening values. */
  readonly derived: Readonly<Record<string, number>>;
};

/** A beat in an outline, with its tutor notes. */
export type OutlineBeat = {
  readonly id: string;
  readonly title: string;
  readonly goal: string | null;
  readonly misconception: string | null;
  readonly hints: ReadonlyArray<string>;
  readonly steps: number;
  readonly states: ReadonlyArray<OutlineState>;
};

/** A defined lesson as plain JSON: what an agent reads to know the lesson without rendering it. */
export type LessonOutline = {
  readonly id: string;
  readonly title: string;
  readonly params: ReadonlyArray<OutlineParam>;
  readonly derived: ReadonlyArray<OutlineDerived>;
  /** Every param and derived value at the opening. */
  readonly initial: Readonly<Record<string, LessonValue>>;
  readonly beats: ReadonlyArray<OutlineBeat>;
};

const WHERE_NOT_A_NUMBER = 'Unavailable';

function jsonFormat(format: ValueFormat): OutlineFormat {
  return typeof format === 'function' ? null : format;
}

function outlineParam(name: string, param: LessonParam): OutlineParam {
  switch (param.kind) {
    case 'number':
      return {
        name,
        kind: 'number',
        label: param.label,
        value: param.value,
        min: param.min,
        max: param.max,
        step: param.step,
        scale: param.scale ?? 'linear',
        format: jsonFormat(param.format),
      };
    case 'choice':
      return { name, kind: 'choice', label: param.label, value: param.value, options: param.options };
    case 'toggle':
      return { name, kind: 'toggle', label: param.label, value: param.value };
  }
}

function outlineBeat(lesson: AnyLesson, beat: LessonBeat): OutlineBeat {
  return {
    id: beat.id,
    title: beat.title,
    goal: beat.goal ?? null,
    misconception: beat.misconception ?? null,
    hints: beat.hints ?? [],
    steps: beat.steps ?? 0,
    states: (beat.states ?? []).map((state) => ({
      id: state.id,
      label: state.label,
      values: state.values,
      derived: lesson.compute({ ...lesson.defaults, ...state.values }),
    })),
  };
}

/**
 * The outline of a defined lesson as plain JSON: params with their ranges, derived values with what they read, and
 * beats with tutor notes and each state's derived values. A tutor or a planning agent reads it instead of the page.
 */
export function describeLesson(lesson: AnyLesson): LessonOutline {
  return {
    id: lesson.id,
    title: lesson.title,
    params: Object.entries(lesson.params).map(([name, param]) => outlineParam(name, param)),
    derived: Object.entries(lesson.derived).map(([name, derived]) => ({
      name,
      label: derived.label,
      format: jsonFormat(derived.format),
      reads: lesson.reads[name] ?? [],
    })),
    initial: lesson.initial,
    beats: lesson.beats.map((beat) => outlineBeat(lesson, beat)),
  };
}

/**
 * A param or derived value written as the reader sees it: a number in its declared format, a choice by its option's
 * label, a toggle as on or off.
 */
export function writtenValue({
  lesson,
  name,
  value,
  locale,
}: {
  readonly lesson: AnyLesson;
  readonly name: string;
  readonly value: LessonValue;
  readonly locale: string;
}): string {
  const param = new Map(Object.entries(lesson.params)).get(name);
  const derived = new Map(Object.entries(lesson.derived)).get(name);

  if (typeof value === 'boolean') {
    return value ? 'on' : 'off';
  }

  if (typeof value === 'string') {
    return param?.kind === 'choice' ? (param.options.find((option) => option.id === value)?.label ?? value) : value;
  }

  const format = param?.kind === 'number' ? param.format : derived?.format;

  return Number.isFinite(value) ? formatNumber(value, locale, format ?? {}) : WHERE_NOT_A_NUMBER;
}

function labelOf(lesson: AnyLesson, name: string): string {
  return lesson.params[name]?.label ?? lesson.derived[name]?.label ?? name;
}

function rangeText(param: LessonParam, write: (value: LessonValue) => string): string {
  switch (param.kind) {
    case 'number':
      return `from ${write(param.min)} to ${write(param.max)}${param.scale === 'log' ? ', on a log scale' : ''}`;
    case 'choice':
      return `one of ${param.options.map((option) => option.label).join(', ')}`;
    case 'toggle':
      return 'on or off';
  }
}

/**
 * The lesson as text an agent reads without rendering it. It lists the params and derived values, then each beat with
 * its tutor notes. Each declared state follows, with every value written in its format.
 */
export function lessonWalk(lesson: AnyLesson, locale: string): string {
  function list(values: Readonly<Record<string, LessonValue>>, joiner = ' '): string {
    return Object.entries(values)
      .map(([name, value]) => `${labelOf(lesson, name)}${joiner}${writtenValue({ lesson, name, value, locale })}`)
      .join('; ');
  }

  const params = Object.entries(lesson.params).map(
    ([name, param]) =>
      `- ${param.label} (${name}), ${rangeText(param, (value) => writtenValue({ lesson, name, value, locale }))}. Opens at ${writtenValue({ lesson, name, value: param.value, locale })}.`,
  );

  const derived = Object.entries(lesson.derived).map(([name, value]) => {
    const reads = lesson.reads[name] ?? [];

    return `- ${value.label} (${name}) reads ${reads.length > 0 ? reads.join(', ') : 'nothing'}.`;
  });

  const beats = lesson.beats.flatMap((beat, index) => [
    '',
    `Beat ${index + 1} of ${lesson.beats.length}: ${beat.title} (${beat.id}). Reveal steps after its first view: ${beat.steps ?? 0}.`,
    ...(beat.goal === undefined ? [] : [`Goal: ${beat.goal}`]),
    ...(beat.misconception === undefined ? [] : [`Misconception: ${beat.misconception}`]),
    ...(beat.hints ?? []).map((hint) => `Hint: ${hint}`),
    ...((beat.states ?? []).length === 0 ? ['No declared states; the beat shows the values the reader has.'] : []),
    ...(beat.states ?? []).map(
      (state) =>
        `State "${state.label}" (${state.id}) sets ${list(state.values, ' to ')}. Then ${list(lesson.compute({ ...lesson.defaults, ...state.values }))}.`,
    ),
  ]);

  return [
    `Lesson "${lesson.title}" (${lesson.id}).`,
    'Params:',
    ...params,
    ...(derived.length > 0 ? ['Derived values:', ...derived] : []),
    `Opening: ${list(lesson.initial)}.`,
    ...beats,
  ].join('\n');
}
