import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  list: { listStyle: 'none', margin: 0, padding: 0, minWidth: 0 },
  item: {
    'position': 'relative',
    'display': 'grid',
    'gridTemplateColumns': `${controls.iconSize} minmax(0, 1fr)`,
    'columnGap': spacing.lg,
    'paddingBottom': spacing.xl,
    'minWidth': 0,
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
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
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: typography.bodyLineHeight,
    color: colors.muted,
  },
  content: { display: 'grid', gap: spacing.sm, minWidth: 0 },
  header: { display: 'flex', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0 },
  title: { minWidth: 0, fontWeight: typography.mediumWeight, overflowWrap: 'anywhere' },
  time: {
    minWidth: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  body: { minWidth: 0, maxWidth: '72ch', overflowWrap: 'anywhere' },
  metadata: {
    minWidth: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  disclosure: { minWidth: 0, width: '100%' },
  trigger: {
    width: 'auto',
    minHeight: { default: typography.bodyLineHeight, [conditions.coarsePointer]: controls.coarseTarget },
    paddingBlock: 0,
    justifyContent: 'start',
  },
});

export type TimelineProps = { readonly label: string; readonly children: ReactNode };

export type TimelineItemProps = {
  readonly icon: ReactNode;
  readonly time?: ReactNode;
  readonly metadata?: ReactNode;
  readonly children?: ReactNode;
} & (
  | { readonly title: ReactNode; readonly details?: never; readonly defaultOpen?: never }
  | { readonly title: string; readonly details: ReactNode; readonly defaultOpen?: boolean }
);

function TimelineRoot({ label, children }: TimelineProps): ReactNode {
  return (
    <ol aria-label={label} {...stylex.props(styles.list)}>
      {children}
    </ol>
  );
}

function TimelineItem({
  icon,
  title,
  time,
  metadata,
  children,
  details,
  defaultOpen = false,
}: TimelineItemProps): ReactNode {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.title)}>
        {details === undefined ? (
          title
        ) : (
          <Collapsible.Trigger {...stylex.props(styles.trigger)}>{title}</Collapsible.Trigger>
        )}
      </div>
      {time !== undefined && time !== null && <div {...stylex.props(styles.time)}>{time}</div>}
    </div>
  );

  const hasPreview = children !== undefined && children !== null;
  const showPreview = !open || details === undefined;

  const content = (
    <>
      {header}
      {hasPreview && showPreview && <div {...stylex.props(styles.body)}>{children}</div>}
      {metadata !== undefined && metadata !== null && <div {...stylex.props(styles.metadata)}>{metadata}</div>}
      {details !== undefined && <Collapsible.Panel>{details}</Collapsible.Panel>}
    </>
  );

  return (
    <li {...stylex.props(styles.item)}>
      <span aria-hidden {...stylex.props(styles.icon)}>
        {icon}
      </span>
      {details === undefined ? (
        <div {...stylex.props(styles.content)}>{content}</div>
      ) : (
        <Collapsible.Root open={open} onOpenChange={setOpen} {...stylex.props(styles.content, styles.disclosure)}>
          {content}
        </Collapsible.Root>
      )}
    </li>
  );
}

export const Timeline = { Root: TimelineRoot, Item: TimelineItem };
