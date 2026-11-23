import type { ComponentType, ReactNode } from 'react';
import { BarChart } from '../cartesian/bar-chart.tsx';
import { BreakdownBar } from '../cartesian/breakdown-bar.tsx';
import { BridgeChart } from '../cartesian/bridge-chart.tsx';
import { ScatterPlot } from '../cartesian/scatter-plot.tsx';
import { Sparkline } from '../cartesian/sparkline.tsx';
import { AreaChart, LineChart, SmallMultiples } from '../cartesian/time-series.tsx';
import type { ChartSelectDetails } from '../chart.tsx';
import { BulletBar } from '../comparison/bullet-bar.tsx';
import { DotPlot } from '../comparison/dot-plot.tsx';
import { DumbbellPlot } from '../comparison/dumbbell-plot.tsx';
import { BoxPlot } from '../distribution/box-plot.tsx';
import { ECDF } from '../distribution/ecdf.tsx';
import { Histogram } from '../distribution/histogram.tsx';
import { IntervalPlot } from '../distribution/interval-plot.tsx';
import { RankedBars } from '../distribution/ranked-bars.tsx';
import { Ridgeline } from '../distribution/ridgeline.tsx';
import { StripPlot } from '../distribution/strip-plot.tsx';
import { ViolinPlot } from '../distribution/violin-plot.tsx';
import type { FigureStatus } from '../figure/figure-props.ts';
import { AttributionGraph } from '../graph/attribution-graph.tsx';
import { FlowDiagram } from '../graph/flow-diagram.tsx';
import { RelationGraph } from '../graph/relation-graph.tsx';
import { TreeDiagram } from '../graph/tree-diagram.tsx';
import { Icicle } from '../hierarchy/icicle.tsx';
import { Treemap } from '../hierarchy/treemap.tsx';
import { AttributionOverlay } from '../image/attribution-overlay.tsx';
import { ImageAtlas } from '../image/image-atlas.tsx';
import { ImageGrid } from '../image/image-grid.tsx';
import { AttentionMatrix } from '../matrix/attention-matrix.tsx';
import { CalendarHeatmap } from '../matrix/calendar-heatmap.tsx';
import { ConfusionMatrix } from '../matrix/confusion-matrix.tsx';
import { CorrelationMatrix } from '../matrix/correlation-matrix.tsx';
import { Matrix } from '../matrix/matrix.tsx';
import { TokenHeatmap } from '../matrix/token-heatmap.tsx';
import { ContourPlot } from '../relationship/contour-plot.tsx';
import { DensityMap } from '../relationship/density-map.tsx';
import { EmbeddingMap } from '../relationship/embedding-map.tsx';
import { ParallelCoordinates } from '../relationship/parallel-coordinates.tsx';
import { ScatterMatrix } from '../relationship/scatter-matrix.tsx';
import { TokenExamples } from '../text/token-examples.tsx';
import { TokenGrid } from '../text/token-grid.tsx';
import { TokenLinks } from '../text/token-links.tsx';
import { TokenPredictions } from '../text/token-predictions.tsx';
import { EventStrip } from '../timeline/event-strip.tsx';
import { Waterfall } from '../timeline/waterfall.tsx';
import type { WaterfallSelectDetails } from '../timeline/waterfall.tsx';
import { BumpChart } from '../trend/bump-chart.tsx';
import { CurveChart } from '../trend/curve-chart.tsx';
import { HorizonChart } from '../trend/horizon-chart.tsx';
import { RunsChart } from '../trend/runs-chart.tsx';
import { SlopeChart } from '../trend/slope-chart.tsx';
import type { FigureChart, FigureChartProps, FigureFamily, JsonProps, RequiredKey } from './figure-spec.ts';

/** What a JSON value is, as a spec check names it. */
export type JsonKind = 'string' | 'number' | 'boolean' | 'array' | 'object';

type KindOf<Value> = Value extends string
  ? 'string'
  : Value extends number
    ? 'number'
    : Value extends boolean
      ? 'boolean'
      : Value extends ReadonlyArray<unknown>
        ? 'array'
        : Value extends object
          ? 'object'
          : never;

/** Each prop a chart cannot draw without, and the JSON kind its value must have. */
export type RequiredProps<Props> = { readonly [Key in RequiredKey<Props>]: KindOf<Props[Key]> };

/** Why a selection changed: a press or a key in a chart, or a row press in a waterfall. */
export type FigureSelectDetails = ChartSelectDetails | WaterfallSelectDetails;

/**
 * The application state a figure takes beside its spec. JSON cannot carry a callback, so selection arrives here, and
 * the application can override the spec's status while it reads newer data.
 */
