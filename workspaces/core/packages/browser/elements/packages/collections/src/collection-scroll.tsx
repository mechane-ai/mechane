import * as stylex from '@stylexjs/stylex';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Button, Muted, Row } from '../../core/src/index.ts';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useEndReached } from './use-end-reached.ts';

const styles = stylex.create({
  viewport: { flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' },
  end: {
    ':empty': { minHeight: 0, padding: 0 },
    'minHeight': controls.coarseTarget,
    'padding': spacing.lg,
    'color': colors.muted,
    'fontSize': typography.captionSize,
    'textAlign': 'center',
  },
});

export type CollectionEndProps =
  | { readonly status: 'ready' | 'error'; readonly onLoadMore: () => void; readonly message?: string }
  | { readonly status: 'loading' | 'complete'; readonly onLoadMore?: never; readonly message?: string };

export function CollectionEnd(props: CollectionEndProps): ReactNode {
  switch (props.status) {
    case 'loading':
      return <span role="status">{props.message ?? 'Loading…'}</span>;
    case 'complete':
      return props.message === undefined ? null : <Muted>{props.message}</Muted>;
    case 'ready':
      return <Button onClick={props.onLoadMore}>{props.message ?? 'Load more'}</Button>;
    case 'error':
      return (
        <Row role="status">
          <Muted>{props.message ?? 'More records could not be loaded.'}</Muted>
          <Button onClick={props.onLoadMore}>Retry</Button>
        </Row>
      );
  }
}

export type CollectionScrollProps = {
  readonly children: ReactNode;
  readonly endContent?: ReactNode;
  readonly onEndReached?: (() => void) | undefined;
  readonly fill?: boolean;
  readonly endPosition?: 'start' | 'end';
};

export function CollectionScroll({
  children,
  endContent,
  onEndReached,
  fill = false,
  endPosition = 'end',
}: CollectionScrollProps): ReactNode {
  const viewport = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEndReached({ end, viewport: fill ? viewport : undefined, onEndReached, content: children });

  const boundary = (
    <div ref={end} {...stylex.props(endContent !== undefined && styles.end)}>
      {endContent}
    </div>
  );

  return (
    <div ref={viewport} {...stylex.props(fill && styles.viewport)}>
      {endPosition === 'start' && boundary}
      {children}
      {endPosition === 'end' && boundary}
    </div>
  );
}
