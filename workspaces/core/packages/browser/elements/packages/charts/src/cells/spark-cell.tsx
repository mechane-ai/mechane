import type { ReactNode } from 'react';
import { formatValue } from '../figure/figure-format.ts';
import { isolatedPoints, linePath } from '../plot/path.ts';
import { DotMark, LineMark } from '../plot/plot-marks.tsx';
import { continuousScale } from '../plot/scale.ts';
import { CellGraphic, cellHeight, CellLayout, cellProblem, InvalidCell, useCellTone } from './cell-layout.tsx';
import type { CellDomainProps, CellProps, CellToneProps } from './cell-layout.tsx';

export type SparkCellProps = CellProps &
  CellDomainProps &
  CellToneProps & {
    /** Observations in order, equally spaced. A null is a gap: the line breaks there and is never drawn through it. */
    readonly points: ReadonlyArray<number | null>;
    /**
     * Which observation the dot marks and the text writes: `last`, the most recent one, or `peak`, the highest recorded
     * one (the first, when several tie), such as a best score. Absent means last.
     */
    readonly label?: 'last' | 'peak' | undefined;
  };

/** The most observations a spark cell draws. A longer series is refused. */
export const sparkCellLimits = { points: 240 } as const;

const EDGE_INSET = 3;
const MARKED_RADIUS = 2.5;
const GAP_RADIUS = 1.5;

/**
 * A tiny line of equally spaced observations with no axes, and the last value, or the peak with `label="peak"`, marked
 * and written beside it. Use it in a table column showing how a value moved, such as a score over recent runs, and pass
 * the column's `domain` to every row for one shared scale. If the last observation is missing, the text says
 * "Unavailable" while the line keeps what was recorded, and a series with no recorded value draws nothing.
 */
export function SparkCell({
  points,
  domain,
  locale,
  format,
  align,
  textWidth,
  id,
  tone,
  label = 'last',
}: SparkCellProps): ReactNode {
  const lineTone = useCellTone({ id, tone });
  const recorded = points.flatMap((point) => (point === null ? [] : [point]));
  const markedIndex = label === 'peak' ? points.indexOf(Math.max(...recorded)) : points.length - 1;
  const marked = points[markedIndex] ?? null;

  const problem =
    points.length > sparkCellLimits.points
      ? `A spark cell draws at most ${sparkCellLimits.points} points.`
      : cellProblem({ domain, values: points });

  if (problem !== undefined) {
    return <InvalidCell message={problem} align={align} textWidth={textWidth} />;
  }

  const hasRecorded = points.some((point) => point !== null);

  return (
    <CellLayout
      align={align}
      textWidth={textWidth}
      state={marked === null ? 'missing' : 'value'}
      graphic={
        <CellGraphic>
          {(width) => {
            if (!hasRecorded) {
              return null;
            }

            const x = continuousScale({
              domain: [0, Math.max(points.length - 1, 1)],
              range: [EDGE_INSET, width - EDGE_INSET],
            });

            const y = continuousScale({ domain, range: [cellHeight - EDGE_INSET, EDGE_INSET] });

            const path = points.map((point, index) => ({
              x: x.position(index),
              y: point === null ? null : y.position(point),
            }));

            return (
              <>
                <LineMark d={linePath(path)} tone={lineTone} />
                {isolatedPoints(path).map((point) => (
                  <DotMark key={point.x} x={point.x} y={point.y} radius={GAP_RADIUS} tone={lineTone} />
                ))}
                {marked !== null && (
                  <DotMark x={x.position(markedIndex)} y={y.position(marked)} radius={MARKED_RADIUS} tone={lineTone} />
                )}
              </>
            );
          }}
        </CellGraphic>
      }
    >
      {formatValue({ value: marked, locale, format })}
    </CellLayout>
  );
}
