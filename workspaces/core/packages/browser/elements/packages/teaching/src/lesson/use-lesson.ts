import { use } from 'react';
import type { LessonDefinition, LessonParams, LessonValues, ParamValues } from './define-lesson.ts';
import { LessonContext, scopeOf, useLessonScope } from './lesson-context.ts';
import type { LessonScope } from './lesson-context.ts';
import { failOutside } from './lesson-error.tsx';
import type { LessonChangeOrigin, LessonPlaceChangeReason } from './lesson-store.ts';

/** What `useLesson` returns: the lesson's values and the calls that change them, typed by its definition. */
export type LessonControls<Params extends LessonParams, Derived extends string, Beat extends string> = {
  /** Every param and derived value, as they are now. */
  readonly values: LessonValues<Params, Derived>;
  /**
   * Sets a param. A value outside its range or options throws an `Error` naming the param and its bounds. Every call
   * here takes an optional origin: the reason, event and source its change reports.
   */
  readonly set: <Name extends keyof Params & string>(
    name: Name,
    value: ParamValues<Params>[Name],
    origin?: LessonChangeOrigin,
  ) => boolean;
  /** Sets several params in one change. */
  readonly setMany: (values: Partial<ParamValues<Params>>, origin?: LessonChangeOrigin) => boolean;
  /** Shows a state a beat declares, by its id, in one change. Params it does not name take their opening values. */
  readonly show: (state: string, origin?: LessonChangeOrigin) => boolean;
  /** Puts every param of the whole lesson back to its opening value, the reader's work in every beat included. */
  readonly reset: (origin?: LessonChangeOrigin) => boolean;
  /**
   * Puts the params one beat owns back to their opening values in one change: its `params`, or those its states set.
   * Use it for a figure's reset button, so the other beats keep the reader's values.
   */
  readonly resetBeat: (beat: Beat, origin?: LessonChangeOrigin) => boolean;
  readonly beat: Beat | null;
  /** The reveal step inside the beat, from 0. */
  readonly step: number;
  /** Moves to a beat, at reveal step `step` or its first. */
  readonly goTo: (beat: Beat, step?: number, origin?: LessonChangeOrigin<LessonPlaceChangeReason>) => boolean;
  /** Shows the next reveal step, or the next beat. */
  readonly next: (origin?: LessonChangeOrigin<LessonPlaceChangeReason>) => boolean;
  /** Hides the last reveal step, or goes back a beat. */
  readonly previous: (origin?: LessonChangeOrigin<LessonPlaceChangeReason>) => boolean;
  readonly locale: string;
  readonly lesson: LessonDefinition<Params, Derived, Beat>;
};

function controlsOf<Params extends LessonParams, Derived extends string, Beat extends string>(
  scope: LessonScope,
  lesson: LessonDefinition<Params, Derived, Beat>,
): LessonControls<Params, Derived, Beat> {
  const { api, state } = scope;

  return {
    values: { ...lesson.initial, ...scope.values },
    set: (name, value, origin) => api.apply(name, value, origin ?? { reason: 'imperative' }),
    setMany: (values, origin) => api.setParams(values, origin),
    show: (id, origin) => api.showState(id, origin),
    reset: (origin) => api.reset(origin),
    resetBeat: (beat, origin) => api.resetBeat(beat, origin),
    beat: lesson.beats.find((item) => item.id === state.beat)?.id ?? null,
    step: state.step,
    goTo: (beat, step, origin) => api.setBeat(beat, step ?? 0, origin),
    next: (origin) => api.next(origin),
    previous: (origin) => api.previous(origin),
    locale: scope.locale,
    lesson,
  };
}

/**
 * The values of `lesson` and the calls that change them, from the nearest `Lesson` that renders it. Types come from the
 * definition, so `values.bet` is a number and `set('bet', 'high')` does not compile. Throws outside that lesson.
 */
export function useLesson<Params extends LessonParams, Derived extends string, Beat extends string>(
  lesson: LessonDefinition<Params, Derived, Beat>,
): LessonControls<Params, Derived, Beat> {
  const scope = scopeOf(use(LessonContext), lesson) ?? failOutside(`useLesson(${lesson.id})`);

  return controlsOf(scope, lesson);
}

/** The nearest lesson's values and calls, untyped, for parts that work in any lesson. Throws outside a lesson. */
export function useLessonContext(): LessonControls<LessonParams, string, string> {
  const scope = useLessonScope('useLessonContext');

  return controlsOf(scope, scope.lesson);
}
