import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { Field, Fieldset, NumberField } from '../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { formatValue } from '../figure/figure-format.ts';
import type { MeasureAxis } from './measures.ts';

/** The value range kept on each axis, by dimension id. An axis with no entry keeps every value. */
export type AxisRanges = Readonly<Record<string, readonly [number, number]>>;

/** Why the ranges changed: a drag on an axis, a typed bound, or the clear button. */
export type AxisRangeReason = 'drag' | 'input' | 'clear-press';

export type RangeControlsProps = {
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly ranges: AxisRanges;
  readonly locale: string;
  /** How many rows lie inside every range. */
  readonly matching: number;
  readonly total: number;
  readonly onChange: (ranges: AxisRanges, reason: AxisRangeReason) => void;
};

const STEPS = 1000;

const styles = stylex.create({
  details: {
    display: 'grid',
    gap: spacing.md,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  summary: { cursor: 'pointer', fontVariantNumeric: 'tabular-nums' },
  body: { display: 'grid', gap: spacing.md, marginBlockStart: spacing.md },
  fields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: spacing.md },
  pair: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm },
  note: { margin: 0, color: colors.muted, fontSize: typography.captionSize },
});

/**
 * The same axis ranges a drag sets, as number inputs under the plot, for a keyboard, a touch screen or an agent. Each
 * axis takes a minimum and a maximum inside its domain, and one button clears every range.
 */
export function RangeControls({ axes, ranges, locale, matching, total, onChange }: RangeControlsProps): ReactNode {
  const hasRanges = Object.keys(ranges).length > 0;

  return (
    <details {...stylex.props(styles.details)}>
      <summary {...stylex.props(styles.summary)}>
        Axis ranges · {matching} of {total} rows in range
      </summary>
      <div {...stylex.props(styles.body)}>
        <div>
          <TextButton density="compact" disabled={!hasRanges} onClick={() => onChange({}, 'clear-press')}>
            Clear ranges
          </TextButton>
        </div>
        <div {...stylex.props(styles.fields)}>
          {axes.map((axis) => {
            const [low, high] = ranges[axis.id] ?? axis.domain;
            const formatProps = typeof axis.format === 'function' ? {} : { format: axis.format };
            const step = (axis.domain[1] - axis.domain[0]) / STEPS;
            const domainText = `${formatValue({ value: axis.domain[0], locale, format: axis.format })} to ${formatValue({ value: axis.domain[1], locale, format: axis.format })}`;

            return (
              <Fieldset.Root key={axis.id}>
                <Fieldset.Legend>{axis.label}</Fieldset.Legend>
                <div {...stylex.props(styles.pair)}>
                  <Field.Root>
                    <Field.Label>Minimum</Field.Label>
                    <NumberField.Root
                      density="compact"
                      locale={locale}
                      {...formatProps}
                      value={low}
                      min={axis.domain[0]}
                      max={high}
                      step={step}
                      onValueChange={(next) => {
                        if (next !== null) {
                          onChange({ ...ranges, [axis.id]: [next, high] }, 'input');
                        }
                      }}
                    >
                      <NumberField.Group>
                        <NumberField.Input />
                      </NumberField.Group>
                    </NumberField.Root>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Maximum</Field.Label>
                    <NumberField.Root
                      density="compact"
                      locale={locale}
                      {...formatProps}
                      value={high}
                      min={low}
                      max={axis.domain[1]}
                      step={step}
                      onValueChange={(next) => {
                        if (next !== null) {
                          onChange({ ...ranges, [axis.id]: [low, next] }, 'input');
                        }
                      }}
                    >
                      <NumberField.Group>
                        <NumberField.Input />
                      </NumberField.Group>
                    </NumberField.Root>
                  </Field.Root>
                </div>
                <p {...stylex.props(styles.note)}>Domain {domainText}</p>
              </Fieldset.Root>
            );
          })}
        </div>
      </div>
    </details>
  );
}
