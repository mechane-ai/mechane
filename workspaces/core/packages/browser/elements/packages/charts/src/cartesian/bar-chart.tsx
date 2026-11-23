import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from '../../../feedback/src/index.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalLimits } from '../categorical-values.tsx';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import type { ChartDataProps } from '../chart-data.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { ChartInspection, ChartLegendLoading, inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { chartStyles } from '../chart-theme.ts';
import type { ChartLegendItem } from '../chart-theme.ts';
import { Chart, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid } from '../figure/figure-frame.tsx';
import type { FigureFrameProps } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, FigureSelectionProps, SeriesFigureProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { categoryPlot, fitDomain, plotHeights } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { BarMark, RuleMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { bandScale, outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { markerPeak, markerValueLabel, validateBarOverlays, validateComposition } from './bar-data.ts';
import type { BarAnnotation, BarComposition, BarMarker, BarSeries } from './bar-data.ts';
import { BarAnnotations, BarMarkers } from './bar-overlays.tsx';
import type { BarSpan, PlacedAnnotation } from './bar-overlays.tsx';
import { CompositionBars } from './composition-bars.tsx';
import { ReferenceMarks, validateReferenceLines } from './reference-lines.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';
import { clearLabels } from './value-labels.ts';

export type { BarSeries, BarBucket, BarComposition, BarMarker, BarAnnotation } from './bar-data.ts';

const styles = stylex.create({ placeholder: { marginBlock: spacing.md } });

/** Room above the tallest bar for its note, in pixels. */
const ANNOTATION_INSET = 18;
const ANNOTATION_GAP = 8;
const ANNOTATION_BASELINE = 14;
const GROUP_PADDING = 0.08;
const CURSOR_MIN = 8;
const INSPECTOR_OFFSET = 8;
const HALF = 0.5;

export type BarCategory = {
  readonly id: string;
  readonly label: string;
  /** A short name for the axis, such as "Jan". The readout uses the full label. */
  readonly axisLabel?: string | undefined;
};

export type BarChartProps = SeriesFigureProps &
  FigureSelectionProps & {
    readonly categories: ReadonlyArray<BarCategory>;
    readonly series: ReadonlyArray<BarSeries>;
    /** The value axis. Leave it out to fit zero and every drawn value on round bounds. */
    readonly domain?: NumericDomain | undefined;
    readonly mode?: 'grouped' | 'stacked' | undefined;
    readonly composition?: BarComposition | undefined;
    /** How the readout and the table write a value. */
    readonly valueFormat: ValueFormat;
    /** How the value axis writes its ticks. Absent uses the compact form of `valueFormat`. */
    readonly tickFormat?: ValueFormat | undefined;
    /**
     * The value axis title, with its unit: "Cost (USD)". With a title the ticks leave a `unit` style out, so the unit
     * is written once. Absent draws no title.
     */
    readonly valueLabel?: string | undefined;
    /** The series drawn at full strength while the others fade. Emphasis only; selection is unchanged. */
    readonly highlighted?: string | null | undefined;
    readonly height?: PlotHeight | undefined;
    /** Labelled values drawn across the plot, such as a target or an average. They join every category's readout. */
    readonly referenceLines?: ReadonlyArray<ChartReferenceLine> | undefined;
    /** Ticks or whiskers drawn on each bar of a series, listed in the legend and the readout. */
    readonly markers?: ReadonlyArray<BarMarker> | undefined;
    /** Short notes above chosen bars. Notes for a category also join its readout and exact values. */
    readonly annotations?: ReadonlyArray<BarAnnotation> | undefined;
    /**
     * Recedes every other category so these stand out, without changing selection or inspection. Emphasis is visual
     * only; explain it with an annotation or the description.
     */
    readonly emphasizedCategoryIds?: ReadonlyArray<string> | undefined;
  };

export type BarChartPlaceholderProps = Omit<FigureFrameInput, 'title' | 'status'> & {
  readonly title?: string | undefined;
  readonly series?: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>> | undefined;
  readonly height?: PlotHeight | undefined;
};

type LegendSeries = Pick<BarSeries, 'id' | 'label' | 'tone'>;

type BarChartFrameProps = Omit<FigureFrameProps, 'series'> & {
  readonly legend: ReadonlyArray<ChartLegendItem>;
  readonly layoutLegend?: ReadonlyArray<ChartLegendItem> | undefined;
  readonly notes?: ReadonlyArray<string> | undefined;
  readonly inspectionId: string;
  readonly label?: string | undefined;
  readonly summary?: string | undefined;
  readonly rows?: ReadonlyArray<ChartInspectionRow> | undefined;
  readonly x?: number | undefined;
  readonly width?: number | undefined;
  readonly offset?: number | undefined;
  readonly data?: ChartDataProps;
  readonly isLoading?: boolean | undefined;
};

function BarChartFrame({
  legend,
  layoutLegend,
  notes,
  children,
  inspectionId,
  label,
  summary,
  rows = [],
  x = 0,
  width = 0,
  offset,
  data,
  isLoading = false,
  ...frame
}: BarChartFrameProps): ReactNode {
  const hasUnknownLegend = isLoading && legend.length === 0 && frame.report?.seriesValues === undefined;

  return (
    <FigureFrame
      {...frame}
      series={legend}
      seriesLegend={
        hasUnknownLegend ? (
          <ChartLegendLoading />
        ) : (
          <ChartInspection
            id={inspectionId}
            label={label}
            summary={summary}
            legend={legend}
            hasSeriesSummary={frame.report?.seriesValues !== undefined}
            layoutLegend={layoutLegend}
            rows={rows}
            notes={notes}
            x={x}
            width={width}
            offset={offset}
          />
        )
      }
    >
      {data !== undefined && <ChartData {...data} />}
      {children}
    </FigureFrame>
  );
}

function useSeriesLegend(): (series: ReadonlyArray<LegendSeries>) => ReadonlyArray<ChartLegendItem> {
  const tones = useTones();

  return (series) =>
    series.map((item, index) => ({
      id: item.id,
      label: item.label,
      tone: tones({ id: item.id, tone: item.tone, index }),
    }));
}

/**
 * The loading state of a bar chart: its heading, its legend for known series and the plot footprint, with no invented
 * bars. The enclosing async region owns the announcement.
 */
export function BarChartPlaceholder({
  title = 'Loading chart',
  series = [],
  height = 'compact',
  ...frame
}: BarChartPlaceholderProps): ReactNode {
  const inspectionId = useId();
  const legend = useSeriesLegend()(series);

  return (
    <div aria-hidden inert>
      <BarChartFrame {...frame} title={title} status="loading" legend={legend} inspectionId={inspectionId} isLoading>
        <div {...stylex.props(chartStyles.plot, styles.placeholder)}>
          <Skeleton height={plotHeights[height]} />
        </div>
      </BarChartFrame>
    </div>
  );
}

function stackTotals(series: ReadonlyArray<BarSeries>, count: number): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) =>
    series.reduce((sum, item) => sum + Math.max(0, item.values[index] ?? 0), 0),
  );
}

