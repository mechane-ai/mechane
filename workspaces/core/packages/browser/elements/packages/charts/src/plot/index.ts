/**
 * The plot kernel is what every chart in Elements is built from, and the way to build a chart the library lacks. Such a
 * chart shares the axes, marks, readout, keyboard cursor, states and tones of the others. `CurveChart` in
 * `charts/trend` is the reference for how the parts fit together.
 */
export type { ChartDataProps, ChartDataRow } from '../chart-data.tsx';
export { ChartData } from '../chart-data.tsx';
export { ChartCursor } from '../chart-cursor.tsx';
export { ChartReadout } from '../chart-frame.tsx';
export { hasUniqueIds } from '../chart-input.ts';
export type { ChartInspectionRow } from '../chart-inspection.tsx';
export { ChartInspection } from '../chart-inspection.tsx';
export { chartStyles } from '../chart-theme.ts';
export type {
  ChartInspectDetails,
  ChartInspectReason,
  ChartItem,
  ChartOptions,
  ChartPoint,
  ChartView,
} from '../chart.tsx';
export { Chart, ChartMark, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
export type { FigureFrameProps } from '../figure/figure-frame.tsx';
export { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading, coverageText } from '../figure/figure-frame.tsx';
export type { FigureFrameInput } from '../figure/figure-props.ts';
export type { ToneInput } from '../figure/tone-scope.tsx';
export { assignTones, automaticTone, useTones } from '../figure/tone-scope.tsx';
export { zoneOffset } from '../figure/figure-format.ts';
export type { ContourGrid, ContourSegment, GridPoint } from './contours.ts';
export { contourSegments, sampleGrid, segmentsPath } from './contours.ts';
export type { LabelBox, LabelObstacle, LabelSpot } from './label-place.ts';
export { freeLabelSpot, labelBox } from './label-place.ts';
export type { MarkPosition } from './locate.ts';
export { locateNearest } from './locate.ts';
export type { AreaPoint, LinkPathInput, LinkShape, PathCurve, PathPoint } from './path.ts';
export { areaPath, isolatedPoints, linePath, linkPath } from './path.ts';
export type { PlotAxesProps, PlotGrid } from './plot-axes.tsx';
export { PlotAxes } from './plot-axes.tsx';
export type {
  AxisTicks,
  AxisTicksInput,
  CategoryPlotLayout,
  FitDomainInput,
  NumericPlotLayout,
  PlotBox,
  PlotCategory,
  PlotMargins,
  PlotTick,
  TimeAxisTicksInput,
  TimePlotInput,
  ValueGutterInput,
} from './plot-layout.ts';
export {
  axisTicks,
  axisTitle,
  bandTicks,
  categoryPlot,
  fitDomain,
  numericPlot,
  plotBox,
  plotMargins,
  tickTexts,
  ticksMinimum,
  timeAxisTicks,
  timePlot,
  valueGutter,
} from './plot-layout.ts';
export type {
  AreaMarkProps,
  BarMarkProps,
  DotMarkProps,
  LabelMarkProps,
  LineMarkProps,
  LinkMarkProps,
  MarkEmphasis,
  MarkState,
  MarkStroke,
  Segment,
  SymbolMarkProps,
  SymbolShape,
} from './plot-marks.tsx';
export {
  AreaMark,
  BandMark,
  BarMark,
  ConnectorMark,
  DotMark,
  GuideMark,
  IntervalMark,
  LabelMark,
  LineMark,
  LinkMark,
  RingMark,
  RuleMark,
  SymbolMark,
} from './plot-marks.tsx';
export type { PlotSurfaceProps } from './plot-surface.tsx';
export { PlotClip, PlotSurface, usePlotSize } from './plot-surface.tsx';
export type { DensityLayerProps } from './render/density-layer.tsx';
export { DensityLayer } from './render/density-layer.tsx';
export type { DataRect, HitIndex, HitQuery, PointColumns } from './render/hit-index.ts';
export { countInside, hitIndex } from './render/hit-index.ts';
export type { PlotView, PlotViewDetails, PlotViewportOptions, PlotViewportRootProps } from './render/plot-viewport.tsx';
export { PlotViewportRoot, PlotViewportSurface, WHOLE_VIEW, visibleDomains } from './render/plot-viewport.tsx';
export type { PointAxis, PointDraw, PointLayerProps, PointRenderer } from './render/point-layer.tsx';
export { PointLayer } from './render/point-layer.tsx';
export type { BandScale, BandScaleInput, ContinuousScale, ContinuousScaleInput } from './scale.ts';
export { bandScale, columnExtent, continuousScale, isFiniteDomain, outsideDomain, scaleDomainError } from './scale.ts';
export type { TickInput, TimeTickInput } from './ticks.ts';
export { linearTicks, logTicks, scaleTicks, symlogTicks, timeTicks } from './ticks.ts';
