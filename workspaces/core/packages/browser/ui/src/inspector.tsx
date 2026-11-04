import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { colors, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  split: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  master: { minWidth: 0 },
  detail: {
    minWidth: 0,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  list: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, 1.6fr)',
    columnGap: spacing.xl,
    rowGap: spacing.md,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  label: { color: colors.muted },
  item: { display: 'contents' },
  value: { margin: 0, color: colors.ink, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
});

type InspectorProps = ComponentProps<'div'> & {
  readonly master: ReactNode;
  readonly detail: ReactNode;
  readonly label: string;
};

type DetailItem = { readonly label: string; readonly value: ReactNode };
type DetailsProps = ComponentProps<'dl'> & { readonly items: ReadonlyArray<DetailItem> };

export function Inspector({ master, detail, label, ...props }: InspectorProps): ReactNode {
  return (
    <div {...mergeProps(stylex.props(styles.split), props)}>
      <div {...stylex.props(styles.master)}>{master}</div>
      <aside aria-label={label} {...stylex.props(styles.detail)}>
        {detail}
      </aside>
    </div>
  );
}

export function Details({ items, ...props }: DetailsProps): ReactNode {
  return (
    <dl {...mergeProps(stylex.props(styles.list), props)}>
      {items.map(({ label, value }) => (
        <div key={label} {...stylex.props(styles.item)}>
          <dt {...stylex.props(styles.label)}>{label}</dt>
          <dd {...stylex.props(styles.value)}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