function validateBars({
  categories,
  series,
  domain,
  mode,
}: Pick<BarChartProps, 'categories' | 'series' | 'mode'> & { readonly domain: NumericDomain }): string | undefined {
  if (categories.length > categoricalLimits.items || series.length > categoricalLimits.series) {
    return `Choose a window with at most ${categoricalLimits.items} categories and ${categoricalLimits.series} series.`;
  }

  if (scaleDomainError(domain) !== undefined || domain[0] > 0 || domain[1] < 0) {
    return 'The bar domain must be finite, increasing, and include zero.';
  }

  if (!hasUniqueIds(categories) || !hasUniqueIds(series)) {
    return 'Bar categories and series require unique identifiers.';
  }

  for (const item of series) {
    if (item.values.length !== categories.length) {
      return 'Every series requires one explicit value per category.';
    }

    if (item.values.some((value) => value !== null && outsideDomain(value, domain))) {
      return 'Bar values must be finite and within the supplied domain.';
    }

    if (mode === 'stacked' && item.values.some((value) => value === null || value < 0)) {
      return 'Stacked bars require present nonnegative values.';
    }
  }

  if (mode === 'stacked' && stackTotals(series, categories.length).some((total) => total > domain[1])) {
    return 'Stacked bar totals must fit the supplied domain.';
  }

  return undefined;
}

