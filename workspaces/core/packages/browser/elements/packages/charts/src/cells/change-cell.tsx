import * as stylex from '@stylexjs/stylex';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { CellLayout, cellProblem, InvalidCell } from './cell-layout.tsx';
import type { CellProps } from './cell-layout.tsx';

/** What a rise means for the reader: an improvement, a regression, or nothing either way. */
export type ChangeMeaning = 'good' | 'bad' | 'neutral';

export type ChangeCellProps = CellProps & {
  /** The signed change, or null for a change that could not be computed. */
  readonly value: number | null;
  /** What an increase means. A drop in latency is good and a drop in accuracy is bad, so the cell never assumes. */
  readonly positiveIs: ChangeMeaning;
};

type Direction = 'up' | 'down' | 'flat';

const ICON_SIZE = 14;
const TEXT_WIDTH_DEFAULT = 9;

const styles = stylex.create({
  change: (color: string) => ({ display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color }),
});

const icons = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

function direction(value: number): Direction {
  if (value === 0) {
    return 'flat';
  }

  return value > 0 ? 'up' : 'down';
}

function changeTone({
  moved,
  positiveIs,
}: {
  readonly moved: Direction;
  readonly positiveIs: ChangeMeaning;
}): ChartTone {
  if (moved === 'flat' || positiveIs === 'neutral') {
    return 'neutral';
  }

  return (positiveIs === 'good') === (moved === 'up') ? 'positive' : 'negative';
}

function signedFormat(format: ValueFormat): ValueFormat {
  return typeof format === 'function' ? format : { signDisplay: 'exceptZero', ...format };
}

/**
 * A signed change with an arrow and a tone, such as a score against the last release, or "Unavailable" with no arrow
 * when the change is missing. The text carries the sign and number so the arrow and color never stand alone, and a
 * function format must write the sign while an options format shows it. Up is not always good, so `positiveIs` says
 * what a rise means: a good change takes the positive hue, a bad one the negative, a neutral or absent one gray.
 */
export function ChangeCell({
  value,
  positiveIs,
  locale,
  format,
  align,
  textWidth = TEXT_WIDTH_DEFAULT,
}: ChangeCellProps): ReactNode {
  const problem = cellProblem({ values: [value] });

  if (problem !== undefined) {
    return <InvalidCell message={problem} align={align} textWidth={textWidth} />;
  }

  if (value === null) {
    return (
      <CellLayout align={align} textWidth={textWidth} state="missing">
        {formatValue({ value, locale, format })}
      </CellLayout>
    );
  }

  const moved = direction(value);
  const Icon = icons[moved];

  return (
    <CellLayout align={align} textWidth={textWidth}>
      <span {...stylex.props(styles.change(chartToneOutlines[changeTone({ moved, positiveIs })]))}>
        <Icon size={ICON_SIZE} aria-hidden />
        {formatValue({ value, locale, format: signedFormat(format) })}
      </span>
    </CellLayout>
  );
}
