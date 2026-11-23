import * as stylex from '@stylexjs/stylex';
import { createStickToBottom } from '@ui-sdk/core';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import stripAnsi from 'strip-ansi';
import { Button, CopyValue } from '../../core/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { viewerStyles } from './viewer-styles.ts';
import { Viewer } from './viewer.tsx';

export type LogViewerProps = {
  readonly output: string;
  readonly label: string;
  readonly variant?: 'default' | 'embedded';
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
  // A block the follower can measure as the output grows.
  text: { display: 'block' },
  notice: { borderBlockEndWidth: 1, borderBlockEndStyle: 'solid', borderBlockEndColor: colors.line },
});

const MAX_PREVIEW_CHARACTERS = 200_000;

export function LogViewer({
  output,
  label,
  variant = 'default',
  maxLines = 500,
  maxHeight = 320,
  isRunning = false,
}: LogViewerProps): ReactNode {
  const keyboardScroll = useScrollTabIndex<HTMLPreElement>();
  const scroll = keyboardScroll.viewport;
  const isFollowFocused = useRef(false);

  const [follower] = useState(() => {
    const log = createStickToBottom();

    return { ...log, subscribe: (listener: () => void) => log.subscribe(listener), read: () => log.get() };
  });

  const { following: isFollowing } = useSyncExternalStore(follower.subscribe, follower.read, follower.read);
  const text = stripAnsi(output);
  const lines = text.slice(-MAX_PREVIEW_CHARACTERS).split('\n');
  const retainedLines = lines.slice(-Math.max(1, maxLines));
  const omittedLines = lines.length - retainedLines.length;
  const isEmbedded = variant === 'embedded';
  const shouldShowFollow = isRunning && (isEmbedded ? !isFollowing : true);

  // The UI SDK follower keeps the end in view while output grows, until the reader scrolls up.
  useLayoutEffect(() => {
    const node = scroll.current;

    return node === null ? undefined : follower.connect(node);
  }, [follower, scroll]);

  useLayoutEffect(() => {
    if (!isRunning && isFollowFocused.current) {
      isFollowFocused.current = false;

      scroll.current?.focus({ preventScroll: true });
    }
  }, [isRunning]);

  return (
    <Viewer kind="log" aria-label={label} {...stylex.props(viewerStyles.root, isEmbedded && viewerStyles.embedded)}>
      <div {...stylex.props(viewerStyles.header, isEmbedded && viewerStyles.embeddedHeader)}>
        <span {...stylex.props(viewerStyles.label)}>
          {label}
          {isRunning && !isEmbedded && ' · running'}
        </span>
        <div {...stylex.props(viewerStyles.actions)}>
          {shouldShowFollow && (
            <Button
              variant="ghost"
              onClick={() => {
                if (isFollowing) {
                  follower.release();
                } else {
                  follower.scrollToBottom();
                }
              }}
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
          <CopyValue value={output} label={label} display={isEmbedded ? 'icon' : 'value'}>
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
        {...stylex.props(viewerStyles.scrollRegion, styles.output(maxHeight))}
      >
        <span {...stylex.props(styles.text)}>
          {text.length === 0 ? 'No output recorded.' : retainedLines.join('\n')}
        </span>
      </pre>
    </Viewer>
  );
}
