import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import type { ComponentProps, ReactNode } from 'react';
import { spacing } from '../../foundations/src/tokens.stylex.ts';

export type FigureGridLayout = '2-up' | 'hero-aside' | '3-up';

const narrowGrid = '@container figure-grid (max-width: 840px)';
const mediumGrid = '@container figure-grid (max-width: 1120px)';

const styles = stylex.create({
  container: { containerType: 'inline-size', containerName: 'figure-grid', minWidth: 0 },
  grid: { display: 'grid', gap: spacing.xl, alignItems: 'stretch', minWidth: 0 },
  twoUp: { gridTemplateColumns: { default: 'repeat(2, minmax(0, 1fr))', [narrowGrid]: 'minmax(0, 1fr)' } },
  heroAside: { gridTemplateColumns: { default: 'minmax(0, 1.5fr) minmax(0, 1fr)', [narrowGrid]: 'minmax(0, 1fr)' } },
  threeUp: {
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      [mediumGrid]: 'repeat(2, minmax(0, 1fr))',
      [narrowGrid]: 'minmax(0, 1fr)',
    },
  },
});

const layoutStyles = { '2-up': styles.twoUp, 'hero-aside': styles.heroAside, '3-up': styles.threeUp } satisfies Record<
  FigureGridLayout,
  stylex.StyleXStyles
>;

export type FigureGridProps = ComponentProps<'div'> & {
  /** Responsive multi-figure arrangement that collapses cleanly by container width. */
  readonly layout?: FigureGridLayout;
};

/** Arranges sibling analytical figures on a responsive container-aware grid with shared spacing. */
export function FigureGrid({ layout = '2-up', children, ...props }: FigureGridProps): ReactNode {
  return (
    <div {...stylex.props(styles.container)}>
      <div {...mergeProps(stylex.props(styles.grid, layoutStyles[layout]), props)}>{children}</div>
    </div>
  );
}
