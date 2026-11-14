import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../foundations/src/chart-tones.ts';
import { colors, spacing } from '../../foundations/src/tokens.stylex.ts';
import { ChartDatumButton } from './chart-frame.tsx';
import type { ChartSelection } from './chart-frame.tsx';
import { hasUniqueIds } from './chart-input.tsx';

const styles = stylex.create({
  rows: { display: 'grid', margin: 0, padding: 0, listStyle: 'none' },
  name: { display: 'flex', alignItems: 'center', gap: spacing.sm, flex: '1 1 12ch', minWidth: 0 },
  swatch: (color: string) => ({ width: 8, height: 8, flexShrink: 0, backgroundColor: color }),
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

export function CategoricalValues({
  items,
  selection,
}: {
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly valueLabel: string;
    readonly tone: ChartTone;
  }>;
  readonly selection?: ChartSelection | undefined;
}): ReactNode {
  return (
    <ul {...stylex.props(styles.rows)}>
      {items.map((item) => (
        <li key={item.id}>
          <ChartDatumButton
            label={`${item.label}: ${item.valueLabel}`}
            isSelected={selection?.selectedId === item.id}
            onSelect={selection === undefined ? undefined : () => selection.onSelect(item.id)}
          >
            <span {...stylex.props(styles.name)}>
              <span aria-hidden {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
              {item.label}
            </span>
            <span {...stylex.props(styles.value)}>{item.valueLabel}</span>
          </ChartDatumButton>
        </li>
      ))}
    </ul>
  );
}