/** Every value the plot draws, so a fitted domain holds each bar, marker, line and note. */
function drawnValues({
  categories,
  series,
  mode,
  composition,
  referenceLines,
  markers,
}: Pick<BarChartProps, 'categories' | 'series' | 'mode' | 'composition'> & {
  readonly referenceLines: ReadonlyArray<ChartReferenceLine>;
  readonly markers: ReadonlyArray<BarMarker>;
}): ReadonlyArray<number | null> {
  const isStacked = mode === 'stacked' || composition !== undefined;
  const bars = series.flatMap((item) => item.values);
  const stacks = isStacked ? stackTotals(series, categories.length) : [];
  const focused = composition?.focusedSeries?.values ?? [];
  const buckets = composition?.buckets.map((bucket) => (bucket.kind === 'gap' ? null : bucket.total)) ?? [];

  const marked = markers.flatMap((marker) =>
    marker.kind === 'tick' ? marker.values : [...marker.lower, ...marker.upper],
  );

  return [
    ...bars,
    ...stacks,
    ...focused,
    ...buckets,
    ...marked,
    ...referenceLines.map((line) => line.value),
    ...(composition?.annotation === undefined ? [] : [composition.annotation.value]),
  ];
}

/**
 * Bars that compare an amount across named categories, grouped or stacked by series from a zero baseline. It also draws
 * prepared composition buckets, reference lines, markers and short notes the application supplies.
 */
