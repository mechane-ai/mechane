import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { CategoricalValues, colorTone, validateBreakdown } from '../categorical-values.tsx';
import type { BreakdownItem } from '../categorical-values.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { chartToneColors } from '../chart-theme.ts';

const styles = stylex.create({
  track: {
    display: 'flex',
    height: 10,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    marginBlockEnd: spacing.sm,
  },
  segment: (width: number, color: string) => ({ width: `${width}%`, backgroundColor: color, height: '100%' }),
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
});

export type BreakdownBarProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly items: ReadonlyArray<BreakdownItem>;
  readonly total: number;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection | undefined;
};

export function BreakdownBar({
  title,
  description,
  items,
  total,
  formatValue,
  selection,
}: BreakdownBarProps): ReactNode {
  const issue = validateBreakdown(items);
  const recorded = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const roundingTolerance = Number.EPSILON * Math.max(recorded, total, 1) * items.length;

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} message={issue} />;
  }

  if (!Number.isFinite(total) || total < 0 || recorded - total > roundingTolerance) {
    return (
      <ChartInputError
        title={title}
        description={description}
        message="The total must be finite and at least the sum of recorded values."
      />
    );
  }

  return (
    <ChartFrame title={title} description={description}>
      {items.length === 0 ? (
        <p {...stylex.props(styles.empty)}>No values</p>
      ) : (
        <>
          <div aria-hidden {...stylex.props(styles.track)}>
            {items.map((item, index) =>
              item.value === null ? null : (
                <span
                  key={item.id}
                  {...stylex.props(
                    styles.segment(
                      total === 0 ? 0 : (item.value / total) * 100,
                      chartToneColors[colorTone(item.tone, index)],
                    ),
                  )}
                />
              ),
            )}
          </div>
          <CategoricalValues
            items={items.map((item, index) => ({
              id: item.id,
              label: item.label,
              valueLabel: item.value === null ? 'Unavailable' : formatValue(item.value),
              tone: colorTone(item.tone, index),
            }))}
            selection={selection}
          />
          {total - recorded > roundingTolerance && (
            <p {...stylex.props(styles.empty)}>
              Unassigned portion: {formatValue(total - recorded)} of {formatValue(total)}
            </p>
          )}
        </>
      )}
    </ChartFrame>
  );
}
