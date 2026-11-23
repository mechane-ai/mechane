import type { ReactNode } from 'react';
import { formatValue } from '../figure/figure-format.ts';
import { BarMark, RuleMark } from '../plot/plot-marks.tsx';
import { continuousScale } from '../plot/scale.ts';
import { CellGraphic, cellHeight, CellLayout, cellProblem, InvalidCell, useCellTone } from './cell-layout.tsx';
import type { CellDomainProps, CellProps, CellToneProps } from './cell-layout.tsx';

export type BarCellProps = CellProps &
  CellDomainProps &
  CellToneProps & {
    /** The amount, or null for a value that was not recorded. */
    readonly value: number | null;
  };

const EDGE_INSET = 1;
const BAR_HEIGHT = 8;

/**
 * A bar from zero to the value with the exact value written beside it, for a table column of amounts compared by
 * length, such as accuracy or cost. Pass the column's `domain` to every row so all bars share one scale, and make it
 * include zero. A negative value reaches left of the zero line, and a missing value shows "Unavailable" and no bar,
 * never an empty bar.
 */
export function BarCell({ value, domain, locale, format, align, textWidth, id, tone }: BarCellProps): ReactNode {
  const barTone = useCellTone({ id, tone });
  const isZeroOutside = domain[0] > 0 || domain[1] < 0;

  const problem = isZeroOutside
    ? 'A bar starts at zero, so the column domain must include zero.'
    : cellProblem({ domain, values: [value] });

  if (problem !== undefined) {
    return <InvalidCell message={problem} align={align} textWidth={textWidth} />;
  }

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
            const zero = scale.position(0);
            const end = scale.position(value);

            return (
              <>
                <BarMark
                  x={Math.min(zero, end)}
                  y={(cellHeight - BAR_HEIGHT) / 2}
                  width={Math.abs(end - zero)}
                  height={BAR_HEIGHT}
                  tone={barTone}
                />
                <RuleMark x1={zero} y1={0} x2={zero} y2={cellHeight} />
              </>
            );
          }}
        </CellGraphic>
      }
    >
      {formatValue({ value, locale, format })}
    </CellLayout>
  );
}
