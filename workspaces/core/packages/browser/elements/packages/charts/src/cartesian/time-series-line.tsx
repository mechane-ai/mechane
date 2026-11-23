import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { chartStyles } from '../chart-theme.ts';
import { linePath } from '../plot/path.ts';
import type { PlotSeries } from './time-series-data.ts';

/** A sparkline's line: broken at gaps, with dots beside each gap, on a lone observation and at the latest one. */
export function TimeSeriesLine({
  series,
  x,
  y,
  pointRadius = 3,
}: {
  readonly series: PlotSeries;
  readonly x: (timestamp: number) => number;
  readonly y: (value: number) => number;
  readonly pointRadius?: number | undefined;
}): ReactNode {
  const lastDefinedIndex = series.points.findLastIndex((point) => point.value !== null);

  return (
    <>
      <path
        d={linePath(
          series.points.map((point) => ({
            x: x(point.timestamp),
            y: point.value === null ? null : y(point.value + point.base),
          })),
        )}
        fill="none"
        stroke={chartToneColors[series.tone]}
        {...stylex.props(chartStyles.mark)}
      />
      {series.points
        .filter((point, index) => {
          if (point.value === null) {
            return false;
          }

          const isAdjacentToGap = series.points[index - 1]?.value === null || series.points[index + 1]?.value === null;
          const isOnlyPoint = series.points.length === 1;
          const isLastPoint = index === lastDefinedIndex;

          if (isOnlyPoint || isLastPoint) {
            return true;
          }

          return isAdjacentToGap;
        })
        .map((point) => (
          <circle
            key={point.timestamp}
            cx={x(point.timestamp)}
            cy={y((point.value ?? 0) + point.base)}
            r={pointRadius}
            fill={chartToneColors[series.tone]}
          />
        ))}
    </>
  );
}
