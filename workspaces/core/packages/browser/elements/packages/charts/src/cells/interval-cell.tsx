import type { ReactNode } from 'react';
import { formatValue } from '../figure/figure-format.ts';
import { DotMark, IntervalMark } from '../plot/plot-marks.tsx';
import { continuousScale } from '../plot/scale.ts';
import { CellGraphic, cellHeight, CellLayout, cellProblem, InvalidCell, useCellTone } from './cell-layout.tsx';
import type { CellDomainProps, CellProps, CellToneProps } from './cell-layout.tsx';

export type IntervalCellProps = CellProps &
  CellDomainProps &
  CellToneProps & {
    /** The estimate, or null for a value that was not recorded. */
    readonly value: number | null;
    /** The lower and upper bound around the estimate, or null when none was computed. */
    readonly interval?: readonly [lower: number, upper: number] | null | undefined;
  };

const EDGE_INSET = 4;
const DOT_RADIUS = 3;
const TEXT_WIDTH_DEFAULT = 22;

/**
 * An estimate dot with an interval line, and the estimate and its range written beside it, or "Unavailable" and no mark
 * when the estimate is missing. In a table column of estimates with uncertainty, such as an accuracy with a confidence
 * interval, pass the column's `domain` to every row so all intervals share one scale. The application supplies the
 * bounds, and the cell checks that the lower bound is not above the estimate and the upper bound not below it, and
 * never reorders them.
 */
export function IntervalCell({
  value,
  interval = null,
  domain,
  locale,
  format,
  align,
  textWidth = TEXT_WIDTH_DEFAULT,
  id,
  tone,
}: IntervalCellProps): ReactNode {
  const markTone = useCellTone({ id, tone });
  const hasMissingPart = value === null || interval === null;
  const isBracketed = hasMissingPart || (interval[0] <= value && value <= interval[1]);

  const problem = isBracketed
    ? cellProblem({ domain, values: [value, ...(interval ?? [])] })
    : 'The interval must hold the estimate, with the lower bound first.';

  if (problem !== undefined) {
    return <InvalidCell message={problem} align={align} textWidth={textWidth} />;
  }

  const estimate = formatValue({ value, locale, format });

  const range =
    value === null || interval === null
      ? ''
      : ` (${formatValue({ value: interval[0], locale, format })} to ${formatValue({ value: interval[1], locale, format })})`;

  return (
    <CellLayout
      align={align}
      textWidth={textWidth}
      state={value === null ? 'missing' : 'value'}
      graphic={
        <CellGraphic>
          {(width) => {
            if (value === null) {
              return null;
            }

            const scale = continuousScale({ domain, range: [EDGE_INSET, width - EDGE_INSET] });
            const middle = cellHeight / 2;

            return (
              <>
                {interval !== null && (
                  <IntervalMark
                    x1={scale.position(interval[0])}
                    y1={middle}
                    x2={scale.position(interval[1])}
                    y2={middle}
                    tone={markTone}
                  />
                )}
                <DotMark x={scale.position(value)} y={middle} radius={DOT_RADIUS} tone={markTone} />
              </>
            );
          }}
        </CellGraphic>
      }
    >
      {estimate}
      {range}
    </CellLayout>
  );
}
