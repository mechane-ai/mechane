import type { ReactElement } from 'react';
import type { BarChartProps } from '../cartesian/bar-chart.tsx';
import type { BreakdownBarProps } from '../cartesian/breakdown-bar.tsx';
import type { BridgeChartProps } from '../cartesian/bridge-chart.tsx';
import type { ScatterPlotProps } from '../cartesian/scatter-plot.tsx';
import type { SparklineProps } from '../cartesian/sparkline.tsx';
import type { AreaChartProps, SmallMultiplesProps, TimeSeriesChartProps } from '../cartesian/time-series.tsx';
import type { BulletBarProps } from '../comparison/bullet-bar.tsx';
import type { DotPlotProps } from '../comparison/dot-plot.tsx';
import type { DumbbellPlotProps } from '../comparison/dumbbell-plot.tsx';
import type { BoxPlotProps } from '../distribution/box-plot.tsx';
import type { ECDFProps } from '../distribution/ecdf.tsx';
import type { HistogramProps } from '../distribution/histogram.tsx';
import type { IntervalPlotProps } from '../distribution/interval-plot.tsx';
import type { RankedBarsProps } from '../distribution/ranked-bars.tsx';
import type { RidgelineProps } from '../distribution/ridgeline.tsx';
import type { StripPlotProps } from '../distribution/strip-plot.tsx';
import type { ViolinPlotProps } from '../distribution/violin-plot.tsx';
import type { AttributionGraphProps } from '../graph/attribution-graph.tsx';
import type { FlowDiagramProps } from '../graph/flow-diagram.tsx';
import type { RelationGraphProps } from '../graph/relation-graph.tsx';
import type { TreeDiagramProps } from '../graph/tree-diagram.tsx';
import type { IcicleProps } from '../hierarchy/icicle.tsx';
import type { TreemapProps } from '../hierarchy/treemap.tsx';
import type { AttributionOverlayProps } from '../image/attribution-overlay.tsx';
import type { ImageAtlasProps } from '../image/image-atlas.tsx';
import type { ImageGridProps } from '../image/image-grid.tsx';
import type { AttentionMatrixProps } from '../matrix/attention-matrix.tsx';
import type { CalendarHeatmapProps } from '../matrix/calendar-heatmap.tsx';
import type { ConfusionMatrixProps } from '../matrix/confusion-matrix.tsx';
import type { CorrelationMatrixProps } from '../matrix/correlation-matrix.tsx';
import type { MatrixProps } from '../matrix/matrix.tsx';
import type { TokenHeatmapProps } from '../matrix/token-heatmap.tsx';
import type { ContourPlotProps } from '../relationship/contour-plot.tsx';
import type { DensityMapProps } from '../relationship/density-map.tsx';
import type { EmbeddingMapProps } from '../relationship/embedding-map.tsx';
import type { ParallelCoordinatesProps } from '../relationship/parallel-coordinates.tsx';
import type { ScatterMatrixProps } from '../relationship/scatter-matrix.tsx';
import type { TokenExamplesProps } from '../text/token-examples.tsx';
import type { TokenGridProps } from '../text/token-grid.tsx';
import type { TokenLinksProps } from '../text/token-links.tsx';
import type { TokenPredictionsProps } from '../text/token-predictions.tsx';
import type { EventStripProps } from '../timeline/event-strip.tsx';
import type { WaterfallProps } from '../timeline/waterfall.tsx';
import type { BumpChartProps } from '../trend/bump-chart.tsx';
import type { CurveChartProps } from '../trend/curve-chart.tsx';
import type { HorizonChartProps } from '../trend/horizon-chart.tsx';
import type { RunsChartProps } from '../trend/runs-chart.tsx';
import type { SlopeChartProps } from '../trend/slope-chart.tsx';

