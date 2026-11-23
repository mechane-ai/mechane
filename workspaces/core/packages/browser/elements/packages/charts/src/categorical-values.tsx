import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, spacing } from '../../foundations/src/tokens.stylex.ts';
import { hasUniqueIds } from './chart-input.tsx';
import { ChartDatum, ChartRows } from './chart-rows.tsx';
import type { ChartItem, ChartView } from './chart.tsx';

const styles = stylex.create({
  rows: { display: 'grid', margin: 0, padding: 0, listStyle: 'none' },
  name: { display: 'flex', alignItems: 'center', gap: spacing.sm, flex: '1 1 12ch', minWidth: 0 },
  swatch: (color: string, outline: string) => ({
    width: 8,
    height: 8,
    flexShrink: 0,
    backgroundColor: color,
    boxShadow: `inset 0 0 0 1px ${outline}`,
  }),
  value: { color: colors.muted, textAlign: 'end', minWidth: 0, maxWidth: '100%' },
});

export type BreakdownItem = {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly tone?: ChartTone | undefined;
};

export const categoricalLimits = { items: 200, series: 12 } as const;

const TONES: ReadonlyArray<ChartTone> = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'];

export function colorTone(tone: ChartTone | undefined, index: number): ChartTone {
  return tone ?? TONES[index % TONES.length] ?? 'series1';
}

export function validateBreakdown(items: ReadonlyArray<BreakdownItem>): string | undefined {
  if (items.length > categoricalLimits.items) {
    return `Choose a window with at most ${categoricalLimits.items} items.`;
  }

  if (!hasUniqueIds(items)) {
    return 'Every breakdown item needs a unique identifier.';
  }

  if (items.some((item) => item.value !== null && (!Number.isFinite(item.value) || item.value < 0))) {
    return 'Breakdown values must be finite and nonnegative, or explicitly missing.';
  }

  if (!Number.isFinite(items.reduce((sum, item) => sum + (item.value ?? 0), 0))) {
    return 'The sum of recorded values must be finite.';
  }

  return undefined;
}

export type CategoricalValue = {
  readonly id: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly tone: ChartTone;
};

/** What a chart of categorical values tells its readers and agents about each item. */
export function categoricalItems(items: ReadonlyArray<CategoricalValue>): ReadonlyArray<ChartItem> {
  return items.map((item) => ({ id: item.id, label: `${item.label}: ${item.valueLabel}` }));
}

export function CategoricalValues({
  title,
  items,
  view,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<CategoricalValue>;
  /** The chart's view when its rows can be selected. */
  readonly view: ChartView | undefined;
}): ReactNode {
  return (
    <ChartRows title={title} items={categoricalItems(items)} view={view}>
      <ul {...stylex.props(styles.rows)}>
        {items.map((item) => (
          <li key={item.id}>
            <ChartDatum id={item.id} label={`${item.label}: ${item.valueLabel}`} view={view}>
              <span {...stylex.props(styles.name)}>
                <span
                  aria-hidden
                  {...stylex.props(styles.swatch(chartToneColors[item.tone], chartToneOutlines[item.tone]))}
                />
                {item.label}
              </span>
              <span {...stylex.props(styles.value)}>{item.valueLabel}</span>
            </ChartDatum>
          </li>
        ))}
      </ul>
    </ChartRows>
  );
}
