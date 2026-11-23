import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalItems, CategoricalValues, validateBreakdown } from '../categorical-values.tsx';
import type { BreakdownItem } from '../categorical-values.tsx';
import { Chart } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';

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
  segment: (width: number, color: string, outline: string) => ({
    width: `${width}%`,
    backgroundColor: color,
    boxShadow: `inset 0 0 0 1px ${outline}`,
    height: '100%',
  }),
  note: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
});

const PERCENT = 100;

export type BreakdownBarProps = FigureProps &
  FigureSelectionProps & {
    readonly items: ReadonlyArray<BreakdownItem>;
    /** The declared whole. Recorded values may fall short of it; the rest is shown as unassigned. */
    readonly total: number;
    readonly valueFormat: ValueFormat;
  };

/**
 * The parts of one declared total as a single strip with a row per part. Use it when the whole and an unassigned
 * remainder matter; the application supplies every part and the total.
 */
export function BreakdownBar({
  items,
  total,
  valueFormat,
  selected,
  onSelectedChange,
  ...figure
}: BreakdownBarProps): ReactNode {
  const { emptyLabel = 'No values', ...frame } = figure;
  const { locale, title } = frame;
  const tones = useTones();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="compact" />;
  }

  const issue = validateBreakdown(items);
  const recorded = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const roundingTolerance = Number.EPSILON * Math.max(recorded, total, 1) * items.length;

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  if (!Number.isFinite(total) || total < 0 || recorded - total > roundingTolerance) {
    return <FigureInvalid {...frame} message="The total must be finite and at least the sum of recorded values." />;
  }

  function text(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const values = items.map((item, index) => ({
    id: item.id,
    label: item.label,
    valueLabel: text(item.value),
    tone: tones({ id: item.id, tone: item.tone, index }),
  }));

  return (
    <Chart
      items={categoricalItems(values)}
      arrows="both"
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame {...frame} figure={figureProps}>
          {items.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <div aria-hidden {...stylex.props(styles.track)}>
                {items.map((item, index) => {
                  const tone = values[index]?.tone ?? 'neutral';

                  return item.value === null ? null : (
                    <span
                      key={item.id}
                      {...stylex.props(
                        styles.segment(
                          total === 0 ? 0 : (item.value / total) * PERCENT,
                          chartToneColors[tone],
                          chartToneOutlines[tone],
                        ),
                      )}
                    />
                  );
                })}
              </div>
              <CategoricalValues
                title={title}
                items={values}
                view={onSelectedChange === undefined ? undefined : view}
              />
              {total - recorded > roundingTolerance && (
                <p {...stylex.props(styles.note)}>
                  Unassigned portion: {text(total - recorded)} of {text(total)}
                </p>
              )}
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
