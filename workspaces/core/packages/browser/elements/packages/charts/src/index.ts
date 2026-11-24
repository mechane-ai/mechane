export type { BreakdownItem } from './categorical-values.tsx';
export { categoricalLimits } from './categorical-values.tsx';
export type {
  ChartReport,
  ChartSeriesReport,
  ChartFrameProps,
  ChartLegendItem,
  ChartLegendProps,
} from './chart-frame.tsx';
export { ChartFrame, ChartLegend } from './chart-frame.tsx';
export type { ChartSelectDetails } from './chart.tsx';
export type { ChartTone } from '../../foundations/src/chart-tones.ts';
export { chartToneColors, chartToneOutlines } from '../../foundations/src/chart-tones.ts';
export type { ChartMarkShape, ChartSeriesMarkerProps } from './chart-series-marker.tsx';
export { ChartSeriesMarker } from './chart-series-marker.tsx';
export type { ChartGridProps } from './chart-grid.tsx';
export { ChartGrid } from './chart-grid.tsx';
export type { ChartLinkControl, ChartLinkInspectChange, ChartLinkProps } from './chart-link.tsx';
export { ChartLink, useChartLinkControl, useLinkedInspection } from './chart-link.tsx';
export type { CaptionScopeProps } from './figure/caption-scope.tsx';
export { CaptionScope, useIsCaptioned } from './figure/caption-scope.tsx';
export type { TimeFormat, ValueFormat } from './figure/figure-format.ts';
export { MISSING_VALUE_TEXT, formatTime, formatValue, tickFormat } from './figure/figure-format.ts';
export type {
  FigureCoverage,
  FigureProps,
  FigureSelectionProps,
  FigureStatus,
  SeriesFigureProps,
} from './figure/figure-props.ts';
export type { ToneScopeProps } from './figure/tone-scope.tsx';
export { ToneScope, useScopedTone } from './figure/tone-scope.tsx';
export type { PlotAxis, PlotHeight } from './plot/plot-layout.ts';
export { plotHeights } from './plot/plot-layout.ts';
export type { ChartRangeDetails, ChartRangeValue } from './chart-range.tsx';
export type { NumericDomain, ScaleType } from './plot/scale.ts';
