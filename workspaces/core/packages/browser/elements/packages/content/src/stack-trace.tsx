import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { CodeBlock } from './code/code-block.tsx';
import { ContentLink } from './content-link.tsx';
import { viewerStyles } from './viewer-styles.ts';

export type StackFrame = {
  readonly id: string;
  readonly name: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly href?: string;
  readonly code?: string;
  readonly language?: string;
};

export type StackTraceProps = { readonly message: string; readonly frames: ReadonlyArray<StackFrame> };

const styles = stylex.create({
  message: {
    margin: 0,
    padding: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    color: colors.danger,
    fontWeight: typography.mediumWeight,
    overflowWrap: 'anywhere',
  },
  frames: { margin: 0, padding: 0, listStyleType: 'none' },
  frame: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    minWidth: 0,
    overflowWrap: 'anywhere',
    padding: spacing.md,
    borderBlockEndWidth: { 'default': 1, ':last-child': 0 },
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  location: {
    display: 'block',
    color: colors.muted,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    overflowWrap: 'anywhere',
  },
  empty: { margin: 0, padding: spacing.md, color: colors.muted },
});

export function StackTrace({ message, frames }: StackTraceProps): ReactNode {
  return (
    <section aria-label="Stack trace" {...stylex.props(viewerStyles.root)}>
      <p {...stylex.props(styles.message)}>{message}</p>
      {frames.length === 0 ? (
        <p {...stylex.props(styles.empty)}>No frames recorded.</p>
      ) : (
        <ol {...stylex.props(styles.frames)}>
          {frames.map((frame) => {
            const location = [frame.file, frame.line, frame.column].filter((value) => value !== undefined).join(':');

            return (
              <li key={frame.id} {...stylex.props(styles.frame)}>
                <div>
                  <ContentLink href={frame.href}>{frame.name}</ContentLink>
                  {location.length > 0 && <span {...stylex.props(styles.location)}>{location}</span>}
                </div>
                {frame.code !== undefined && (
                  <CodeBlock code={frame.code} language={frame.language} filename={frame.file} />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
