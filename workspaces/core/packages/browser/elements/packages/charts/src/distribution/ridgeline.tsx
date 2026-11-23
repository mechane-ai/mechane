import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { locateNearest } from '../plot/locate.ts';
import { axisTitle, categoryPlot, fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { densitiesError, groupFrameError, maxDensity, peakPoint } from './group-plot-input.ts';
import type { DensityPoint } from './group-plot-input.ts';
import { rowsPlotHeight, shapePath } from './group-plot-layout.ts';
import { BandCursor, GroupFigure, ShapeMark } from './group-plot.tsx';

/** One row of the ridgeline: a group and its density curve, computed by the application. */
export type RidgeRow = {
  readonly id: string;
  readonly label: string;
  /** The hue of a row the application wants to tell apart. Left out, every row shares one hue. */
  readonly tone?: ChartTone | undefined;
  /** The curve in increasing `value`. Densities are zero or more and share one unit across rows. */
  readonly density: ReadonlyArray<DensityPoint>;
};

export type RidgelineProps = FigureProps & {
  readonly rows: ReadonlyArray<RidgeRow>;
  readonly value: PlotAxis;
  /** How far a ridge may rise into the row above, from 0 to 1. Defaults to 0.5. */
  readonly overlap?: number | undefined;
  /** What the height means, with its unit: "Density (per unit activation)". */
  readonly densityLabel: string;
  readonly height?: PlotHeight | undefined;
};

export const ridgelineLimits = { rows: 40, densityPoints: 200 } as const;

const OVERLAP_DEFAULT = 0.5;
const HALF = 0.5;

/**
 * Densities of many groups as overlapping ridges down the page, one shared value axis at the bottom and each row named
 * on the left. Rows share one hue unless a row or a tone scope sets its own, later rows are drawn on top, and the
 * application computes every density. Ridge heights share one density scale so heights compare across rows, and the
 * plot grows taller when there are too many rows to keep each readable.
 */
export function Ridgeline(props: RidgelineProps): ReactNode {
  const { rows, value, overlap = OVERLAP_DEFAULT, densityLabel, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No rows are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);
  const tones = useTones();
  // Rows are usually ordered, such as layers or steps, and their place already names them, so they share one hue.
  const drawn = rows.map((row) => ({ ...row, tone: tones({ id: row.id, tone: row.tone, index: 0 }) }));

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const domain =
    value.domain ??
    fitDomain({ values: rows.flatMap((row) => row.density.map((point) => point.value)), scale: value.scale });

  const inputError =
    groupFrameError({ records: rows, limit: ridgelineLimits.rows, noun: 'rows', domain, scale: value.scale }) ??
    densitiesError({ records: rows, domain, limit: ridgelineLimits.densityPoints }) ??
    ridgelineError({ rows, overlap });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const plot = categoryPlot({
    width: size.width,
    height: rowsPlotHeight({ height, count: rows.length }),
    direction: 'rows',
    categories: rows,
    value,
    valueDomain: domain,
    locale,
    padding: 0,
  });

  const { box } = plot;
  const step = box.innerHeight / (rows.length + overlap);
  const reach = step * (1 + overlap);
  const scale = reach / Math.max(maxDensity(rows), Number.MIN_VALUE);
  const placed = drawn.map((row, index) => ({ ...row, baseline: box.top + (overlap + index + 1) * step }));

  function valueText(amount: number): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  const items = placed.map((row) => {
    const peak = peakPoint(row.density);

    return {
      id: row.id,
      label: `${row.label} · Peak density at ${peak === undefined ? 'unknown' : valueText(peak.value)}`,
    };
  });

  return (
    <GroupFigure
      frame={frame}
      emptyLabel={emptyLabel}
      size={size}
      axes={{
        box,
        xTicks: plot.valueTicks,
        yTicks: placed.map((row) => ({ key: row.id, position: row.baseline, label: row.label })),
        xTitle: axisTitle(value),
        grid: 'x',
      }}
      items={items}
      locate={locateNearest({
        marks: placed.map((row) => ({ id: row.id, x: 0, y: row.baseline - step * HALF })),
        width: box.width,
        height: box.height,
        axis: 'y',
      })}
      marksLabel="rows"
      note={`Height shows ${densityLabel}. All ridges share one density scale. Later rows are drawn on top.`}
      cursor={(id) => {
        const target = placed.find((row) => row.id === id);

        return target === undefined ? null : (
          <BandCursor x={box.left} y={target.baseline - step} width={box.innerWidth} height={step} />
        );
      }}
      marks={(view) =>
        placed.map((row) => {
          const first = row.density[0];
          const last = row.density.at(-1);

          const ridge = row.density.map((point) => ({
            x: plot.value.position(point.value),
            y: row.baseline - point.density * scale,
          }));

          return (
            <ShapeMark
              key={row.id}
              d={shapePath([
                { x: plot.value.position(first?.value ?? domain[0]), y: row.baseline },
                ...ridge,
                { x: plot.value.position(last?.value ?? domain[1]), y: row.baseline },
              ])}
              tone={row.tone}
              fill="strong"
              isInspected={view.inspected === row.id}
            />
          );
        })
      }
    />
  );
}

function ridgelineError({
  rows,
  overlap,
}: Pick<RidgelineProps, 'rows'> & { readonly overlap: number }): string | undefined {
  if (!Number.isFinite(overlap) || overlap < 0 || overlap > 1) {
    return 'Overlap must be a number from 0 to 1.';
  }

  if (rows.length > 0 && maxDensity(rows) === 0) {
    return 'Every density is zero, so no ridge has a height.';
  }

  return undefined;
}
