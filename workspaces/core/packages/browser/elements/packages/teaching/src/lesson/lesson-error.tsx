import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({ error: { color: colors.danger, fontWeight: typography.strongWeight } });

/**
 * Throws the error a lesson gives for a value or a name it does not take. The message names the lesson and the value at
 * fault, so the author or the agent that made the call can fix it.
 */
export function failLesson(lesson: string, message: string): never {
  throw new Error(`Lesson "${lesson}": ${message}`);
}

/** Throws the error a lesson part gives when it is used outside every `Lesson`. */
export function failOutside(part: string): never {
  throw new Error(`${part} must be rendered inside a <Lesson>. Wrap it in <Lesson lesson={…} locale="…">.`);
}

/** The short inline error a lesson part shows in place of itself when the author gave it a name or value it lacks. */
export function LessonError({ children }: { readonly children: string }): ReactNode {
  return (
    <span role="note" {...stylex.props(styles.error)}>
      {children}
    </span>
  );
}