export type FigureState = {
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: FigureSelectDetails) => void) | undefined;
  readonly status?: FigureStatus | undefined;
};

/** One registered chart: the component that draws it, its family and the props a spec must supply. */
export type FigureEntry<Chart extends FigureChart> = {
  readonly chart: Chart;
  readonly component: ComponentType<JsonProps<FigureChartProps[Chart]> & FigureState>;
  readonly family: FigureFamily;
  readonly required: RequiredProps<JsonProps<FigureChartProps[Chart]>>;
  /** True when the chart takes a selection from the application. */
  readonly isSelectable: 'onSelectedChange' extends keyof FigureChartProps[Chart] ? true : false;
};

/** Every chart a figure spec can name. This is the only place a chart is registered. */
export type FigureRegistry = { readonly [Chart in FigureChart]: FigureEntry<Chart> };

function ignoreSelection(): undefined {
  return undefined;
}

/** A waterfall requires a selection callback. A figure without one still draws, and a press then does nothing. */
function WaterfallFigure(props: JsonProps<FigureChartProps['Waterfall']> & FigureState): ReactNode {
  const { onSelectedChange = ignoreSelection, ...rest } = props;

  return <Waterfall {...rest} onSelectedChange={onSelectedChange} />;
}

const figure = { locale: 'string', title: 'string' } as const;

