import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

export type LevelLegendEntry = { readonly id: string; readonly text: string; readonly color: string };

const SWATCH_WIDTH = 16;
const SWATCH_HEIGHT = 3;

const styles = stylex.create({
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  item: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs },
  swatch: (color: string) => ({
    display: 'inline-block',
    width: SWATCH_WIDTH,
    height: SWATCH_HEIGHT,
    borderRadius: radii.sm,
    backgroundColor: color,
  }),
});

/** The values of the level lines, each beside a sample of its line, from the lowest level to the highest. */
export function LevelLegend({
  label,
  entries,
}: {
  readonly label: string;
  readonly entries: ReadonlyArray<LevelLegendEntry>;
}): ReactNode {
  return (
    <ul aria-label={label} {...stylex.props(styles.legend)}>
      {entries.map((entry) => (
        <li key={entry.id} {...stylex.props(styles.item)}>
          <span aria-hidden {...stylex.props(styles.swatch(entry.color))} />
          {entry.text}
        </li>
      ))}
    </ul>
  );
}
