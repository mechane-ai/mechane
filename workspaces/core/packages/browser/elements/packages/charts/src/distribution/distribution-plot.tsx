import { useId } from 'react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartItem } from '../chart.tsx';
import { FigureEmpty, FigureFrame } from '../figure/figure-frame.tsx';
import type { FigureFrameInput } from '../figure/figure-props.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle } from '../plot/plot-layout.ts';
import type { NumericPlotLayout, PlotAxis } from '../plot/plot-layout.ts';
import { PlotClip, PlotSurface } from '../plot/plot-surface.tsx';

export type DistributionFigureProps = {
  readonly frame: FigureFrameInput;
  /** The chart part's own props, from `Chart`'s render. */
  readonly figure: ComponentProps<'figure'>;
  readonly items: ReadonlyArray<ChartItem>;
  readonly inspected: string | null;
  readonly plotRef: Ref<HTMLDivElement>;
  readonly plot: NumericPlotLayout;
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  readonly isSelectable: boolean;
  readonly emptyLabel: string;
  /** The marks, drawn inside the axes. */
  readonly children: ReactNode;
  /**
   * Marks drawn over the axes without the clip: dots that may sit on the plot's edge, and the keyboard cursor, whose
   * underline sits below the plot.
   */
  readonly overlay: ReactNode;
};

/**
 * The frame, axes, readout and exact-value table that a histogram and a cumulative distribution share. Each chart
 * supplies its own marks.
 */
export function DistributionFigure({
  frame,
  figure,
  items,
  inspected,
  plotRef,
  plot,
  x,
  y,
  isSelectable,
  emptyLabel,
  children,
  overlay,
}: DistributionFigureProps): ReactNode {
  const readoutId = useId();
  const { box } = plot;

  return (
    <FigureFrame
      {...frame}
      figure={figure}
      footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
    >
      {items.length === 0 ? (
        <FigureEmpty>{emptyLabel}</FigureEmpty>
      ) : (
        <>
          <PlotSurface
            plotRef={plotRef}
            box={box}
            label={plotLabel({ title: frame.title, isSelectable })}
            readoutId={readoutId}
          >
            <PlotAxes box={box} xTicks={plot.xTicks} yTicks={plot.yTicks} xTitle={axisTitle(x)} yTitle={axisTitle(y)} />
            <PlotClip box={box}>{children}</PlotClip>
            {overlay}
          </PlotSurface>
          <ChartData
            label={`${frame.title} observations`}
            columns={[{ id: 'observation', label: 'Observation' }]}
            rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
          />
        </>
      )}
    </FigureFrame>
  );
}
