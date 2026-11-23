import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { BarCell, ChangeCell, HeatCell, IntervalCell, SparkCell } from '../../../charts/src/cells/index.ts';
import type { ValueFormat } from '../../../charts/src/index.ts';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { typography } from '../../../foundations/src/tokens.stylex.ts';
import { isScoreInterval } from './evaluation-data.ts';
import type { ScoreInterval } from './evaluation-data.ts';

/** How a leaderboard column draws its measure. */
export type LeaderboardColumnKind = 'score' | 'interval' | 'change' | 'trend' | 'heat';

type ColumnBase = {
  readonly id: string;
  /** The measure with its unit, as the header shows it: "Reasoning accuracy". */
  readonly label: string;
  /** How every value in the column is written. */
  readonly format: ValueFormat;
  /** Whether a larger value is better. It sets which value is marked best and what a rise means in a change column. */
  readonly isHigherBetter: boolean;
  /** The column's width in pixels. Each kind has a default that fits its graphic and text. */
  readonly width?: number | undefined;
  /** True to hide the column on a narrow screen. */
  readonly isSecondary?: boolean | undefined;
};

/**
 * One measure of the leaderboard: `score` is a bar from zero, `interval` an estimate with its interval, and `trend` a
 * small line of recent values ranked by the last. The `heat` kind is a shaded number and the `change` kind a signed
 * change with an arrow. Every kind but `change` draws on the column's `domain`, the same for every row.
 */
export type LeaderboardColumn =
  | (ColumnBase & { readonly kind: 'score' | 'interval' | 'trend'; readonly domain: readonly [number, number] })
  | (ColumnBase & {
      readonly kind: 'heat';
      readonly domain: readonly [number, number];
      /** `sequential` deepens one hue with the value; `diverging` uses two hues around zero. Defaults to sequential. */
      readonly palette?: 'sequential' | 'diverging' | undefined;
    })
  | (ColumnBase & { readonly kind: 'change' });

/**
 * A model's value in one column. It is a number for `score`, `heat` and `change`, an estimate with its interval for
 * `interval`, the recent values in order for `trend`, or null where it was not measured.
 */
export type LeaderboardValue = number | ScoreInterval | ReadonlyArray<number | null> | null;

export const columnWidths = { score: 160, interval: 300, change: 128, trend: 160, heat: 112 } as const;

const styles = stylex.create({ best: { fontWeight: typography.strongWeight } });

function isTrend(value: LeaderboardValue): value is ReadonlyArray<number | null> {
  return Array.isArray(value);
}

/** The sentence that says why a value does not fit its column, or undefined when it does. */
export function valueKindProblem(column: LeaderboardColumn, value: LeaderboardValue): string | undefined {
  if (value === null) {
    return undefined;
  }

  switch (column.kind) {
    case 'interval':
      return isScoreInterval(value) ? undefined : `Column ${column.id} takes an estimate with low and high bounds.`;
    case 'trend':
      return isTrend(value) ? undefined : `Column ${column.id} takes a list of recent values.`;
    case 'score':
    case 'heat':
    case 'change':
      return typeof value === 'number' ? undefined : `Column ${column.id} takes one number per model.`;
  }
}

/** The number a row is ranked by in a column: the value, the estimate, or the last recorded trend value. */
export function rankedValue(value: LeaderboardValue): number | null {
  if (isScoreInterval(value)) {
    return value.value;
  }

  if (isTrend(value)) {
    return value.at(-1) ?? null;
  }

  return value;
}

export type MeasureCellProps = {
  readonly column: LeaderboardColumn;
  readonly value: LeaderboardValue;
  readonly model: string;
  readonly locale: string;
  readonly isBest: boolean;
  /** The words a screen reader hears after the best value. */
  readonly bestLabel: string;
};

function MeasureGraphic({ column, value, model, locale }: Omit<MeasureCellProps, 'isBest' | 'bestLabel'>): ReactNode {
  const shared = { locale, format: column.format };
  const amount = typeof value === 'number' ? value : null;

  switch (column.kind) {
    case 'score':
      return <BarCell {...shared} id={model} value={amount} domain={column.domain} />;
    case 'interval': {
      const estimate = isScoreInterval(value) ? value : null;

      return (
        <IntervalCell
          {...shared}
          id={model}
          value={estimate?.value ?? null}
          interval={estimate === null ? null : [estimate.low, estimate.high]}
          domain={column.domain}
        />
      );
    }
    case 'trend':
      return <SparkCell {...shared} id={model} points={isTrend(value) ? value : []} domain={column.domain} />;
    case 'heat':
      return <HeatCell {...shared} value={amount} domain={column.domain} palette={column.palette ?? 'sequential'} />;
    case 'change':
      return <ChangeCell {...shared} value={amount} positiveIs={column.isHigherBetter ? 'good' : 'bad'} />;
  }
}

/** One measure of one model, drawn by its column's kind. The best value of the column is set in bold and named. */
export function MeasureCell({ isBest, bestLabel, ...cell }: MeasureCellProps): ReactNode {
  return (
    <div {...stylex.props(isBest && styles.best)}>
      <MeasureGraphic {...cell} />
      {isBest && <span {...stylex.props(accessibility.hidden)}>{bestLabel}</span>}
    </div>
  );
}
