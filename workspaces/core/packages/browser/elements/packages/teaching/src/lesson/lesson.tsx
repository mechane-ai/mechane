import { definePrimitive } from '@ui-sdk/core';
import type { ChangeSource } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { use, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { paramProblem } from './define-lesson.ts';
import type { AnyLesson, LessonDefinition, LessonParams, LessonValue, ParamValues } from './define-lesson.ts';
import { LessonContext } from './lesson-context.ts';
import { LessonError } from './lesson-error.tsx';
import { LessonLocale } from './lesson-locale.ts';
import type { LessonParamValues } from './lesson-persistence.ts';
import { lessonApi, lessonState, lessonSync } from './lesson-store.ts';
import type {
  LessonPlaceChangeDetails,
  LessonPlayingChangeDetails,
  LessonStoreState,
  LessonValuesChangeDetails,
} from './lesson-store.ts';

/** The lesson store: one UI SDK primitive whose controlled keys are `values`, `beat`, `step` and `playing`. */
const lessonStore = definePrimitive({
  name: 'lesson',
  options: {
    lesson: 'value',
    values: 'value',
    defaultValues: 'value',
    onValuesChange: 'callback',
    beat: 'string',
    defaultBeat: 'string',
    onBeatChange: 'callback',
    step: 'number',
    defaultStep: 'number',
    onStepChange: 'callback',
    onPlayingChange: 'callback',
    playSource: 'callback',
    addedSteps: 'value',
    isReadOnly: 'boolean',
    shouldSyncUrl: 'boolean',
    storageKey: 'string',
  },
  controlled: ['values', 'beat', 'step', 'playing'],
  state: lessonState,
  sync: lessonSync,
  api: lessonApi,
  slots: (slot) => ({
    root: slot({
      role: 'group',
      attrs: (state) => ({ 'data-read-only': state.isReadOnly ? '' : undefined }),
      bind: (_el, part) => part.api.connect(),
    }),
  }),
  agent: {
    actions: ['setParam', 'setParams', 'showState', 'reset', 'setBeat', 'next', 'previous', 'play', 'pause'],
    shown: (state: LessonStoreState) => !state.isReadOnly,
  },
});

export type LessonProps<Params extends LessonParams, Derived extends string, Beat extends string> = {
  readonly lesson: LessonDefinition<Params, Derived, Beat>;
  /** The locale every value, figure and control of the lesson is written in. */
  readonly locale: string;
  /** The param values the application holds. Names left out keep their defaults. */
  readonly values?: Partial<ParamValues<Params>> | undefined;
  /** The values the lesson opens with, over its declared defaults. `reset` returns to them. */
  readonly defaultValues?: Partial<ParamValues<Params>> | undefined;
  /** Hears every requested change with its reason and source. `details.cancel()` refuses it. */
  readonly onValuesChange?: ((values: ParamValues<Params>, details: LessonValuesChangeDetails) => void) | undefined;
  /** The current beat id, held by the application. */
  readonly beat?: Beat | null | undefined;
  readonly defaultBeat?: Beat | null | undefined;
  readonly onBeatChange?: ((beat: Beat | null, details: LessonPlaceChangeDetails) => void) | undefined;
  /** The reveal step inside the beat, from 0. */
  readonly step?: number | undefined;
  readonly defaultStep?: number | undefined;
  readonly onStepChange?: ((step: number, details: LessonPlaceChangeDetails) => void) | undefined;
  /** Hears a player start (the param's name) or stop (null), with who asked. `details.cancel()` refuses it. */
  readonly onPlayingChange?: ((playing: string | null, details: LessonPlayingChangeDetails) => void) | undefined;
  /** Reads values from the query string once the lesson is on the page, and writes them back as they change. */
  readonly shouldSyncUrl?: boolean | undefined;
  /** Keeps the values in local storage under this key, so they last across visits. */
  readonly storageKey?: string | undefined;
  /** A frozen copy, such as a beat sheet's cell: controls are disabled, and no change, agent action or player runs. */
  readonly isReadOnly?: boolean | undefined;
  /** Steps the markup adds to a beat after its declared reveal steps, by beat id, such as a scrolly's steps. */
  readonly addedSteps?: Readonly<Record<string, number>> | undefined;
  readonly children?: ReactNode;
};

function sameValues(first: LessonParamValues, second: LessonParamValues): boolean {
  const entries = Object.entries(first);

  return entries.length === Object.keys(second).length && entries.every(([name, value]) => second[name] === value);
}

function valuesProblem(
  lesson: AnyLesson,
  values: Readonly<Record<string, LessonValue | undefined>>,
): string | undefined {
  const params = new Map(Object.entries(lesson.params));

  return Object.entries(values)
    .flatMap(([name, value]) => {
      const param = params.get(name);

      if (param === undefined) {
        return [`Lesson "${lesson.id}" has no param "${name}".`];
      }

      return value === undefined ? [] : (paramProblem({ name, param, value }) ?? []);
    })
    .at(0);
}

function placeProblem(
  lesson: AnyLesson,
  {
    beat,
    step,
    addedSteps,
  }: {
    readonly beat: string | null | undefined;
    readonly step: number | undefined;
    readonly addedSteps: Readonly<Record<string, number>> | undefined;
  },
): string | undefined {
  const target = beat === undefined || beat === null ? undefined : lesson.beats.find((item) => item.id === beat);

  if (target === undefined && typeof beat === 'string') {
    return `Lesson "${lesson.id}" has no beat "${beat}".`;
  }

  if (step === undefined) {
    return;
  }

  const steps = (target?.steps ?? 0) + (target === undefined ? 0 : (addedSteps?.[target.id] ?? 0));
  const isStepKnown = Number.isInteger(step) && step >= 0 && step <= steps;

  return isStepKnown ? undefined : `Beat "${target?.id ?? ''}" has reveal steps 0 to ${steps}, not ${step}.`;
}

/** The full values: the lesson's defaults with the given ones over them. Missing names stay at their defaults. */
function filled(lesson: AnyLesson, values: Readonly<Record<string, LessonValue | undefined>>): LessonParamValues {
  return {
    ...lesson.defaults,
    ...Object.fromEntries(
      Object.entries(values).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]])),
    ),
  };
}

