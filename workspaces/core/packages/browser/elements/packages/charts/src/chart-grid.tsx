import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { ChartLink } from './chart-link.tsx';
import type { ChartLinkProps } from './chart-link.tsx';
import { ToneScope } from './figure/tone-scope.tsx';

export type ChartGridProps = Omit<ChartLinkProps, 'children'> & {
  readonly title: string;
  readonly description?: string | undefined;
  /** The narrowest a panel may be, in CSS pixels. The grid fits as many columns as that allows. */
  readonly minPanelWidth?: number | undefined;
  /** Every series, model or run the panels draw, so each keeps one hue in every panel. */
  readonly ids?: ReadonlyArray<string> | undefined;
  readonly tones?: Readonly<Record<string, ChartTone>> | undefined;
  /** The figures, one per panel. */
  readonly children: ReactNode;
};

const DEFAULT_PANEL_WIDTH = 320;

const styles = stylex.create({
  grid: { display: 'grid', gap: spacing.lg, minWidth: 0, margin: 0, padding: 0, borderWidth: 0 },
  heading: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.inputSize,
    fontWeight: typography.strongWeight,
    lineHeight: typography.bodyLineHeight,
  },
  description: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  panels: (minimum: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(min(${minimum}px, 100%), 1fr))`,
    columnGap: spacing.lg,
    rowGap: spacing.xl,
    alignItems: 'start',
    minWidth: 0,
  }),
});

/**
 * Figures side by side as one comparison: a panel per metric, layer or split. The panels share one inspection, so
 * pointing at a record in one marks it in all, and one tone scope, so a series keeps its hue across panels.
 */
export function ChartGrid({
  title,
  description,
  minPanelWidth = DEFAULT_PANEL_WIDTH,
  ids = [],
  tones,
  children,
  ...link
}: ChartGridProps): ReactNode {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} {...stylex.props(styles.grid)}>
      <div {...stylex.props(styles.heading)}>
        <p id={titleId} {...stylex.props(styles.title)}>
          {title}
        </p>
        {description !== undefined && <p {...stylex.props(styles.description)}>{description}</p>}
      </div>
      <ToneScope ids={ids} tones={tones}>
        <ChartLink {...link}>
          <div {...stylex.props(styles.panels(minPanelWidth))}>{children}</div>
        </ChartLink>
      </ToneScope>
    </section>
  );
}
