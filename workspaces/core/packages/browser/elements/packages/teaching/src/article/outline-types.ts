import type { ReactNode } from 'react';
import type { LessonValue } from '../lesson/define-lesson.ts';

/** A work the article cites. Plain data, so an agent can write and check the list. */
export type ReferenceItem = {
  readonly id: string;
  readonly authors: ReadonlyArray<string>;
  readonly title: string;
  readonly year: number;
  readonly venue?: string | undefined;
  readonly url?: string | undefined;
};

/** A prediction of the article as its markup declares it. */
export type OutlinePrediction = {
  readonly id: string;
  readonly beat: string | null;
  /** The lesson value the answer is read from, which stays out of an agent's view until the reader commits. */
  readonly answerFrom?: string | undefined;
};

/** A figure of the article as its markup declares it. */
export type OutlineFigure = {
  readonly id: string;
  readonly beat: string | null;
  readonly hasDescription: boolean;
  /** How wide the essay draws it: the text column, or the text and its margin. A scrolly's figure is `text`. */
  readonly size: 'text' | 'wide';
  /** The figure itself, for a beat sheet's cells. */
  readonly node: ReactNode;
};

/** A step of a `Scrolly` as its markup declares it: the values or the state it shows. */
export type OutlineScrollyStep = {
  readonly id: string;
  readonly values?: Readonly<Record<string, LessonValue>> | undefined;
  readonly state?: string | undefined;
};

/** A footnote of the article, with its beat, so the present view can show it on that beat's slide. */
export type OutlineFootnote = { readonly id: string; readonly beat: string | null; readonly content: ReactNode };

/** A beat of the article as its markup declares it. */
export type OutlineBeat = {
  readonly id: string;
  readonly figures: ReadonlyArray<OutlineFigure>;
  /** The lesson names the beat's figures read: their `reads` and every name a lesson part inside them takes. */
  readonly figureNames: ReadonlyArray<string>;
  /** The params a `Param` in the beat's prose sets. */
  readonly proseParams: ReadonlyArray<string>;
  /** The steps of the beat's scrollies, in reading order. The present view walks them before its reveal steps. */
  readonly scrollySteps: ReadonlyArray<OutlineScrollyStep>;
};

/** What an article's markup holds, found by reading it before it renders, so numbers agree on server and browser. */
export type ArticleOutline = {
  readonly beats: ReadonlyArray<OutlineBeat>;
  /** Every figure id, in reading order. Figures are numbered by it. */
  readonly figures: ReadonlyArray<string>;
  readonly footnotes: ReadonlyArray<OutlineFootnote>;
  readonly references: ReadonlyArray<ReferenceItem>;
  /** The param each `Playback` drives, with its beat. */
  readonly playbacks: ReadonlyArray<{ readonly name: string; readonly beat: string | null }>;
  /** The param each `Transport` controls. */
  readonly transports: ReadonlyArray<string>;
  /** Each `Predict`, with its beat and the lesson value its answer comes from, when it names one. */
  readonly predictions: ReadonlyArray<OutlinePrediction>;
  /** Each `Challenge`, with its beat. */
  readonly challenges: ReadonlyArray<{ readonly id: string; readonly beat: string | null }>;
};
