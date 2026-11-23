import * as stylex from '@stylexjs/stylex';
import {
  createScrollAreaController,
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollToEnd,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import type { ScrollAreaController } from '@ui-sdk/react/scroll-area';
import { ArrowDown } from 'lucide-react';
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
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
    // The scroll area hides the native scrollbar inline until it has counted its own, and this viewport has none.
    'scrollbarWidth': 'auto !important',
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
  /** Captured at mount. A saved offset starts in reading mode; mount once the content is ready. */
  readonly initialPosition?: 'start' | 'end' | { readonly top: number; readonly left?: number } | undefined;
  readonly shouldFollow?: boolean;
  readonly viewportRef?: RefObject<HTMLDivElement | null> | undefined;
};

export type ConversationViewportProps = {
  readonly label: string;
  readonly children: ReactNode;
  readonly scrollRestorationId?: string;
};

export type ConversationContentProps = { readonly children: ReactNode; readonly isStreaming?: boolean };

export type ConversationItemProps = {
  readonly messageId: string;
  readonly shouldRevealOnAppend?: boolean;
  readonly children: ReactNode;
};

export type ConversationJumpProps = { readonly label?: string };
export type ConversationControlsProps = { readonly children: ReactNode };
export type ConversationLatestButtonProps = { readonly label: string; readonly onActivate?: () => void };

type ConversationScroll = {
  readonly controller: ScrollAreaController;
  readonly viewport: RefObject<HTMLDivElement | null>;
  /** Following starts once the reader is at the end, so a conversation opened elsewhere stays in reading mode. */
  readonly reachEnd: () => void;
};

const ScrollContext = createContext<ConversationScroll | undefined>(undefined);

function useConversationScroll(): ConversationScroll {
  const scroll = useContext(ScrollContext);

  if (scroll === undefined) {
    throw new Error('Render the parts of a conversation inside Conversation.Root.');
  }

  return scroll;
}

function isAtEnd(element: HTMLElement): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= 1;
}

/** A conversation on the UI SDK scroll area: it follows the end while a reply grows, until the reader scrolls up. */
function ConversationRoot({
  children,
  initialPosition = 'end',
  shouldFollow = true,
  viewportRef,
}: ConversationRootProps): ReactNode {
  const fallbackViewport = useRef<HTMLDivElement>(null);
  const viewport = viewportRef ?? fallbackViewport;
  const [position] = useState(initialPosition);
  const [controller] = useState(createScrollAreaController);
  const [hasReachedEnd, setReachedEnd] = useState(position === 'end');
  const [scroll] = useState<ConversationScroll>(() => ({ controller, viewport, reachEnd: () => setReachedEnd(true) }));

  useLayoutEffect(() => {
    if (typeof position === 'object') {
      viewport.current?.scrollTo({ top: position.top, left: position.left ?? 0, behavior: 'instant' });
    }
  }, [position, viewport]);

  return (
    <ScrollContext.Provider value={scroll}>
      <ScrollArea stickToEnd={shouldFollow && hasReachedEnd} controller={controller} {...stylex.props(styles.root)}>
        {children}
      </ScrollArea>
    </ScrollContext.Provider>
  );
}

function ConversationViewport({ label, children, scrollRestorationId }: ConversationViewportProps): ReactNode {
  const { viewport, reachEnd } = useConversationScroll();

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      viewport.current = node;

      // A conversation that fits its viewport is already at the end, so it follows from the start.
      if (node !== null && isAtEnd(node)) {
        reachEnd();
      }
    },
    [viewport, reachEnd],
  );

  return (
    <ScrollAreaViewport
      ref={attach}
      role="region"
      aria-label={label}
      tabIndex={0}
      data-scroll-restoration-id={scrollRestorationId}
      onScroll={(event) => {
        if (isAtEnd(event.currentTarget)) {
          reachEnd();
        }
      }}
      {...stylex.props(styles.viewport)}
    >
      {children}
    </ScrollAreaViewport>
  );
}

function ConversationContent({ children, isStreaming = false }: ConversationContentProps): ReactNode {
  return (
    <ScrollAreaContent
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={isStreaming}
      {...stylex.props(styles.content)}
    >
      {children}
    </ScrollAreaContent>
  );
}

function ConversationItem({ messageId, shouldRevealOnAppend = false, children }: ConversationItemProps): ReactNode {
  const { controller } = useConversationScroll();

  useLayoutEffect(() => {
    if (shouldRevealOnAppend) {
      controller.scrollToEnd({ behavior: 'instant' });
    }
  }, [messageId, shouldRevealOnAppend, controller]);

  return (
    <div data-message-id={messageId} {...stylex.props(styles.item)}>
      {children}
    </div>
  );
}

function ConversationControls({ children }: ConversationControlsProps): ReactNode {
  return <div {...stylex.props(styles.controls)}>{children}</div>;
}

/** Shows while the reader is away from the end. A press scrolls there, follows again and focuses the viewport. */
function ConversationJumpToLatest({ label = 'Jump to latest' }: ConversationJumpProps): ReactNode {
  return (
    <ScrollAreaScrollToEnd
      render={(props, { visible }) => (
        <div hidden={!visible} {...stylex.props(styles.jump)}>
          <Button {...props}>
            <ArrowDown size={14} aria-hidden />
            {label}
          </Button>
        </div>
      )}
    />
  );
}

function ConversationLatestButton({ label, onActivate }: ConversationLatestButtonProps): ReactNode {
  const { controller, viewport } = useConversationScroll();

  return (
    <Button
      onClick={() => {
        onActivate?.();
        requestAnimationFrame(() => {
          controller.scrollToEnd({ behavior: 'instant' });
          viewport.current?.focus({ preventScroll: true });
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
