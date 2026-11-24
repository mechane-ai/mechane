import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { PointerEventHandler, ReactNode, Ref } from 'react';
import { chartStyles } from '../chart-theme.ts';
import { ChartPlot } from '../chart.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { plotHeights } from './plot-layout.ts';
import type { PlotBox, PlotHeight } from './plot-layout.ts';

const styles = stylex.create({
  plot: { position: 'relative', minWidth: 0 },
  layer: { position: 'absolute', inset: 0, pointerEvents: 'none' },
});

/** Measures a plot: the width its container gives it and the named height its figure chose. */
export function usePlotSize(height: PlotHeight = 'regular'): {
  readonly ref: Ref<HTMLDivElement>;
  readonly width: number;
  readonly height: number;
} {
  const { ref, width } = usePlotWidth();

  return { ref, width, height: plotHeights[height] };
}

export type PlotSurfaceProps = {
  /** The ref from `usePlotSize`. */
  readonly plotRef: Ref<HTMLDivElement>;
  readonly box: PlotBox;
  /** The plot's accessible name. Build it with `plotLabel`, so every chart explains its keys the same way. */
  readonly label: string;
  /** The id of the readout that states the inspected mark's exact values. */
  readonly readoutId: string;
  /** The SVG marks, axes and guides. */
  readonly children: ReactNode;
  /** HTML drawn over the marks in the same pixel space, such as a canvas layer or point targets. */
  readonly overlay?: ReactNode;
  readonly onPointerDown?: PointerEventHandler<SVGSVGElement> | undefined;
};

/**
 * The plot of a chart: one Tab stop that owns the keyboard cursor, pointer inspection and dismissal for the marks drawn
 * inside it. Use it inside `Chart`, which supplies the items.
 */
export function PlotSurface({
  plotRef,
  box,
  label,
  readoutId,
  children,
  overlay,
  onPointerDown,
}: PlotSurfaceProps): ReactNode {
  return (
    <ChartPlot
      ref={plotRef}
      role="group"
      aria-label={label}
      aria-describedby={readoutId}
      {...stylex.props(styles.plot, stylex.defaultMarker())}
    >
      <svg
        aria-hidden
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${box.width} ${box.height}`}
        onPointerDown={onPointerDown}
        {...stylex.props(chartStyles.svg)}
      >
        {children}
      </svg>
      {overlay !== undefined && <div {...stylex.props(styles.layer)}>{overlay}</div>}
    </ChartPlot>
  );
}

/** Keeps marks inside the axes. Wrap the marks, never the axes or the labels beside them. */
export function PlotClip({
  box,
  pad = 0,
  children,
}: {
  readonly box: PlotBox;
  /** Optional pixel margin around the plot inner area so boundary dot marks are not half-clipped. */
  readonly pad?: number | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const clipId = useId();

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={box.left - pad}
            y={box.top - pad}
            width={box.innerWidth + pad * 2}
            height={box.innerHeight + pad * 2}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{children}</g>
    </>
  );
}
