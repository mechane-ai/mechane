import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { TextLink } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../core/src/tokens.stylex.ts';
import { CodeBlock } from './code/index.ts';

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
  root: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  message: {
    margin: 0,
    padding: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    color: colors.danger,
    fontWeight: 500,
    overflowWrap: 'anywhere',
  },
  frames: { margin: 0, padding: 0, listStyleType: 'none' },
  frame: {
    padding: spacing.md,
    borderBlockEndWidth: 1,
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
    <section aria-label="Stack trace" {...stylex.props(styles.root)}>
      <p {...stylex.props(styles.message)}>{message}</p>
      {frames.length === 0 ? (
        <p {...stylex.props(styles.empty)}>No frames recorded.</p>
      ) : (
        <ol {...stylex.props(styles.frames)}>
          {frames.map((frame) => {
            const location = [frame.file, frame.line, frame.column].filter((value) => value !== undefined).join(':');

            return (
              <li key={frame.id} {...stylex.props(styles.frame)}>
                {frame.href === undefined ? (
                  <span>{frame.name}</span>
                ) : (
                  <TextLink href={frame.href}>{frame.name}</TextLink>
                )}
                <span {...stylex.props(styles.location)}>{location}</span>
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
