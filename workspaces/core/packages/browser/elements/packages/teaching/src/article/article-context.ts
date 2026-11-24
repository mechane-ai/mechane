import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import type { ArticleLabels } from './article-labels.ts';
import type { ArticleOutline } from './outline-types.ts';
import type { LessonProgress, ProgressApi } from './progress-store.ts';

/** How an article arranges its children: a scrolling essay, one beat at a time, a page for print, or a beat sheet. */
export type ArticleView = 'article' | 'present' | 'static' | 'sheet';

/** Typesets TeX into React nodes. The application supplies it, such as one built on KaTeX's MathML output. */
export type ArticleMath = (tex: string, options: { readonly isDisplay: boolean }) => ReactNode;

/** The challenges of an article, kept so a reader's change can be checked against each of them. */
export type ChallengeRegistry = {
  readonly add: (id: string, isReached: (values: Readonly<Record<string, LessonValue>>) => boolean) => () => void;
  readonly entries: () => ReadonlyArray<readonly [string, (values: Readonly<Record<string, LessonValue>>) => boolean]>;
  /** The lesson's values as the reader last saw them, so a change is judged against where it started. */
  readonly seen: () => Readonly<Record<string, LessonValue>>;
  readonly remember: (values: Readonly<Record<string, LessonValue>>) => void;
};

/** What an `Article` shares with its parts. */
export type ArticleScope = {
  readonly view: ArticleView;
  readonly title: string;
  readonly lesson: AnyLesson;
  readonly locale: string;
  readonly labels: ArticleLabels;
  readonly math: ArticleMath | undefined;
  readonly outline: ArticleOutline;
  readonly progress: LessonProgress;
  readonly progressApi: ProgressApi;
  readonly challenges: ChallengeRegistry;
};

export const ArticleContext = createContext<ArticleScope | null>(null);

/** The nearest article, or null outside every `Article`. */
export function useArticle(): ArticleScope | null {
  return use(ArticleContext);
}

/** The beat a part sits in, and whether the reader is on it now. */
export type BeatScope = {
  readonly id: string;
  readonly isCurrent: boolean;
  /** The reveal step shown, from 0. */
  readonly step: number;
  /** The scrolly step the present view shows, across the beat's scrollies, or null where scrolling walks them. */
  readonly scrolly: number | null;
};

export const BeatContext = createContext<BeatScope | null>(null);

/** The beat around a part, or null outside every `Beat`. */
export function useBeat(): BeatScope | null {
  return use(BeatContext);
}

/** Creates the list of challenges an article checks on each reader's change. */
export function createChallengeRegistry(initial: Readonly<Record<string, LessonValue>>): ChallengeRegistry {
  const memory = { values: initial };
  const checks = new Map<string, (values: Readonly<Record<string, LessonValue>>) => boolean>();

  return {
    add: (id, isReached) => {
      checks.set(id, isReached);

      return () => {
        if (checks.get(id) === isReached) {
          checks.delete(id);
        }
      };
    },
    entries: () => [...checks.entries()],
    seen: () => memory.values,
    remember: (values) => {
      memory.values = values;
    },
  };
}
