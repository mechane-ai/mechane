import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import stripAnsi from 'strip-ansi';
import { Button, CopyValue } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { viewerStyles } from './viewer-styles.ts';

export type LogViewerProps = {
  readonly output: string;
  readonly label: string;
  readonly maxLines?: number;
  readonly maxHeight?: number;
  readonly isRunning?: boolean;
};

const styles = stylex.create({
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
  notice: { borderBlockEndWidth: 1, borderBlockEndStyle: 'solid', borderBlockEndColor: colors.line },
});

const MAX_PREVIEW_CHARACTERS = 200_000;

export function LogViewer({
  output,
  label,
  maxLines = 500,
  maxHeight = 320,
  isRunning = false,
}: LogViewerProps): ReactNode {
  const keyboardScroll = useScrollTabIndex<HTMLPreElement>();
  const scroll = keyboardScroll.viewport;
  const isFollowFocused = useRef(false);
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

  useLayoutEffect(() => {
    if (!isRunning && isFollowFocused.current) {
      isFollowFocused.current = false;

      scroll.current?.focus({ preventScroll: true });
    }
  }, [isRunning]);

  return (
    <section aria-label={label} {...stylex.props(viewerStyles.root)}>
      <div {...stylex.props(viewerStyles.header)}>
        <span {...stylex.props(viewerStyles.label)}>
          {label}
          {isRunning && ' · running'}
        </span>
        <div {...stylex.props(viewerStyles.actions)}>
          {isRunning && (
            <Button
              variant="ghost"
              onClick={() => setFollowing(!isFollowing)}
              onFocus={() => {
                isFollowFocused.current = true;
              }}
              onBlur={() => {
                isFollowFocused.current = false;
              }}
            >
              {isFollowing ? 'Pause following' : 'Follow output'}
            </Button>
          )}
          <CopyValue value={output} label={label}>
            Copy
          </CopyValue>
        </div>
      </div>
      {omittedLines > 0 && (
        <div {...stylex.props(viewerStyles.note, styles.notice)}>
          {omittedLines} earlier lines omitted from this view. Copy includes the supplied output.
        </div>
      )}
      {text.length > MAX_PREVIEW_CHARACTERS && (
        <div {...stylex.props(viewerStyles.note, styles.notice)}>
          Preview limited to the last 200,000 characters. Copy includes the supplied output.
        </div>
      )}
      <pre
        ref={keyboardScroll.ref}
        role="region"
        aria-label={`${label} output`}
        tabIndex={keyboardScroll.tabIndex}
        onScroll={(event) => {
          const node = event.currentTarget;

          setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight < 8);
        }}
        {...stylex.props(viewerStyles.scrollRegion, styles.output(maxHeight))}
      >
        {text.length === 0 ? 'No output recorded.' : retainedLines.join('\n')}
      </pre>
    </section>
  );
}
