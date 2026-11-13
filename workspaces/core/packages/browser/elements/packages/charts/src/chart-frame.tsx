import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Collapsible } from '../../core/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, shadows, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { chartToneColors } from './chart-theme.ts';
import type { ChartTone } from './chart-theme.ts';

export type ChartSelection = { readonly selectedId: string | undefined; readonly onSelect: (id: string) => void };

export type ChartFrameProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
};

export type ChartLegendItem = { readonly id: string; readonly label: string; readonly tone: ChartTone };

export type ChartLegendProps = {
  readonly items: ReadonlyArray<ChartLegendItem>;
  readonly label?: string | undefined;
  readonly isScrollable?: boolean | undefined;
};

const styles = stylex.create({
  frame: {
    minWidth: 0,
    margin: 0,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontWeight: typography.regularWeight,
    lineHeight: typography.bodyLineHeight,
  },
  heading: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'start',
    gap: spacing.md,
    paddingBlockEnd: spacing.lg,
  },
  title: { flex: '1 1 200px', minWidth: 0, overflowWrap: 'anywhere' },
  caption: {
    margin: 0,
    fontSize: typography.inputSize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
  },
  description: {
    margin: 0,
    marginBlockStart: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, maxWidth: '100%' },
  footer: {
    marginBlockStart: spacing.md,
    minWidth: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  scrollLegend: { flexWrap: 'nowrap', overflowX: 'auto', minHeight: typography.captionLineHeight },
  scrollItem: { flexShrink: 0, maxWidth: 'none', whiteSpace: 'nowrap' },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
    maxWidth: '100%',
    overflowWrap: 'anywhere',
  },
  swatch: (color: string) => ({ width: 8, height: 8, flexShrink: 0, backgroundColor: color }),
  datum: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    minWidth: 0,
    minHeight: { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    boxSizing: 'border-box',
    width: '100%',
    borderWidth: 0,
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontWeight: typography.regularWeight,
    lineHeight: typography.bodyLineHeight,
    textAlign: 'start',
    overflowWrap: 'anywhere',
    color: colors.ink,
    backgroundColor: colors.surface,
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: -2,
    },
  },
  selected: { backgroundColor: colors.canvas, boxShadow: shadows.selection },
  readout: {
    margin: 0,
    minWidth: 0,
    minHeight: typography.captionLineHeight,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  disclosure: { marginBlockStart: spacing.md, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.line },
  data: {
    'minWidth': 0,
    'maxHeight': 320,
    'overflow': 'auto',
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineWidth: controls.focusWidth,
      outlineOffset: -2,
    },
  },
});

export function ChartFrame({ title, description, children, actions, footer }: ChartFrameProps): ReactNode {
  const titleId = useId();

  return (
    <figure aria-labelledby={titleId} {...stylex.props(styles.frame)}>
      <figcaption {...stylex.props(styles.heading)}>
        <div {...stylex.props(styles.title)}>
          <p id={titleId} {...stylex.props(styles.caption)}>
            {title}
          </p>
          {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
        </div>
        {actions !== undefined && <div {...stylex.props(styles.actions)}>{actions}</div>}
      </figcaption>
      {children}
      {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </figure>
  );
}

export function ChartLegend({ items, label = 'Legend', isScrollable = false }: ChartLegendProps): ReactNode {
  return (
    <ul aria-label={label} {...stylex.props(styles.legend, isScrollable && styles.scrollLegend)}>
      {items.map((item) => (
        <li key={item.id} {...stylex.props(styles.legendItem, isScrollable && styles.scrollItem)}>
          <span aria-hidden {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartDatumButton({
  label,
  isSelected = false,
  onSelect,
  children,
}: {
  readonly label: string;
  readonly isSelected?: boolean | undefined;
  readonly onSelect?: (() => void) | undefined;
  readonly children: ReactNode;
}): ReactNode {
  if (onSelect === undefined) {
    return <div {...stylex.props(styles.datum)}>{children}</div>;
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      onClick={onSelect}
      {...stylex.props(styles.datum, styles.action, isSelected && styles.selected)}
    >
      {children}
    </button>
  );
}

export function ChartReadout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <p aria-live="polite" {...stylex.props(styles.readout)}>
      {children}
    </p>
  );
}

export function ChartDataDisclosure({
  children,
  label = 'View data',
}: {
  readonly children: ReactNode;
  readonly label?: string | undefined;
}): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();

  return (
    <div {...stylex.props(styles.disclosure)}>
      <Collapsible.Root>
        <Collapsible.Trigger>{label}</Collapsible.Trigger>
        <Collapsible.Panel>
          <div
            ref={scroll.ref}
            role="region"
            aria-label={label}
            tabIndex={scroll.tabIndex}
            {...stylex.props(styles.data)}
          >
            {children}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