export function BarChart({
  categories,
  series,
  domain,
  mode = 'grouped',
  valueFormat,
  tickFormat,
  valueLabel,
  highlighted,
  selected,
  onSelectedChange,
  height: plotHeight = 'compact',
  composition,
  referenceLines = [],
  markers = [],
  annotations = [],
  emphasizedCategoryIds = [],
  ...figure
}: BarChartProps): ReactNode {
  const { emptyLabel = 'No categories', ...frame } = figure;
  const { locale, title } = frame;
  const focusSeries = composition?.focusedSeries;
  const contextId = useId();
  const inspectionId = useId();
  const { ref, width, height } = usePlotSize(plotHeight);
  const tones = useTones();
  const legendOf = useSeriesLegend();

  if (frame.status === 'loading') {
    return <BarChartPlaceholder {...frame} series={series} height={plotHeight} />;
  }

  const valueDomain =
    domain ??
    fitDomain({
      values: drawnValues({ categories, series, mode, composition, referenceLines, markers }),
      isZeroBased: true,
    });

  const focusIssue =
    focusSeries === undefined
      ? undefined
      : validateBars({ categories, series: [focusSeries], domain: valueDomain, mode: 'grouped' });

  const inputIssue = validateBars({ categories, series, domain: valueDomain, mode }) ?? focusIssue;
  const categoryIds = categories.map((category) => category.id);
  const markedSeriesIds = [...series, ...(focusSeries === undefined ? [] : [focusSeries])].map((item) => item.id);

  const overlayIssue =
    validateBarOverlays({
      markers,
      annotations,
      emphasizedCategoryIds,
      seriesIds: markedSeriesIds,
      categoryIds,
      domain: valueDomain,
    }) ?? validateReferenceLines({ lines: referenceLines, domain: valueDomain });

  const issue =
    inputIssue ?? validateComposition({ composition, series, categoryIds, domain: valueDomain }) ?? overlayIssue;

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  function text(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const extraFocus = focusSeries !== undefined && !series.some((item) => item.id === focusSeries.id);
  const toned = [...series, ...(extraFocus ? [focusSeries] : [])];

  const seriesTones: ReadonlyMap<string, ChartTone> = new Map(
    toned.map((item, index) => [item.id, tones({ id: item.id, tone: item.tone, index })]),
  );

  function toneOf(id: string): ChartTone {
    return seriesTones.get(id) ?? 'neutral';
  }

  const context: BarSeries | undefined =
    composition === undefined
      ? undefined
      : {
          id: contextId,
          label: composition.contextLabel,
          tone: 'neutral',
          values: composition.buckets.map((bucket) => (bucket.kind === 'gap' ? null : bucket.total)),
        };

  const disclosedSeries = context === undefined ? series : [context, ...toned];

  const legendSeries = focusSeries !== undefined && context !== undefined ? [focusSeries, context] : series;

  const legend = legendSeries.map((item) => ({
    id: item.id,
    label: item.label,
    tone: item.id === contextId ? ('neutral' as const) : toneOf(item.id),
  }));

  const markerLegend: ReadonlyArray<ChartLegendItem> = markers.map((marker) => ({
    id: marker.id,
    label: marker.label,
    tone: marker.tone ?? 'neutral',
    shape: marker.kind,
  }));

  function reading(index: number) {
    const category = categories[index];
    const bucket = composition?.buckets[index];

    const inspectedSeries =
      focusSeries !== undefined && context !== undefined
        ? [focusSeries, context]
        : context === undefined || bucket?.kind === 'parts'
          ? series
          : [];

    const summary = bucket === undefined ? undefined : bucket.kind === 'gap' ? 'No reported value' : text(bucket.total);

    const seriesRows = inspectedSeries.map((item) => ({
      id: item.id,
      label: item.label,
      tone: item.id === contextId ? ('neutral' as const) : toneOf(item.id),
      value: text(item.values[index] ?? null),
    }));

    const markerRows: ReadonlyArray<ChartInspectionRow> = markers.map((marker) => ({
      id: marker.id,
      label: marker.label,
      tone: marker.tone ?? 'neutral',
      shape: marker.kind,
      value: markerValueLabel({ marker, index, valueText: text }),
    }));

    const referenceRows: ReadonlyArray<ChartInspectionRow> = referenceLines.map((line) => ({
      id: line.id,
      label: line.label,
      tone: line.tone ?? 'neutral',
      shape: 'dashed',
      value: text(line.value),
    }));

    return {
      category,
      label: category?.label,
      summary,
      rows: category === undefined ? [] : [...seriesRows, ...markerRows, ...referenceRows],
      notes: annotations
        .filter((annotation) => annotation.categoryId === category?.id)
        .map((annotation) => annotation.label),
    };
  }

  const compositionNote = composition?.annotation;
  const hasNotes = annotations.length > 0 || compositionNote !== undefined;

  const plot = categoryPlot({
    width,
    height,
    direction: 'columns',
    categories: categories.map((category) => ({ id: category.id, label: category.axisLabel ?? category.label })),
    value: { label: valueLabel ?? '', format: valueFormat, tickFormat },
    valueDomain,
    locale,
    topInset: hasNotes ? ANNOTATION_INSET : 0,
    hasValueTitle: valueLabel !== undefined,
  });

  const { box, band } = plot;
  const y = plot.value.position;
  const grouped = bandScale({ ids: series.map((item) => item.id), range: [0, band.bandwidth], padding: GROUP_PADDING });
  const isStackedGeometry = mode === 'stacked' || composition !== undefined;

  function categoryStart(id: string): number {
    return band.start(id) ?? box.left;
  }

  function categoryCenter(id: string): number {
    return categoryStart(id) + band.bandwidth * HALF;
  }

  function span(categoryId: string, seriesId: string): BarSpan {
    const start = categoryStart(categoryId);

    if (isStackedGeometry) {
      return { x: start, width: band.bandwidth };
    }

    return { x: start + (grouped.start(seriesId) ?? 0), width: grouped.bandwidth };
  }

  function barTop(categoryIndex: number, seriesId: string): number | null {
    if (!isStackedGeometry) {
      return series.find((item) => item.id === seriesId)?.values[categoryIndex] ?? null;
    }

    const values = series.flatMap((item) => [item.values[categoryIndex] ?? null].filter((value) => value !== null));

    return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
  }

  function annotationPeak(index: number, seriesId: string | undefined): number {
    const anchored = seriesId === undefined ? series : series.filter((item) => item.id === seriesId);
    const values = anchored.flatMap((item) => [item.values[index] ?? null].filter((value) => value !== null));

    const stackTop = isStackedGeometry
      ? values.reduce((sum, value) => sum + Math.max(0, value), 0)
      : Math.max(0, ...values);

    const composed = composition?.buckets[index];
    const bucketTop = composed === undefined || composed.kind === 'gap' ? 0 : composed.total;

    const markerTops = markers
      .filter((marker) => seriesId === undefined || marker.seriesId === seriesId)
      .flatMap((marker) => [markerPeak(marker, index)].filter((value) => value !== null));

    return Math.max(0, stackTop, bucketTop, ...markerTops);
  }

  function noteBaseline(value: number): number {
    return Math.max(ANNOTATION_BASELINE, y(value) - ANNOTATION_GAP);
  }

  const data: ChartDataProps = {
    label: `${title} observations`,
    columns: [
      { id: 'category', label: 'Category' },
      { id: 'value', label: 'Value' },
    ],
    rows: [
      ...categories.map((category, index) => ({
        id: category.id,
        values: [
          category.label,
          [
            ...disclosedSeries.map((item) => `${item.label}: ${text(item.values[index] ?? null)}`),
            ...markers.map((marker) => `${marker.label}: ${markerValueLabel({ marker, index, valueText: text })}`),
            ...annotations
              .filter((annotation) => annotation.categoryId === category.id)
              .map((annotation) => annotation.label),
          ].join(' · '),
        ],
      })),
      ...referenceLines.map((line) => ({ id: `reference:${line.id}`, values: [line.label, text(line.value)] })),
    ],
  };

  return (
    <Chart
      items={categories}
      readout={(id) => inspectionReadout(reading(categoryIds.indexOf(id)))}
      locate={(point) => band.idAt((point.x / point.width) * box.width)}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => {
        const active = reading(categoryIds.indexOf(inspected ?? ''));

        function isReceded(categoryId: string): boolean {
          const isEmphasized = emphasizedCategoryIds.includes(categoryId);

          return emphasizedCategoryIds.length > 0 && !isEmphasized && inspected !== categoryId;
        }

        const compositionNotes: ReadonlyArray<PlacedAnnotation> =
          compositionNote === undefined || !categoryIds.includes(compositionNote.categoryId)
            ? []
            : [
                {
                  id: `composition:${compositionNote.categoryId}`,
                  text: compositionNote.label,
                  x: categoryCenter(compositionNote.categoryId),
                  y: noteBaseline(compositionNote.value),
                  isReceded: isReceded(compositionNote.categoryId),
                },
              ];

        const placedAnnotations = annotations.map((annotation) => {
          const anchor =
            annotation.seriesId === undefined
              ? { x: categoryStart(annotation.categoryId), width: band.bandwidth }
              : span(annotation.categoryId, annotation.seriesId);

          return {
            id: annotation.id,
            text: annotation.label,
            x: anchor.x + anchor.width * HALF,
            y: noteBaseline(annotationPeak(categoryIds.indexOf(annotation.categoryId), annotation.seriesId)),
            isReceded: isReceded(annotation.categoryId),
          };
        });

        const notes = [...compositionNotes, ...placedAnnotations];

        return (
          <BarChartFrame
            {...frame}
            figure={figureProps}
            legend={[...legend, ...markerLegend]}
            layoutLegend={[...legendOf(series), ...markerLegend]}
            notes={active.notes}
            inspectionId={inspectionId}
            label={active.label}
            titleDetail={
              active.category === undefined
                ? undefined
                : [active.category.axisLabel ?? active.category.label, active.summary].filter(Boolean).join(' · ')
            }
            summary={active.summary}
            rows={active.rows}
            x={categoryCenter(inspected ?? '')}
            width={width}
            offset={band.bandwidth * HALF + INSPECTOR_OFFSET}
            data={data}
          >
            {categories.length === 0 || (series.length === 0 && composition === undefined) ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <PlotSurface
                plotRef={ref}
                box={box}
                label={plotLabel({ title, marks: 'categories', isSelectable: onSelectedChange !== undefined })}
                readoutId={inspectionId}
              >
                <PlotAxes box={box} xTicks={plot.bandTicks} yTicks={plot.valueTicks} yTitle={valueLabel} />
                <PlotClip box={box}>
                  {categories.map((category, categoryIndex) => {
                    const composedBucket = composition?.buckets[categoryIndex];
                    const state = { isSelected: selected === category.id, isInspected: inspected === category.id };

                    if (composedBucket !== undefined) {
                      return (
                        <g
                          key={category.id}
                          {...stylex.props(chartStyles.emphasis, isReceded(category.id) && chartStyles.receded)}
                        >
                          <CompositionBars
                            {...state}
                            bucket={composedBucket}
                            series={series}
                            focusedSeries={focusSeries}
                            index={categoryIndex}
                            x={categoryStart(category.id)}
                            width={band.bandwidth}
                            y={y}
                            highlighted={highlighted}
                            toneOf={toneOf}
                          />
                        </g>
                      );
                    }

                    return series.map((item, seriesIndex) => {
                      const value = item.values[categoryIndex];

                      if (value === null || value === undefined) {
                        return null;
                      }

                      const base =
                        mode === 'stacked'
                          ? series
                              .slice(0, seriesIndex)
                              .reduce((sum, previous) => sum + (previous.values[categoryIndex] ?? 0), 0)
                          : 0;

                      const start = y(base);
                      const end = y(base + value);
                      const isMuted = highlighted !== undefined && highlighted !== null && highlighted !== item.id;
                      const bar = span(category.id, item.id);

                      return (
                        <BarMark
                          key={`${category.id}:${item.id}`}
                          {...state}
                          x={bar.x}
                          y={Math.min(start, end)}
                          width={bar.width}
                          height={Math.max(value === 0 ? 1 : 0, Math.abs(end - start))}
                          tone={toneOf(item.id)}
                          emphasis={isMuted || isReceded(category.id) ? 'receded' : 'normal'}
                        />
                      );
                    });
                  })}
                  <RuleMark x1={box.left} x2={box.right} y1={y(0)} y2={y(0)} />
                  <BarMarkers
                    markers={markers}
                    categoryIds={categoryIds}
                    span={span}
                    barTop={barTop}
                    y={y}
                    isReceded={isReceded}
                  />
                </PlotClip>
                <ReferenceMarks
                  lines={referenceLines}
                  box={box}
                  position={y}
                  valueText={text}
                  avoid={clearLabels(notes)}
                />
                <BarAnnotations annotations={notes} left={box.left} right={box.right} />
                {cursor !== null && (
                  <ChartCursor
                    x={categoryCenter(cursor)}
                    top={box.top}
                    bottom={box.bottom}
                    width={Math.max(CURSOR_MIN, band.bandwidth)}
                  />
                )}
              </PlotSurface>
            )}
          </BarChartFrame>
        );
      }}
    />
  );
}
