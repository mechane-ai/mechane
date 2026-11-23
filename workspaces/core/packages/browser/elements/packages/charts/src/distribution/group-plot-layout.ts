import type { ChartPoint } from '../chart.tsx';
import { locateNearest } from '../plot/locate.ts';
import { linePath } from '../plot/path.ts';
import type { PlotGrid } from '../plot/plot-axes.tsx';
import { axisTitle, categoryPlot, plotHeights } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotBox, PlotCategory, PlotHeight, PlotTick } from '../plot/plot-layout.ts';
import type { Segment } from '../plot/plot-marks.tsx';
import type { ContinuousScale, NumericDomain } from '../plot/scale.ts';

/** Which way the groups run: `columns` stand along the bottom, `rows` list down the side. */
export type GroupDirection = 'columns' | 'rows';

/** A position in the plot's drawn pixels. */
export type Vertex = { readonly x: number; readonly y: number };

/** A rectangle in the plot's drawn pixels. */
export type Slot = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/**
 * Turns a position across the groups and a position along the value axis into a drawn position, so one set of marks
 * serves both directions.
 */
export type Orientation = { readonly point: (across: number, along: number) => Vertex };

/** The box, ticks, titles and grid a chart of named groups draws its axes from. */
export type GroupAxes = {
  readonly box: PlotBox;
  readonly xTicks: ReadonlyArray<PlotTick>;
  readonly yTicks: ReadonlyArray<PlotTick>;
  readonly xTitle?: string | undefined;
  readonly yTitle?: string | undefined;
  readonly grid: PlotGrid;
};

export type GroupLayout<Group extends PlotCategory> = GroupAxes & {
  readonly value: ContinuousScale;
  /** The width of one group's band. */
  readonly bandwidth: number;
  /** The groups with the position of each band's center across the groups. */
  readonly placed: ReadonlyArray<Group & { readonly center: number }>;
  readonly orient: Orientation;
  /** The pointer inspects the group whose band is nearest. */
  readonly locate: (point: ChartPoint) => string | undefined;
  /** The whole band of the group centered at `center`, for the keyboard cursor. */
  readonly slot: (center: number) => Slot;
};

const HALF = 0.5;
const ROW_HEIGHT_MIN = 28;
const ROWS_CHROME = 56;

/**
 * The plot height of a chart that lists one row per record. It is the named height, grown when the rows would otherwise
 * be shorter than a readable line.
 */
export function rowsPlotHeight({ height, count }: { readonly height: PlotHeight; readonly count: number }): number {
  return Math.max(plotHeights[height], count * ROW_HEIGHT_MIN + ROWS_CHROME);
}

/** How one direction maps band and value positions to x and y. */
function orientation(direction: GroupDirection): Orientation {
  const isColumns = direction === 'columns';

  return { point: (across, along) => (isColumns ? { x: across, y: along } : { x: along, y: across }) };
}

/** The segment between two positions. */
export function segmentBetween(first: Vertex, second: Vertex): Segment {
  return { x1: first.x, y1: first.y, x2: second.x, y2: second.y };
}

/** The SVG path of the closed shape through the vertices. */
export function shapePath(vertices: ReadonlyArray<Vertex>): string {
  return `${linePath(vertices)}Z`;
}

/**
 * The layout shared by charts that set one measured value against named groups. It holds the category plot, the groups
 * placed along it, axes written for the direction, and a pointer that finds the nearest group.
 */
export function groupLayout<Group extends PlotCategory>({
  width,
  height,
  direction,
  groups,
  value,
  valueDomain,
  locale,
}: {
  readonly width: number;
  readonly height: number;
  readonly direction: GroupDirection;
  readonly groups: ReadonlyArray<Group>;
  readonly value: PlotAxis;
  readonly valueDomain: NumericDomain;
  readonly locale: string;
}): GroupLayout<Group> {
  const plot = categoryPlot({ width, height, direction, categories: groups, value, valueDomain, locale });
  const { box, band } = plot;
  const isColumns = direction === 'columns';
  const orient = orientation(direction);
  const placed = groups.map((group) => ({ ...group, center: band.center(group.id) ?? 0 }));
  const marks = placed.map((group) => ({ id: group.id, ...orient.point(group.center, 0) }));

  const axes = isColumns
    ? {
        xTicks: plot.bandTicks,
        yTicks: plot.valueTicks,
        xTitle: undefined,
        yTitle: axisTitle(value),
        grid: 'y' as const,
      }
    : {
        xTicks: plot.valueTicks,
        yTicks: plot.bandTicks,
        xTitle: axisTitle(value),
        yTitle: undefined,
        grid: 'x' as const,
      };

  return {
    ...axes,
    box,
    value: plot.value,
    bandwidth: band.bandwidth,
    placed,
    orient,
    locate: locateNearest({ marks, width: box.width, height: box.height, axis: isColumns ? 'x' : 'y' }),
    slot: (center) =>
      isColumns
        ? { x: center - band.step * HALF, y: box.top, width: band.step, height: box.innerHeight }
        : { x: box.left, y: center - band.step * HALF, width: box.innerWidth, height: band.step },
  };
}

const GOLDEN = 0.6180339887;

/**
 * Where the nth dot of a group sits across its band, from -0.5 to 0.5 of the band's width. The golden ratio spreads
 * neighbors apart and the same dot always lands in the same place.
 */
export function stripOffset(ordinal: number): number {
  return ((ordinal * GOLDEN) % 1) - HALF;
}
