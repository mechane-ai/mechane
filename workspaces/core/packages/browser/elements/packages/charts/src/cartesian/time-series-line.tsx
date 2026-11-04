import * as stylex from '@stylexjs/stylex';
import { LinePath } from '@visx/shape';
import type { ReactNode } from 'react';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { PlotPoint, PlotSeries } from './time-series-data.ts';

export function TimeSeriesLine({
  series,
  x,
  y,
  inspectedTimestamp,
  pointRadius = 3,
}: {
  readonly series: PlotSeries;
  readonly x: (timestamp: number) => number;
  readonly y: (value: number) => number;
  readonly inspectedTimestamp?: number | undefined;
  readonly pointRadius?: number | undefined;
}): ReactNode {
  return (
    <>
      <LinePath<PlotPoint>
        data={[...series.points]}
        defined={(point) => point.value !== null}
        x={(point) => x(point.timestamp)}
        y={(point) => y((point.value ?? 0) + point.base)}
        stroke={chartToneColors[series.tone]}
        {...stylex.props(chartStyles.mark)}
      />
      {series.points
        .filter((point, index) => {
          if (point.value === null) {
            return false;
          }

          const bordersGap = series.points[index - 1]?.value === null || series.points[index + 1]?.value === null;

          return series.points.length === 1 || bordersGap || point.timestamp === inspectedTimestamp;
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