/** The registered charts by name. */
export const figureRegistry: FigureRegistry = {
  BarChart: {
    chart: 'BarChart',
    component: BarChart,
    family: 'cartesian',
    required: { ...figure, categories: 'array', series: 'array', valueFormat: 'object' },
    isSelectable: true,
  },
  BridgeChart: {
    chart: 'BridgeChart',
    component: BridgeChart,
    family: 'cartesian',
    required: { ...figure, steps: 'array', valueFormat: 'object' },
    isSelectable: true,
  },
  BreakdownBar: {
    chart: 'BreakdownBar',
    component: BreakdownBar,
    family: 'cartesian',
    required: { ...figure, items: 'array', total: 'number', valueFormat: 'object' },
    isSelectable: true,
  },
  ScatterPlot: {
    chart: 'ScatterPlot',
    component: ScatterPlot,
    family: 'cartesian',
    required: { ...figure, points: 'array', x: 'object', y: 'object' },
    isSelectable: true,
  },
  LineChart: {
    chart: 'LineChart',
    component: LineChart,
    family: 'cartesian',
    required: { ...figure, series: 'array', timestampUnit: 'string', timeFormat: 'object', valueFormat: 'object' },
    isSelectable: false,
  },
  AreaChart: {
    chart: 'AreaChart',
    component: AreaChart,
    family: 'cartesian',
    required: { ...figure, series: 'array', timestampUnit: 'string', timeFormat: 'object', valueFormat: 'object' },
    isSelectable: false,
  },
  SmallMultiples: {
    chart: 'SmallMultiples',
    component: SmallMultiples,
    family: 'cartesian',
    required: { locale: 'string', charts: 'array', timestampUnit: 'string', timeFormat: 'object' },
    isSelectable: false,
  },
  Sparkline: {
    chart: 'Sparkline',
    component: Sparkline,
    family: 'cartesian',
    required: {
      title: 'string',
      summary: 'string',
      unit: 'string',
      timestampUnit: 'string',
      series: 'object',
      valueDomain: 'array',
    },
    isSelectable: false,
  },
  Histogram: {
    chart: 'Histogram',
    component: Histogram,
    family: 'distribution',
    required: { ...figure, bins: 'array', value: 'object', count: 'object' },
    isSelectable: true,
  },
  ECDF: {
    chart: 'ECDF',
    component: ECDF,
    family: 'distribution',
    required: { ...figure, points: 'array', value: 'object', probability: 'object' },
    isSelectable: true,
  },
  IntervalPlot: {
    chart: 'IntervalPlot',
    component: IntervalPlot,
    family: 'distribution',
    required: { ...figure, items: 'array', value: 'object', intervalLabel: 'string' },
    isSelectable: true,
  },
  RankedBars: {
    chart: 'RankedBars',
    component: RankedBars,
    family: 'distribution',
    required: { ...figure, items: 'array', value: 'object' },
    isSelectable: true,
  },
  BoxPlot: {
    chart: 'BoxPlot',
    component: BoxPlot,
    family: 'distribution',
    required: { ...figure, groups: 'array', value: 'object', whiskerLabel: 'string' },
    isSelectable: false,
  },
  ViolinPlot: {
    chart: 'ViolinPlot',
    component: ViolinPlot,
    family: 'distribution',
    required: { ...figure, groups: 'array', value: 'object', densityLabel: 'string' },
    isSelectable: false,
  },
  StripPlot: {
    chart: 'StripPlot',
    component: StripPlot,
    family: 'distribution',
    required: { ...figure, groups: 'array', points: 'array', value: 'object' },
    isSelectable: true,
  },
  Ridgeline: {
    chart: 'Ridgeline',
    component: Ridgeline,
    family: 'distribution',
    required: { ...figure, rows: 'array', value: 'object', densityLabel: 'string' },
    isSelectable: false,
  },
  Matrix: {
    chart: 'Matrix',
    component: Matrix,
    family: 'matrix',
    required: {
      ...figure,
      rows: 'array',
      columns: 'array',
      cells: 'array',
      valueLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      palette: 'string',
    },
    isSelectable: true,
  },
  TokenHeatmap: {
    chart: 'TokenHeatmap',
    component: TokenHeatmap,
    family: 'matrix',
    required: {
      ...figure,
      tokens: 'array',
      valueLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      palette: 'string',
    },
    isSelectable: true,
  },
  ConfusionMatrix: {
    chart: 'ConfusionMatrix',
    component: ConfusionMatrix,
    family: 'matrix',
    required: { ...figure, classes: 'array', counts: 'array' },
    isSelectable: true,
  },
  CorrelationMatrix: {
    chart: 'CorrelationMatrix',
    component: CorrelationMatrix,
    family: 'matrix',
    required: { ...figure, variables: 'array', coefficients: 'array' },
    isSelectable: true,
  },
  AttentionMatrix: {
    chart: 'AttentionMatrix',
    component: AttentionMatrix,
    family: 'matrix',
    required: { ...figure, sources: 'array', destinations: 'array', weights: 'array' },
    isSelectable: true,
  },
  CalendarHeatmap: {
    chart: 'CalendarHeatmap',
    component: CalendarHeatmap,
    family: 'matrix',
    required: {
      ...figure,
      days: 'array',
      range: 'object',
      weekStartsOn: 'string',
      valueLabel: 'string',
      valueFormat: 'object',
    },
    isSelectable: true,
  },
  RelationGraph: {
    chart: 'RelationGraph',
    component: RelationGraph,
    family: 'graph',
    required: { ...figure, nodes: 'array', edges: 'array', width: 'number', height: 'number' },
    isSelectable: true,
  },
  FlowDiagram: {
    chart: 'FlowDiagram',
    component: FlowDiagram,
    family: 'graph',
    required: { ...figure, nodes: 'array', links: 'array', valueFormat: 'object' },
    isSelectable: true,
  },
  AttributionGraph: {
    chart: 'AttributionGraph',
    component: AttributionGraph,
    family: 'graph',
    required: {
      ...figure,
      layers: 'array',
      nodes: 'array',
      edges: 'array',
      weightLabel: 'string',
      weightFormat: 'object',
    },
    isSelectable: true,
  },
  TreeDiagram: {
    chart: 'TreeDiagram',
    component: TreeDiagram,
    family: 'graph',
    required: { ...figure, nodes: 'array' },
    isSelectable: true,
  },
  Treemap: {
    chart: 'Treemap',
    component: Treemap,
    family: 'hierarchy',
    required: { ...figure, items: 'array', valueFormat: 'object' },
    isSelectable: true,
  },
  Icicle: {
    chart: 'Icicle',
    component: Icicle,
    family: 'hierarchy',
    required: { ...figure, nodes: 'array', valueFormat: 'object' },
    isSelectable: true,
  },
  Waterfall: {
    chart: 'Waterfall',
    component: WaterfallFigure,
    family: 'timeline',
    required: {
      ...figure,
      items: 'array',
      start: 'number',
      end: 'number',
      rowLabel: 'string',
      summaryLabel: 'string',
      offsetFormat: 'object',
    },
    isSelectable: true,
  },
  EventStrip: {
    chart: 'EventStrip',
    component: EventStrip,
    family: 'timeline',
    required: { ...figure, lanes: 'array', events: 'array', domain: 'array', timeFormat: 'object' },
    isSelectable: true,
  },
  CurveChart: {
    chart: 'CurveChart',
    component: CurveChart,
    family: 'trend',
    required: { ...figure, series: 'array', x: 'object', y: 'object' },
    isSelectable: false,
  },
  RunsChart: {
    chart: 'RunsChart',
    component: RunsChart,
    family: 'trend',
    required: { ...figure, runs: 'array', x: 'object', y: 'object', featured: 'array' },
    isSelectable: true,
  },
  SlopeChart: {
    chart: 'SlopeChart',
    component: SlopeChart,
    family: 'trend',
    required: { ...figure, conditions: 'array', items: 'array', value: 'object' },
    isSelectable: true,
  },
  BumpChart: {
    chart: 'BumpChart',
    component: BumpChart,
    family: 'trend',
    required: { ...figure, stages: 'array', items: 'array' },
    isSelectable: false,
  },
  HorizonChart: {
    chart: 'HorizonChart',
    component: HorizonChart,
    family: 'trend',
    required: { ...figure, series: 'array', x: 'object', value: 'object', bands: 'number' },
    isSelectable: false,
  },
  DotPlot: {
    chart: 'DotPlot',
    component: DotPlot,
    family: 'comparison',
    required: { ...figure, rows: 'array', series: 'array', value: 'object' },
    isSelectable: true,
  },
  DumbbellPlot: {
    chart: 'DumbbellPlot',
    component: DumbbellPlot,
    family: 'comparison',
    required: { ...figure, rows: 'array', fromLabel: 'string', toLabel: 'string', value: 'object' },
    isSelectable: true,
  },
  BulletBar: {
    chart: 'BulletBar',
    component: BulletBar,
    family: 'comparison',
    required: { ...figure, rows: 'array', value: 'object' },
    isSelectable: true,
  },
  ContourPlot: {
    chart: 'ContourPlot',
    component: ContourPlot,
    family: 'relationship',
    required: { ...figure, grid: 'object', levels: 'array', x: 'object', y: 'object', value: 'object' },
    isSelectable: true,
  },
  ScatterMatrix: {
    chart: 'ScatterMatrix',
    component: ScatterMatrix,
    family: 'relationship',
    required: { ...figure, dimensions: 'array', rows: 'array' },
    isSelectable: true,
  },
  ParallelCoordinates: {
    chart: 'ParallelCoordinates',
    component: ParallelCoordinates,
    family: 'relationship',
    required: { ...figure, dimensions: 'array', rows: 'array' },
    isSelectable: true,
  },
  EmbeddingMap: {
    chart: 'EmbeddingMap',
    component: EmbeddingMap,
    family: 'relationship',
    required: { ...figure, points: 'object', groups: 'array', x: 'object', y: 'object' },
    isSelectable: true,
  },
  DensityMap: {
    chart: 'DensityMap',
    component: DensityMap,
    family: 'relationship',
    required: { ...figure, histogram: 'object', x: 'object', y: 'object', count: 'object' },
    isSelectable: false,
  },
  TokenExamples: {
    chart: 'TokenExamples',
    component: TokenExamples,
    family: 'text',
    required: {
      ...figure,
      examples: 'array',
      valueLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      palette: 'string',
    },
    isSelectable: true,
  },
  TokenPredictions: {
    chart: 'TokenPredictions',
    component: TokenPredictions,
    family: 'text',
    required: { ...figure, predictions: 'array' },
    isSelectable: true,
  },
  TokenGrid: {
    chart: 'TokenGrid',
    component: TokenGrid,
    family: 'text',
    required: {
      ...figure,
      columns: 'array',
      rows: 'array',
      cells: 'array',
      valueLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      palette: 'string',
    },
    isSelectable: true,
  },
  TokenLinks: {
    chart: 'TokenLinks',
    component: TokenLinks,
    family: 'text',
    required: {
      ...figure,
      tokens: 'array',
      links: 'array',
      weightLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      direction: 'string',
    },
    isSelectable: true,
  },
  ImageGrid: {
    chart: 'ImageGrid',
    component: ImageGrid,
    family: 'image',
    required: { ...figure, items: 'array' },
    isSelectable: true,
  },
  AttributionOverlay: {
    chart: 'AttributionOverlay',
    component: AttributionOverlay,
    family: 'image',
    required: {
      ...figure,
      image: 'object',
      grid: 'object',
      valueLabel: 'string',
      valueFormat: 'object',
      domain: 'array',
      palette: 'string',
    },
    isSelectable: false,
  },
  ImageAtlas: {
    chart: 'ImageAtlas',
    component: ImageAtlas,
    family: 'image',
    required: { ...figure, columns: 'number', rows: 'number', cells: 'array' },
    isSelectable: true,
  },
};

/** Every registered chart's name and family, in the registry's order. */
export const figureCharts: ReadonlyArray<{ readonly chart: FigureChart; readonly family: FigureFamily }> =
  Object.values(figureRegistry).map(({ chart, family }) => ({ chart, family }));
