import type { ValueFormat } from '../../../charts/src/index.ts';
import type { LessonBeat, LessonParam } from '../lesson/define-lesson.ts';

/** A derived value as a plan names it: what it reads and its formula in words, before any code exists. */
export type LessonPlanDerived = {
  readonly label: string;
  readonly format: ValueFormat;
  /** The params and earlier derived values it reads. */
  readonly reads: ReadonlyArray<string>;
  /** The formula in words, such as "the softmax share of the followed token". */
  readonly formula: string;
};

/** The figure a beat shows: a teaching part from `explainerGuide` or a chart name, and the question it answers. */
export type LessonPlanFigure = {
  readonly part: string;
  readonly question: string;
  /** The params and derived values it draws. */
  readonly shows?: ReadonlyArray<string> | undefined;
};

/** A prediction the reader commits to, or a challenge the reader reaches by moving params. */
export type LessonPlanAsk = { readonly kind: 'predict' | 'challenge'; readonly prompt: string };

/** One beat as a plan describes it: the lesson beat, with the figure it shows and what it asks. */
export type LessonPlanBeat = LessonBeat & {
  readonly figure?: LessonPlanFigure | undefined;
  readonly ask?: LessonPlanAsk | undefined;
};

/**
 * The plain JSON an agent drafts before writing any component: who it is for, the one idea, the values and the beats.
 * `validateLessonPlan` checks it. Its params and beats carry over to `defineLesson` unchanged.
 */
export type LessonPlan = {
  readonly id: string;
  readonly title: string;
  /** Who reads it and what they already know. */
  readonly audience: string;
  /** The one idea the reader should leave with. */
  readonly idea: string;
  readonly params: Readonly<Record<string, LessonParam>>;
  readonly derived?: Readonly<Record<string, LessonPlanDerived>> | undefined;
  readonly beats: ReadonlyArray<LessonPlanBeat>;
};
