import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Button, Row, Text } from '../../core/src/index.ts';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { useEndReached } from './use-end-reached.ts';

const styles = stylex.create({
  root: { minWidth: 0 },
  viewport: {
    'flex': 1,
    'minHeight': 0,
    'overflowY': 'auto',
    'overscrollBehaviorY': 'contain',
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  end: {
    ':empty': { minHeight: 0, padding: 0 },
    'minHeight': controls.coarseTarget,
    'padding': spacing.lg,
    'color': colors.muted,
    'fontSize': typography.captionSize,
    'fontFamily': typography.fontFamily,
    'lineHeight': typography.captionLineHeight,
    'textAlign': 'center',
  },
});

export type CollectionEndProps =
  | { readonly status: 'ready' | 'error'; readonly onLoadMore: () => void; readonly message?: string }
  | { readonly status: 'loading' | 'complete'; readonly onLoadMore?: never; readonly message?: string };

export function CollectionEnd(props: CollectionEndProps): ReactNode {
  switch (props.status) {
    case 'loading':
      return (
        <Text role="status" variant="caption" tone="muted">
          {props.message ?? 'Loading…'}
        </Text>
      );
    case 'complete':
      return props.message === undefined ? null : (
        <Text variant="caption" tone="muted">
          {props.message}
        </Text>
      );
    case 'ready':
      return <Button onClick={props.onLoadMore}>{props.message ?? 'Load more'}</Button>;
    case 'error':
      return (
        <Row role="status">
          <Text variant="caption" tone="muted">
            {props.message ?? 'More records could not be loaded.'}
          </Text>
          <Button onClick={props.onLoadMore}>Retry</Button>
        </Row>
      );
  }
}

export type CollectionScrollProps = {
  readonly children: ReactNode;
  readonly endContent?: ReactNode;
  readonly onEndReached?: (() => void) | undefined;
  readonly shouldFill?: boolean;
  readonly endPosition?: 'start' | 'end';
  readonly label?: string;
};

export function CollectionScroll({
  children,
  endContent,
  onEndReached,
  shouldFill = false,
  endPosition = 'end',
  label = 'Collection',
}: CollectionScrollProps): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();
  const viewport = scroll.viewport;
  const end = useRef<HTMLDivElement>(null);

  useEndReached({ end, viewport: shouldFill ? viewport : undefined, onEndReached, content: children });

  const boundary = (
    <div ref={end} {...stylex.props(endContent !== undefined && styles.end)}>
      {endContent}
    </div>
  );

  return (
    <div
      ref={scroll.ref}
      role={shouldFill ? 'region' : undefined}
      aria-label={shouldFill ? label : undefined}
      tabIndex={scroll.tabIndex}
      {...stylex.props(styles.root, shouldFill && styles.viewport)}
    >
      {endPosition === 'start' && boundary}
      {children}
      {endPosition === 'end' && boundary}
    </div>
  );
}
