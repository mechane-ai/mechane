import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { typography } from '../../../foundations/src/tokens.stylex.ts';
import { LessonError } from '../lesson/lesson-error.tsx';

const styles = stylex.create({ block: { marginBlock: typography.captionLineHeight } });

/** The lesson's inline error on a line of its own, for a part that stands between paragraphs, such as a figure. */
export function BlockError({ children }: { readonly children: string }): ReactNode {
  return (
    <div {...stylex.props(styles.block)}>
      <LessonError>{children}</LessonError>
    </div>
  );
}

/**
 * The error a part shows when it rendered but the article's outline lacks it, because the author wrapped it in a
 * component of their own. The outline reads only the markup the author writes, so it must sit in the children.
 */
export function unlistedText(part: string, id: string): string {
  return `${part} "${id}" sits inside a component of your own, so the outline, the beat sheet and the tutor miss it. Write it directly in the Article's children.`;
}

/** The error a part shows outside every `Article`. */
export function outsideText(part: string): string {
  return `${part} must be rendered inside an <Article>.`;
}