/** The props of every chart a figure spec can name, by chart name. */
export type FigureChartProps = {
  readonly BarChart: BarChartProps;
  readonly BridgeChart: BridgeChartProps;
  readonly BreakdownBar: BreakdownBarProps;
  readonly ScatterPlot: ScatterPlotProps;
  readonly LineChart: TimeSeriesChartProps;
  readonly AreaChart: AreaChartProps;
  readonly SmallMultiples: SmallMultiplesProps;
  readonly Sparkline: SparklineProps;
  readonly Histogram: HistogramProps;
  readonly ECDF: ECDFProps;
  readonly IntervalPlot: IntervalPlotProps;
  readonly RankedBars: RankedBarsProps;
  readonly BoxPlot: BoxPlotProps;
  readonly ViolinPlot: ViolinPlotProps;
  readonly StripPlot: StripPlotProps;
  readonly Ridgeline: RidgelineProps;
  readonly Matrix: MatrixProps;
  readonly TokenHeatmap: TokenHeatmapProps;
  readonly ConfusionMatrix: ConfusionMatrixProps;
  readonly CorrelationMatrix: CorrelationMatrixProps;
  readonly AttentionMatrix: AttentionMatrixProps;
  readonly CalendarHeatmap: CalendarHeatmapProps;
  readonly RelationGraph: RelationGraphProps;
  readonly FlowDiagram: FlowDiagramProps;
  readonly AttributionGraph: AttributionGraphProps;
  readonly TreeDiagram: TreeDiagramProps;
  readonly Treemap: TreemapProps;
  readonly Icicle: IcicleProps;
  readonly Waterfall: WaterfallProps;
  readonly EventStrip: EventStripProps;
  readonly CurveChart: CurveChartProps;
  readonly RunsChart: RunsChartProps;
  readonly SlopeChart: SlopeChartProps;
  readonly BumpChart: BumpChartProps;
  readonly HorizonChart: HorizonChartProps;
  readonly DotPlot: DotPlotProps;
  readonly DumbbellPlot: DumbbellPlotProps;
  readonly BulletBar: BulletBarProps;
  readonly ContourPlot: ContourPlotProps;
  readonly ScatterMatrix: ScatterMatrixProps;
  readonly ParallelCoordinates: ParallelCoordinatesProps;
  readonly EmbeddingMap: EmbeddingMapProps;
  readonly DensityMap: DensityMapProps;
  readonly TokenExamples: TokenExamplesProps;
  readonly TokenPredictions: TokenPredictionsProps;
  readonly TokenGrid: TokenGridProps;
  readonly TokenLinks: TokenLinksProps;
  readonly ImageGrid: ImageGridProps;
  readonly AttributionOverlay: AttributionOverlayProps;
  readonly ImageAtlas: ImageAtlasProps;
};

/** The name of a chart a figure spec can draw: "CurveChart", "Histogram". */
export type FigureChart = keyof FigureChartProps;

/** The folder a chart belongs to, which groups related charts in the guide and on the figure wall. */
export type FigureFamily =
  | 'cartesian'
  | 'distribution'
  | 'matrix'
  | 'graph'
  | 'hierarchy'
  | 'timeline'
  | 'trend'
  | 'comparison'
  | 'relationship'
  | 'text'
  | 'image';

type JsonPrimitive = string | number | boolean | null | undefined;

/** True for a prop that takes React content, such as `actions`: JSON cannot carry it, so a spec leaves it out. */
type IsSlot<Value> = ReactElement extends NonNullable<Value> ? true : false;

/** A key a spec keeps: neither a callback (`on...`) nor a React content slot. */
type JsonKey<Key, Value> = Key extends `on${Capitalize<string>}` ? never : IsSlot<Value> extends true ? never : Key;

/** The props an object must supply: every key that is not optional. */
export type RequiredKey<Props> = {
  readonly [Key in keyof Props]-?: Props extends Readonly<Record<Key, unknown>> ? Key : never;
}[keyof Props];

/** A required key whose value JSON cannot carry, such as a required function format. */
type ImpossibleKey<Shape> = {
  readonly [Key in RequiredKey<Shape>]: Shape[Key] extends never ? Key : never;
}[RequiredKey<Shape>];

/** An object with a required key JSON cannot carry is not a JSON shape, so a union keeps only its other members. */
type JsonShape<Shape> = ImpossibleKey<Shape> extends never ? Shape : never;

/**
 * The part of a value JSON can carry: callbacks, refs and React content are dropped. A format that accepts `Intl`
 * options or a function keeps the options form only. A union member that needs a function is left out.
 */
export type JsonData<Value> = Value extends JsonPrimitive
  ? Value
  : Value extends (...input: never) => unknown
    ? never
    : Value extends { readonly current: unknown }
      ? never
      : Value extends ReadonlyArray<unknown>
        ? { readonly [Index in keyof Value]: JsonData<Value[Index]> }
        : Value extends object
          ? JsonShape<{ readonly [Key in keyof Value as JsonKey<Key, Value[Key]>]: JsonData<Value[Key]> }>
          : never;

/** A chart's props as JSON can carry them: what an agent or a server writes in a figure spec. */
export type JsonProps<Props> = JsonData<Props>;

/** The spec of one named chart. */
export type FigureSpecOf<Chart extends FigureChart> = {
  readonly chart: Chart;
  readonly props: JsonProps<FigureChartProps[Chart]>;
};

/**
 * A figure described as plain JSON: the chart to draw and its props. An agent or a server writes it,
 * `validateFigureSpec` checks it and `Figure` draws it.
 */
export type FigureSpec = { readonly [Chart in FigureChart]: FigureSpecOf<Chart> }[FigureChart];
