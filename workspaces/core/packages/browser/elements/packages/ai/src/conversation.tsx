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
  controls: {
    boxSizing: 'border-box',
    flexShrink: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '80ch',
    marginInline: 'auto',
    paddingBlock: spacing.sm,
    paddingInline: spacing.lg,
  },
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
  readonly shouldFollow?: boolean;
  readonly viewportRef?: RefObject<HTMLDivElement | null> | undefined;
};

export type ConversationViewportProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly scrollRestorationId?: string;
};

export type ConversationContentProps = { readonly children: ReactNode; readonly isStreaming?: boolean };
export type ConversationItemProps = { readonly messageId: string; readonly children: ReactNode };
export type ConversationJumpProps = { readonly label?: string };
export type ConversationControlsProps = { readonly children: ReactNode };
export type ConversationLatestButtonProps = { readonly label: string; readonly onActivate?: () => void };

const ViewportContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);

function ConversationRoot({
  children,
  initialPosition = 'end',
  shouldFollow = true,
  viewportRef,
}: ConversationRootProps): ReactNode {
  const fallbackViewport = useRef<HTMLDivElement>(null);
  const viewport = viewportRef ?? fallbackViewport;

  return (
    <ViewportContext.Provider value={viewport}>
      <MessageScroller.Provider autoScroll={shouldFollow} defaultScrollPosition={initialPosition}>
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

function ConversationContent({ children, isStreaming = false }: ConversationContentProps): ReactNode {
  return (
    <MessageScroller.Content
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={isStreaming}
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

function ConversationControls({ children }: ConversationControlsProps): ReactNode {
  return <div {...stylex.props(styles.controls)}>{children}</div>;
}

function ConversationJumpToLatest({ label = 'Jump to latest' }: ConversationJumpProps): ReactNode {
  const { end } = useMessageScrollerScrollable();

  if (!end) {
    return null;
  }

  return (
    <div {...stylex.props(styles.jump)}>
      <ConversationLatestButton label={label} />
    </div>
  );
}

function ConversationLatestButton({ label, onActivate }: ConversationLatestButtonProps): ReactNode {
  const { scrollToEnd } = useMessageScroller();
  const viewport = useContext(ViewportContext);

  return (
    <Button
      onClick={() => {
        onActivate?.();
        requestAnimationFrame(() => {
          const target = viewport?.current;

          if (target !== undefined && target !== null) {
            scrollToEnd({ behavior: 'instant' });
            target.focus({ preventScroll: true });
          }
        });
      }}
    >
      <ArrowDown size={14} aria-hidden />
      {label}
    </Button>
  );
}

export const Conversation = {
  Root: ConversationRoot,
  Viewport: ConversationViewport,
  Content: ConversationContent,
  Item: ConversationItem,
  Controls: ConversationControls,
  LatestButton: ConversationLatestButton,
  JumpToLatest: ConversationJumpToLatest,
};
