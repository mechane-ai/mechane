import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import stripAnsi from 'strip-ansi';
import { Button, CopyValue } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../core/src/tokens.stylex.ts';

export type LogViewerProps = {
  readonly output: string;
  readonly label: string;
  readonly maxLines?: number;
  readonly maxHeight?: number;
  readonly isRunning?: boolean;
};

const styles = stylex.create({
  root: {
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.sm,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  actions: { display: 'flex', alignItems: 'center', gap: spacing.md },
  output: (maxHeight: number) => ({
    maxHeight,
    overflow: 'auto',
    padding: spacing.md,
    margin: 0,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.bodyLineHeight,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    tabSize: 2,
  }),
  notice: {
    color: colors.muted,
    paddingInline: spacing.md,
    paddingBlock: spacing.xs,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
});

const MAX_PREVIEW_CHARACTERS = 200_000;

export function LogViewer({
  output,
  label,
  maxLines = 500,
  maxHeight = 320,
  isRunning = false,
}: LogViewerProps): ReactNode {
  const scroll = useRef<HTMLPreElement>(null);
  const [isFollowing, setFollowing] = useState(true);
  const text = stripAnsi(output);
  const lines = text.slice(-MAX_PREVIEW_CHARACTERS).split('\n');
  const retainedLines = lines.slice(-Math.max(1, maxLines));
  const omittedLines = lines.length - retainedLines.length;

  useEffect(() => {
    if (isFollowing && scroll.current !== null) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
    }
  }, [output, isFollowing]);

  return (
    <section aria-label={label} {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>
        <span>
          {label}
          {isRunning && ' · running'}
        </span>
        <div {...stylex.props(styles.actions)}>
          <Button size="sm" variant="ghost" onClick={() => setFollowing(!isFollowing)}>
            {isFollowing ? 'Pause following' : 'Follow output'}
          </Button>
          <CopyValue value={output} label={label}>
            Copy
          </CopyValue>
        </div>
      </div>
      {omittedLines > 0 && (
        <div {...stylex.props(styles.notice)}>
          {omittedLines} earlier lines omitted from this view. Copy includes the supplied output.
        </div>
      )}
      {text.length > MAX_PREVIEW_CHARACTERS && (
        <div {...stylex.props(styles.notice)}>
          Preview limited to the last 200,000 characters. Copy includes the supplied output.
        </div>
      )}
      <pre
        ref={scroll}
        role="region"
        aria-label={`${label} output`}
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;

          setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 8);
        }}
        {...stylex.props(styles.output(maxHeight))}
      >
        {text.length === 0 ? 'No output recorded.' : retainedLines.join('\n')}
      </pre>
    </section>
  );
}
