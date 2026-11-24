import { createContext, use } from 'react';
import type { AnyLesson, LessonValue } from './define-lesson.ts';
import { failOutside } from './lesson-error.tsx';
import type { LessonApi, LessonStoreState } from './lesson-store.ts';

/** What the nearest `Lesson` shares with the parts inside it. */
export type LessonScope = {
  readonly lesson: AnyLesson;
  readonly api: LessonApi;
  readonly state: LessonStoreState;
  /** Every value: the params and the derived values computed from them. */
  readonly values: Readonly<Record<string, LessonValue>>;
  readonly locale: string;
  /** The lesson around this one, when lessons are nested. */
  readonly outer: LessonScope | null;
};

export const LessonContext = createContext<LessonScope | null>(null);

/** The nearest lesson. Throws a clear `Error` naming the part outside any `Lesson`. */
export function useLessonScope(part: string): LessonScope {
  const scope = use(LessonContext);

  return scope ?? failOutside(part);
}

/** The nearest lesson that renders `lesson`, walking out through nested lessons. */
export function scopeOf(scope: LessonScope | null, lesson: AnyLesson): LessonScope | null {
  const walk = { scope };

  while (walk.scope !== null && walk.scope.lesson !== lesson) {
    walk.scope = walk.scope.outer;
  }

  return walk.scope;
}