/**
 * Holds one lesson's state for everything inside it: prose values, controls, figures, players and agents read and set
 * the same named values. Pass `values` and `onValuesChange` to hold them in the application, or `defaultValues` to let
 * the lesson hold them; beats and reveal steps work the same way. Nested lessons are independent of each other.
 */
export function Lesson<Params extends LessonParams, Derived extends string, Beat extends string>({
  lesson,
  locale,
  values,
  defaultValues,
  onValuesChange,
  beat,
  defaultBeat,
  onBeatChange,
  step,
  defaultStep,
  onStepChange,
  onPlayingChange,
  shouldSyncUrl = false,
  storageKey,
  isReadOnly = false,
  addedSteps,
  children,
}: LessonProps<Params, Derived, Beat>): ReactNode {
  const outer = use(LessonContext);

  const problem =
    valuesProblem(lesson, { ...defaultValues, ...values }) ??
    placeProblem(lesson, { beat: beat ?? defaultBeat, step: step ?? defaultStep, addedSteps });

  const isValid = problem === undefined;
  const controlled = values === undefined || !isValid ? undefined : filled(lesson, values);
  const [held, setHeld] = useState(controlled);
  const stable = held !== undefined && controlled !== undefined && sameValues(held, controlled) ? held : controlled;

  if (stable !== held) {
    setHeld(stable);
  }

  const playSource = useRef<ChangeSource>('programmatic');

  const handle = usePrimitive(lessonStore, {
    lesson,
    values: stable,
    defaultValues: defaultValues === undefined || !isValid ? undefined : filled(lesson, defaultValues),
    onValuesChange:
      onValuesChange === undefined
        ? undefined
        : (next, details) => onValuesChange({ ...lesson.defaults, ...next }, details),
    beat: isValid ? beat : undefined,
    defaultBeat: isValid ? defaultBeat : undefined,
    onBeatChange:
      onBeatChange === undefined
        ? undefined
        : (next, details) => onBeatChange(lesson.beats.find((item) => item.id === next)?.id ?? null, details),
    step: isValid ? step : undefined,
    defaultStep: isValid ? defaultStep : undefined,
    onStepChange,
    onPlayingChange: (next, details) => {
      playSource.current = details.source;

      onPlayingChange?.(next, details);
    },
    playSource: () => playSource.current,
    addedSteps,
    isReadOnly,
    shouldSyncUrl,
    storageKey,
  });

  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get);

  const { state } = handle;

  const scope = {
    lesson,
    api: handle.api,
    state,
    values: { ...state.values, ...lesson.compute(state.values) },
    locale,
    outer,
  };

  const content = (
    <LessonContext value={scope}>
      <LessonLocale value={locale}>{isValid ? children : <LessonError>{problem}</LessonError>}</LessonLocale>
    </LessonContext>
  );

  return usePart(handle, 'root', {}, { 'aria-label': lesson.title, 'children': content }, 'div');
}
