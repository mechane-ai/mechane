import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  list: { listStyle: 'none', margin: 0, padding: 0, minWidth: 0 },
  item: {
    'position': 'relative',
    'display': 'grid',
    'gridTemplateColumns': '16px minmax(0, 1fr)',
    'columnGap': spacing.lg,
    'paddingBottom': spacing.xl,
    'minWidth': 0,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'color': colors.ink,
    '::before': {
      content: '""',
      position: 'absolute',
      insetInlineStart: 7,
      top: 24,
      bottom: 4,
      width: 1,
      backgroundColor: colors.line,
    },
    ':last-child::before': { display: 'none' },
    ':last-child': { paddingBottom: 0 },
  },
  icon: { display: 'flex', alignItems: 'center', height: 20, color: colors.muted },
  content: { display: 'grid', gap: spacing.sm, minWidth: 0 },
  header: { display: 'flex', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0 },
  title: { minWidth: 0, fontWeight: 500, overflowWrap: 'anywhere' },
  time: { color: colors.muted, fontSize: typography.captionSize, fontVariantNumeric: 'tabular-nums' },
  body: { minWidth: 0, maxWidth: '72ch', overflowWrap: 'anywhere' },
  metadata: { color: colors.muted, fontSize: typography.captionSize },
});

export type TimelineProps = { readonly label: string; readonly children: ReactNode };

export type TimelineItemProps = {
  readonly icon: ReactNode;
  readonly title: ReactNode;
  readonly time?: ReactNode;
  readonly metadata?: ReactNode;
  readonly children?: ReactNode;
};

function TimelineRoot({ label, children }: TimelineProps): ReactNode {
  return (
    <ol aria-label={label} {...stylex.props(styles.list)}>
      {children}
    </ol>
  );
}

function TimelineItem({ icon, title, time, metadata, children }: TimelineItemProps): ReactNode {
  return (
    <li {...stylex.props(styles.item)}>
      <span aria-hidden {...stylex.props(styles.icon)}>
        {icon}
      </span>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.title)}>{title}</div>
          {time !== undefined && <div {...stylex.props(styles.time)}>{time}</div>}
        </div>
        {children !== undefined && <div {...stylex.props(styles.body)}>{children}</div>}
        {metadata !== undefined && <div {...stylex.props(styles.metadata)}>{metadata}</div>}
      </div>
    </li>
  );
}

export const Timeline = { Root: TimelineRoot, Item: TimelineItem };
