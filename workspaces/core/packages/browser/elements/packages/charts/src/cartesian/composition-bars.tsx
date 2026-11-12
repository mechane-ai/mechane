import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { motion } from '../../../foundations/src/tokens.stylex.ts';
import { colorTone } from '../categorical-values.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { BarBucket, BarSeries } from './bar-data.ts';

const styles = stylex.create({
  mark: {
    transformOrigin: '0 0',
    transitionProperty: 'transform, opacity',
    transitionDuration: { 'default': motion.duration, '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: motion.easing,
  },
});

type CompositionBarsProps = {
  readonly bucket: BarBucket;
  readonly series: ReadonlyArray<BarSeries>;
  readonly focusedSeries: BarSeries | undefined;
  readonly index: number;
  readonly x: number;
  readonly width: number;
  readonly y: (value: number) => number;
  readonly isHighlighted: boolean;
};

export function CompositionBars({
  bucket,
  series,
  focusedSeries,
  index,
  x,
  width,
  y,
  isHighlighted,
}: CompositionBarsProps): ReactNode {
  const hasFocus = focusedSeries !== undefined;
  const extra = focusedSeries !== undefined && !series.some((item) => item.id === focusedSeries.id);
  const marks = extra ? [...series, focusedSeries] : series;

  function geometry(value: number, base: number): string {
    const start = y(base);
    const end = y(base + value);
    const top = Math.min(start, end);
    const height = Math.max(value === 0 ? 1 : 0, Math.abs(end - start));

    return `translateY(${top}px) scaleY(${height})`;
  }

  return (
    <>
      {bucket.kind !== 'gap' && (
        <rect
          x={x}
          y={0}
          width={width}
          height={1}
          vectorEffect="non-scaling-stroke"
          fill={chartToneColors.neutral}
          {...stylex.props(styles.mark, isHighlighted && chartStyles.selected)}
          style={{ transform: geometry(bucket.total, 0), opacity: hasFocus ? 0.18 : bucket.kind === 'total' ? 1 : 0 }}
        />
      )}
      {marks.map((item, seriesIndex) => {
        const value = item.values[index];

        if (value === null || value === undefined) {
          return null;
        }

        const isFocused = focusedSeries?.id === item.id;

        const base = hasFocus
          ? 0
          : series.slice(0, seriesIndex).reduce((amount, previous) => amount + (previous.values[index] ?? 0), 0);

        const isVisible = hasFocus ? isFocused : bucket.kind === 'parts';

        return (
          <rect
            key={item.id}
            x={x}
            y={0}
            width={width}
            height={1}
            vectorEffect="non-scaling-stroke"
            fill={chartToneColors[colorTone(item.tone, seriesIndex)]}
            {...stylex.props(styles.mark, isHighlighted && chartStyles.selected)}
            style={{ transform: geometry(value, base), opacity: isVisible ? 1 : 0 }}
          />
        );
      })}
    </>
  );
}
