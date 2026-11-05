import { MessageScroller, useMessageScroller, useMessageScrollerScrollable } from '@shadcn/react/message-scroller';
import * as stylex from '@stylexjs/stylex';
import { ArrowDown } from 'lucide-react';
import { createContext, useContext, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button } from '../../core/src/index.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
  },
  viewport: {
    'flex': 1,
    'minHeight': 0,
    'minWidth': 0,
    'overflowY': 'auto',
    'overflowAnchor': 'auto',
    'scrollbarGutter': 'stable',
    'borderRadius': radii.sm,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  content: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xl,
    paddingBlock: spacing.xl,
    paddingInline: spacing.lg,
    marginInline: 'auto',
    width: '100%',
    maxWidth: '80ch',
    minWidth: 0,
  },
  item: { minWidth: 0, overflowWrap: 'anywhere' },
  jump: {
    position: 'absolute',
    bottom: spacing.lg,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: `calc(100% - ${spacing.xxl})`,
    minWidth: 0,
  },
});

export type ConversationRootProps = {
  readonly children: ReactNode;
  readonly initialPosition?: 'start' | 'end';
  readonly follow?: boolean;
};

export type ConversationViewportProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly scrollRestorationId?: string;
};

export type ConversationContentProps = { readonly children: ReactNode; readonly streaming?: boolean };
export type ConversationItemProps = { readonly messageId: string; readonly children: ReactNode };
export type ConversationJumpProps = { readonly label?: string };

const ViewportContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);

function ConversationRoot({ children, initialPosition = 'end', follow = true }: ConversationRootProps): ReactNode {
  const viewport = useRef<HTMLDivElement>(null);

  return (
    <ViewportContext.Provider value={viewport}>
      <MessageScroller.Provider autoScroll={follow} defaultScrollPosition={initialPosition}>
        <MessageScroller.Root {...stylex.props(styles.root)}>{children}</MessageScroller.Root>
      </MessageScroller.Provider>
    </ViewportContext.Provider>
  );
}

function ConversationViewport({ label, children, scrollRestorationId }: ConversationViewportProps): ReactNode {
  const viewport = useContext(ViewportContext);

  return (
    <MessageScroller.Viewport
      ref={viewport}
      aria-label={label}
      data-scroll-restoration-id={scrollRestorationId}
      {...stylex.props(styles.viewport)}
    >
      {children}
    </MessageScroller.Viewport>
  );
}

function ConversationContent({ children, streaming = false }: ConversationContentProps): ReactNode {
  return (
    <MessageScroller.Content
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={streaming}
      {...stylex.props(styles.content)}
    >
      {children}
    </MessageScroller.Content>
  );
}

function ConversationItem({ messageId, children }: ConversationItemProps): ReactNode {
  return (
    <MessageScroller.Item messageId={messageId} {...stylex.props(styles.item)}>
      {children}
    </MessageScroller.Item>
  );
}

function ConversationJumpToLatest({ label = 'Jump to latest' }: ConversationJumpProps): ReactNode {
  const { scrollToEnd } = useMessageScroller();
  const { end } = useMessageScrollerScrollable();
  const viewport = useContext(ViewportContext);

  if (!end) {
    return null;
  }

  return (
    <div {...stylex.props(styles.jump)}>
      <Button
        onClick={() => {
          scrollToEnd({ behavior: 'instant' });
          viewport?.current?.focus({ preventScroll: true });
        }}
      >
        <ArrowDown size={16} aria-hidden />
        {label}
      </Button>
    </div>
  );
}

export const Conversation = {
  Root: ConversationRoot,
  Viewport: ConversationViewport,
  Content: ConversationContent,
  Item: ConversationItem,
  JumpToLatest: ConversationJumpToLatest,
};
