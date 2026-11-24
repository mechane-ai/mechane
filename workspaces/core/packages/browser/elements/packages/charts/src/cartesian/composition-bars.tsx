import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { motion } from '../../../foundations/src/tokens.stylex.ts';
import { BarMark } from '../plot/plot-marks.tsx';
import type { MarkState } from '../plot/plot-marks.tsx';
import type { BarBucket, BarSeries } from './bar-data.ts';

/** Bars draw at unit height and scale into place, so focusing a series moves them with an interruptible transition. */
const styles = stylex.create({
  mark: {
    transformOrigin: '0 0',
    transitionProperty: 'transform, opacity',
    transitionDuration: { 'default': motion.duration, '@media (prefers-reduced-motion: reduce)': '0ms' },
    transitionTimingFunction: motion.easing,
  },
  geometry: (transform: string, opacity: number) => ({ transform, opacity }),
});

const CONTEXT_OPACITY = 0.18;
const MUTED_OPACITY = 0.3;

type CompositionBarsProps = MarkState & {
  readonly bucket: BarBucket;
  readonly series: ReadonlyArray<BarSeries>;
  readonly focusedSeries: BarSeries | undefined;
  readonly index: number;
  readonly x: number;
  readonly width: number;
  readonly y: (value: number) => number;
  readonly highlighted?: string | null | undefined;
  /** The resolved tone of a series. */
  readonly toneOf: (id: string) => ChartTone;
};

/** One composition bucket: its supplied total as gray context and its parts or focused series over it. */
export function CompositionBars({
  bucket,
  series,
  focusedSeries,
  index,
  x,
  width,
  y,
  isSelected,
  isInspected,
  highlighted,
  toneOf,
}: CompositionBarsProps): ReactNode {
  const hasFocus = focusedSeries !== undefined;
  const extra = focusedSeries !== undefined && !series.some((item) => item.id === focusedSeries.id);
  const marks = extra ? [...series, focusedSeries] : series;

  function geometry(value: number, base: number): string {
    const start = y(base);
    const end = y(base + value);
    const top = Math.min(start, end);
    const isTick = value === 0 && base === 0;
    const height = Math.max(isTick ? 1 : 0, Math.abs(end - start));

    return `translateY(${top}px) scaleY(${height})`;
  }

  const totalOpacity = hasFocus ? CONTEXT_OPACITY : bucket.kind === 'total' ? 1 : 0;

  return (
    <>
      {bucket.kind !== 'gap' && (
        <g {...stylex.props(styles.mark, styles.geometry(geometry(bucket.total, 0), totalOpacity))}>
          <BarMark
            x={x}
            y={0}
            width={width}
            height={1}
            tone="neutral"
            isSelected={isSelected}
            isInspected={isInspected}
          />
        </g>
      )}
      {marks.map((item, seriesIndex) => {
        const value = item.values[index];

        if (value === null || value === undefined) {
          return null;
        }

        const base = hasFocus
          ? 0
          : series.slice(0, seriesIndex).reduce((amount, previous) => amount + (previous.values[index] ?? 0), 0);

        const isVisible = hasFocus ? focusedSeries.id === item.id : bucket.kind === 'parts';
        const isOtherHighlighted = highlighted !== undefined && highlighted !== null && highlighted !== item.id;
        const isMuted = !hasFocus && isOtherHighlighted;
        const opacity = isVisible ? (isMuted ? MUTED_OPACITY : 1) : 0;

        return (
          <g key={item.id} {...stylex.props(styles.mark, styles.geometry(geometry(value, base), opacity))}>
            <BarMark
              x={x}
              y={0}
              width={width}
              height={1}
              tone={toneOf(item.id)}
              isSelected={isSelected}
              isInspected={isInspected}
            />
          </g>
        );
      })}
    </>
  );
}
