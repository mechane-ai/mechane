import { createContext, use } from 'react';

/** The locale of the nearest lesson, which its figures and values fall back to. */
export const LessonLocale = createContext<string | null>(null);

/** The locale the nearest `Lesson` was given, or null outside a lesson. */
export function useLessonLocale(): string | null {
  return use(LessonLocale);
}
