import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import { useEffect, useId, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { Skeleton } from '../../../feedback/src/index.ts';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalLimits, colorTone } from '../categorical-values.tsx';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import type { ChartDataProps } from '../chart-data.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartSelection, ChartSeriesReport } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { ChartInspection, ChartInspectionTitle, ChartLegendLoading, inspectionReadout } from '../chart-inspection.tsx';
import type { ChartInspectionRow } from '../chart-inspection.tsx';
import { ChartSvgSurface } from '../chart-surface.tsx';
import { chartStyles } from '../chart-theme.ts';
import type { ChartLegendItem } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';
import { markerPeak, markerValueLabel, validateBarOverlays, validateComposition } from './bar-data.ts';
import type { BarAnnotation, BarComposition, BarMarker, BarSeries } from './bar-data.ts';
import { BarAnnotations, BarMarkers } from './bar-overlays.tsx';
import type { BarSpan } from './bar-overlays.tsx';
import { CompositionBars } from './composition-bars.tsx';
import { referenceGutterWidth, ReferenceLines, validateReferenceLines } from './reference-lines.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';

export type { BarSeries, BarBucket, BarComposition, BarMarker, BarAnnotation } from './bar-data.ts';

const styles = stylex.create({
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  plot: { marginBlock: spacing.md },
  guide: { fill: colors.canvas },
  mutedMark: { opacity: 0.3 },
});

const DEFAULT_HEIGHT = 200;
const PLOT_TOP_PX = 12;
const ANNOTATED_PLOT_TOP_PX = 30;
const ANNOTATION_GAP_PX = 8;
const ANNOTATION_BASELINE_PX = 14;

export type BarChartProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly report?: ChartSeriesReport | undefined;
  readonly categories: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly axisLabel?: string | undefined;
  }>;
  readonly series: ReadonlyArray<BarSeries>;
  readonly domain: readonly [number, number];
  readonly mode?: 'grouped' | 'stacked' | undefined;
  readonly composition?: BarComposition | undefined;
  readonly formatValue: (value: number) => string;
  readonly formatTick?: ((value: number) => string) | undefined;
  readonly highlightedSeriesId?: string | undefined;
  readonly selection?: ChartSelection | undefined;
  readonly height?: number | undefined;
  /** Labelled values drawn across the plot, such as a target or an average. They join every category's readout. */
  readonly referenceLines?: ReadonlyArray<ChartReferenceLine> | undefined;
  /** Ticks or whiskers drawn on each bar of a series, listed in the legend and the readout. */
  readonly markers?: ReadonlyArray<BarMarker> | undefined;
  /** Short notes above chosen bars. Notes for a category also join its readout and exact values. */
  readonly annotations?: ReadonlyArray<BarAnnotation> | undefined;
  /**
   * Recedes every other category so these stand out, without changing selection or inspection. Emphasis is visual only;
   * explain it with an annotation or the description.
   */
  readonly emphasizedCategoryIds?: ReadonlyArray<string> | undefined;
};

export type BarChartPlaceholderProps = Pick<BarChartProps, 'description' | 'height' | 'report'> & {
  readonly title?: string | undefined;
  readonly series?: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>> | undefined;
};

type BarChartFrameProps = Pick<BarChartProps, 'title' | 'description' | 'report'> & {
  readonly series: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>>;
  readonly layoutSeries?: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>> | undefined;
  readonly markerLegend?: ReadonlyArray<ChartLegendItem> | undefined;
  readonly notes?: ReadonlyArray<string> | undefined;
  readonly inspectionId: string;
  readonly label?: string | undefined;
  readonly detail?: string | undefined;
  readonly summary?: string | undefined;
  readonly rows?: ReadonlyArray<ChartInspectionRow> | undefined;
  readonly x?: number | undefined;
  readonly width?: number | undefined;
  readonly offset?: number | undefined;
  readonly source?: 'pointer' | 'keyboard' | undefined;
  readonly data?: ChartDataProps;
  readonly isLoading?: boolean | undefined;
  readonly children: ReactNode;
};

function BarChartFrame({
  title,
  description,
  report,
  series,
  layoutSeries,
  markerLegend = [],
  notes,
  children,
  inspectionId,
  label,
  detail,
  summary,
  rows = [],
  x = 0,
  width = 0,
  offset,
  source,
  data,
  isLoading = false,
}: BarChartFrameProps): ReactNode {
  const legend = series.map((item, seriesIndex) => ({
    id: item.id,
    label: item.label,
    tone: colorTone(item.tone, seriesIndex),
  }));

  const layoutLegend = layoutSeries?.map((item, seriesIndex) => ({
    id: item.id,
    label: item.label,
    tone: colorTone(item.tone, seriesIndex),
  }));

  const hasUnknownLegend = isLoading && series.length === 0 && report?.seriesValues === undefined;

  return (
    <ChartFrame
      title={<ChartInspectionTitle title={title} detail={detail} />}
      description={description}
      report={report}
      series={legend}
    >
      {data !== undefined && <ChartData {...data} />}
      {hasUnknownLegend ? (
        <ChartLegendLoading />
      ) : (
        <ChartInspection
          id={inspectionId}
          label={label}
          summary={summary}
          legend={[...legend, ...markerLegend]}
          hasSeriesSummary={report?.seriesValues !== undefined}
          layoutLegend={layoutLegend === undefined ? undefined : [...layoutLegend, ...markerLegend]}
          rows={rows}
          notes={notes}
          x={x}
          width={width}
          offset={offset}
          source={source}
        />
      )}
      {children}
    </ChartFrame>
  );
}

export function BarChartPlaceholder({
  title = 'Loading chart',
  description,
  report,
  series = [],
  height = DEFAULT_HEIGHT,
}: BarChartPlaceholderProps): ReactNode {
  const issue = barHeightError(height);
  const inspectionId = useId();

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} report={report} message={issue} />;
  }

  return (
    <div aria-hidden inert>
      <BarChartFrame
        title={title}
        description={description}
        report={report}
        series={series}
        inspectionId={inspectionId}
        isLoading
      >
        <div {...stylex.props(chartStyles.plot, styles.plot)}>
          <Skeleton height={height} />
        </div>
      </BarChartFrame>
    </div>
  );
}

function barHeightError(height: number): string | undefined {
  if (!Number.isFinite(height) || height < 48) {
    return 'Chart height must be at least 48 pixels.';
  }

  return undefined;
}

function validateBars({
  categories,
  series,
  domain,
  mode,
}: Pick<BarChartProps, 'categories' | 'series' | 'domain' | 'mode'>): string | undefined {
  if (categories.length > categoricalLimits.items || series.length > categoricalLimits.series) {
    return `Choose a window with at most ${categoricalLimits.items} categories and ${categoricalLimits.series} series.`;
  }

  if (!isFiniteDomain(domain) || domain[0] > 0 || domain[1] < 0) {
    return 'The bar domain must be finite, increasing, and include zero.';
  }

  if (!hasUniqueIds(categories) || !hasUniqueIds(series)) {
    return 'Bar categories and series require unique identifiers.';
  }

  for (const item of series) {
    if (item.values.length !== categories.length) {
      return 'Every series requires one explicit value per category.';
    }

    for (const value of item.values) {
      if (value !== null) {
        if (!Number.isFinite(value) || value < domain[0] || value > domain[1]) {
          return 'Bar values must be finite and within the supplied domain.';
        }
      }

      if (mode === 'stacked' && (value === null || value < 0)) {
        return 'Stacked bars require present nonnegative values.';
      }
    }
  }

  if (
    mode === 'stacked' &&
    categories.some((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0) > domain[1])
  ) {
    return 'Stacked bar totals must fit the supplied domain.';
  }

  return undefined;
}

export function BarChart({
  title,
  description,
  report,
  categories,
  series,
  domain,
  mode = 'grouped',
  formatValue,
  formatTick = formatValue,
  highlightedSeriesId,
  selection,
  height = DEFAULT_HEIGHT,
  composition,
  referenceLines = [],
  markers = [],
  annotations = [],
  emphasizedCategoryIds = [],
}: BarChartProps): ReactNode {
  const focusSeries = composition?.focusedSeries;
  const contextId = useId();

  const focusIssue =
    focusSeries === undefined
      ? undefined
      : validateBars({ categories, series: [focusSeries], domain, mode: 'grouped' });

  const inputIssue = validateBars({ categories, series, domain, mode }) ?? focusIssue;

  const categoryIds = categories.map((category) => category.id);
  const markedSeriesIds = [...series, ...(focusSeries === undefined ? [] : [focusSeries])].map((item) => item.id);

  const overlayIssue =
    validateBarOverlays({
      markers,
      annotations,
      emphasizedCategoryIds,
      seriesIds: markedSeriesIds,
      categoryIds,
      domain,
    }) ?? validateReferenceLines({ lines: referenceLines, domain });

  const frameIssue =
    validateComposition({ composition, series, categoryIds, domain }) ?? overlayIssue ?? barHeightError(height);

  const issue = inputIssue ?? frameIssue;

  const context: BarSeries | undefined =
    composition === undefined
      ? undefined
      : {
          id: contextId,
          label: composition.contextLabel,
          tone: 'neutral',
          values: composition.buckets.map((bucket) => (bucket.kind === 'gap' ? null : bucket.total)),
        };

  const disclosedSeries =
    context === undefined
      ? series
      : [
          context,
          ...series,
          ...(focusSeries === undefined || series.some((item) => item.id === focusSeries.id) ? [] : [focusSeries]),
        ];

  const legend = focusSeries !== undefined && context !== undefined ? [focusSeries, context] : series;
  const { ref, width, element } = usePlotWidth();
  const inspectionId = useId();
  const [inspection, setInspection] = useState<{ readonly id: string; readonly source: 'pointer' | 'keyboard' }>();
  const [keyboardId, setKeyboardId] = useState<string>();

  useEffect(() => {
    function dismiss(event: globalThis.PointerEvent): void {
      if (event.target instanceof Node && element?.contains(event.target) !== true) {
        setInspection(undefined);
      }
    }

    document.addEventListener('pointerdown', dismiss);

    return () => document.removeEventListener('pointerdown', dismiss);
  }, [element]);

  const activeIndex = categories.findIndex((category) => category.id === inspection?.id);
  const active = categories[activeIndex];
  const selectedIndex = categories.findIndex((category) => category.id === selection?.selectedId);
  const selected = categories[selectedIndex];
  const cursor = categories.find((category) => category.id === keyboardId) ?? selected ?? categories[0];
  const readout = active;
  const readoutIndex = activeIndex;
  const bucket = composition?.buckets[readoutIndex];

  const inspectedSeries =
    focusSeries !== undefined && context !== undefined
      ? [focusSeries, context]
      : context === undefined || bucket?.kind === 'parts'
        ? series
        : [];

  const summary =
    bucket === undefined ? undefined : bucket.kind === 'gap' ? 'No reported value' : formatValue(bucket.total);

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} report={report} message={issue} />;
  }

  const seriesRows = inspectedSeries.map((item, seriesIndex) => {
    const value = item.values[readoutIndex];

    return {
      id: item.id,
      label: item.label,
      tone: colorTone(item.tone, seriesIndex),
      value: value === null || value === undefined ? 'Unavailable' : formatValue(value),
    };
  });

  const markerLegend: ReadonlyArray<ChartLegendItem> = markers.map((marker) => ({
    id: marker.id,
    label: marker.label,
    tone: marker.tone ?? 'neutral',
    shape: marker.kind,
  }));

  const markerRows: ReadonlyArray<ChartInspectionRow> = markers.map((marker) => ({
    id: marker.id,
    label: marker.label,
    tone: marker.tone ?? 'neutral',
    shape: marker.kind,
    value: markerValueLabel({ marker, index: readoutIndex, formatValue }),
  }));

  const referenceRows: ReadonlyArray<ChartInspectionRow> = referenceLines.map((line) => ({
    id: line.id,
    label: line.label,
    tone: line.tone ?? 'neutral',
    shape: 'dashed',
    value: formatValue(line.value),
  }));

  const rows = readout === undefined ? [] : [...seriesRows, ...markerRows, ...referenceRows];

  const notes = annotations
    .filter((annotation) => annotation.categoryId === readout?.id)
    .map((annotation) => annotation.label);

  const top = annotations.length > 0 ? ANNOTATED_PLOT_TOP_PX : PLOT_TOP_PX;
  const bottom = height - 28;
  const y = scaleLinear({ domain: [...domain], range: [bottom, top] });
  const left = Math.max(44, ...y.ticks(3).map((tick) => formatTick(tick).length * 7 + 12));
  const gutter = referenceGutterWidth({ lines: referenceLines, formatValue: formatTick });
  const right = Math.max(left + 1, width - 16 - gutter);
  const x = scaleBand({ domain: categories.map((category) => category.id), range: [left, right], padding: 0.3 });
  const grouped = scaleBand({ domain: series.map((item) => item.id), range: [0, x.bandwidth()], padding: 0.08 });

  const labelWidth = Math.min(
    120,
    Math.max(40, ...categories.map((category) => (category.axisLabel ?? category.label).length * 7)),
  );

  const labelEvery = Math.max(1, Math.ceil((labelWidth + 16) / x.step()));
  const isStackedGeometry = mode === 'stacked' || composition !== undefined;

  function span(categoryId: string, seriesId: string): BarSpan {
    const start = x(categoryId) ?? left;

    if (isStackedGeometry) {
      return { x: start, width: x.bandwidth() };
    }

    return { x: start + (grouped(seriesId) ?? 0), width: grouped.bandwidth() };
  }

  function barTop(categoryIndex: number, seriesId: string): number | null {
    if (!isStackedGeometry) {
      return series.find((item) => item.id === seriesId)?.values[categoryIndex] ?? null;
    }

    const values = series.flatMap((item) => [item.values[categoryIndex] ?? null].filter((value) => value !== null));

    return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
  }

  function isReceded(categoryId: string): boolean {
    const isEmphasized = emphasizedCategoryIds.includes(categoryId);

    return emphasizedCategoryIds.length > 0 && !isEmphasized && active?.id !== categoryId;
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

  const placedAnnotations = annotations.map((annotation) => {
    const index = categoryIds.indexOf(annotation.categoryId);
    const peak = annotationPeak(index, annotation.seriesId);

    const anchor =
      annotation.seriesId === undefined
        ? { x: x(annotation.categoryId) ?? left, width: x.bandwidth() }
        : span(annotation.categoryId, annotation.seriesId);

    return {
      id: annotation.id,
      label: annotation.label,
      x: anchor.x + anchor.width / 2,
      y: Math.max(ANNOTATION_BASELINE_PX, y(peak) - ANNOTATION_GAP_PX),
      isReceded: isReceded(annotation.categoryId),
    };
  });

  const labelCharacters = Math.max(1, Math.floor((x.step() * labelEvery - 16) / 7));

  function inspectPointer(event: PointerEvent<SVGSVGElement>): void {
    const rectangle = event.currentTarget.getBoundingClientRect();
    const point = ((event.clientX - rectangle.left) / rectangle.width) * width;
    const index = Math.floor((point - left) / x.step());
    const category = categories[Math.max(0, Math.min(categories.length - 1, index))];

    if (category !== undefined) {
      if (event.type === 'pointerdown') {
        setKeyboardId(category.id);
      }

      setInspection({ id: category.id, source: 'pointer' });
    }
  }

  return (
    <BarChartFrame
      title={title}
      description={description}
      report={report}
      series={legend}
      layoutSeries={series}
      markerLegend={markerLegend}
      notes={notes}
      inspectionId={inspectionId}
      label={readout?.label}
      detail={
        readout === undefined ? undefined : [readout.axisLabel ?? readout.label, summary].filter(Boolean).join(' · ')
      }
      summary={summary}
      rows={rows}
      x={(x(readout?.id ?? '') ?? left) + x.bandwidth() / 2}
      width={width}
      offset={x.bandwidth() / 2 + 8}
      source={inspection?.source}
      data={{
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
                barValueLabel(disclosedSeries, index, formatValue),
                ...markers.map((marker) => `${marker.label}: ${markerValueLabel({ marker, index, formatValue })}`),
                ...annotations
                  .filter((annotation) => annotation.categoryId === category.id)
                  .map((annotation) => annotation.label),
              ].join(' · '),
            ],
          })),
          ...referenceLines.map((line) => ({
            id: `reference:${line.id}`,
            values: [line.label, formatValue(line.value)],
          })),
        ],
      }}
    >
      <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
        {categories.length === 0 || (series.length === 0 && composition === undefined) ? (
          <p {...stylex.props(styles.empty)}>No categories</p>
        ) : (
          <ChartSvgSurface
            role="img"
            aria-label={`${title}. Use arrow keys to inspect categories.${selection === undefined ? '' : ' Press Enter to select.'}`}
            aria-describedby={inspectionId}
            tabIndex={0}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            controls={{
              items: categories,
              cursor: cursor?.id,
              inspected: active?.id,
              selected: selected?.id,
              readout: inspectionReadout({ label: active?.label, summary, rows, notes }),
              onInspect: (id) => {
                setKeyboardId(id);
                setInspection({ id, source: 'keyboard' });
              },
              onDismiss: () => setInspection(undefined),
              onSelect: selection?.onSelect,
            }}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) {
                const category = selected ?? categories[0];

                setKeyboardId(category?.id);
                setInspection(category === undefined ? undefined : { id: category.id, source: 'keyboard' });
              }
            }}
            onPointerMove={(event) => {
              if (event.pointerType === 'mouse') {
                inspectPointer(event);
              }
            }}
            onPointerDown={inspectPointer}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse' && inspection?.source === 'pointer') {
                setInspection(undefined);
              }
            }}
            onBlur={() => setInspection(undefined)}
            onClick={() => {
              if (active !== undefined) {
                selection?.onSelect(active.id);
              }
            }}
            {...stylex.props(chartStyles.svg, chartStyles.inspectable, stylex.defaultMarker())}
          >
            {active !== undefined && (
              <rect
                x={(x(active.id) ?? left) - (x.step() - x.bandwidth()) / 2}
                y={top}
                width={x.step()}
                height={bottom - top}
                {...stylex.props(styles.guide)}
              />
            )}
            {y.ticks(3).map((tick) => (
              <g key={tick}>
                <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} {...stylex.props(chartStyles.grid)} />
                <text
                  x={left - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  {...stylex.props(chartStyles.label)}
                >
                  {formatTick(tick)}
                </text>
              </g>
            ))}
            {composition?.annotation !== undefined &&
              categories.some((category) => category.id === composition.annotation?.categoryId) && (
                <text
                  x={x(composition.annotation.categoryId)}
                  y={Math.max(top, y(composition.annotation.value) - 8)}
                  {...stylex.props(chartStyles.label)}
                >
                  {composition.annotation.label}
                </text>
              )}
            {categories.map((category, categoryIndex) => {
              const axisLabel = category.axisLabel ?? category.label;
              const composedBucket = composition?.buckets[categoryIndex];

              return (
                <g key={category.id}>
                  <g {...stylex.props(chartStyles.emphasis, isReceded(category.id) && chartStyles.receded)}>
                    {composedBucket === undefined ? (
                      series.map((item, seriesIndex) => {
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
                        const isHighlighted = selection?.selectedId === category.id || active?.id === category.id;

                        return (
                          <Bar
                            key={item.id}
                            x={(x(category.id) ?? left) + (mode === 'stacked' ? 0 : (grouped(item.id) ?? 0))}
                            y={Math.min(start, end)}
                            width={mode === 'stacked' ? x.bandwidth() : grouped.bandwidth()}
                            height={Math.max(value === 0 ? 1 : 0, Math.abs(end - start))}
                            fill={chartToneColors[colorTone(item.tone, seriesIndex)]}
                            {...stylex.props(
                              isHighlighted && chartStyles.selected,
                              highlightedSeriesId !== undefined && highlightedSeriesId !== item.id && styles.mutedMark,
                            )}
                          />
                        );
                      })
                    ) : (
                      <CompositionBars
                        bucket={composedBucket}
                        series={series}
                        focusedSeries={focusSeries}
                        index={categoryIndex}
                        x={x(category.id) ?? left}
                        width={x.bandwidth()}
                        y={y}
                        isHighlighted={selection?.selectedId === category.id || active?.id === category.id}
                        highlightedSeriesId={highlightedSeriesId}
                      />
                    )}
                  </g>
                  {categoryIndex % labelEvery === 0 && (
                    <text
                      x={(x(category.id) ?? left) + x.bandwidth() / 2}
                      y={height - 4}
                      textAnchor="middle"
                      {...stylex.props(chartStyles.label)}
                    >
                      {axisLabel.length > labelCharacters ? `${axisLabel.slice(0, labelCharacters - 1)}…` : axisLabel}
                    </text>
                  )}
                </g>
              );
            })}
            <ReferenceLines
              lines={referenceLines}
              y={y}
              left={left}
              right={right}
              top={top}
              bottom={bottom}
              formatValue={formatTick}
            />
            <BarMarkers
              markers={markers}
              categoryIds={categoryIds}
              span={span}
              barTop={barTop}
              y={y}
              isReceded={isReceded}
            />
            <BarAnnotations annotations={placedAnnotations} left={left} right={right} />
            {cursor !== undefined && (
              <ChartCursor
                x={(x(cursor.id) ?? left) + x.bandwidth() / 2}
                top={top}
                bottom={bottom}
                width={Math.max(8, x.bandwidth())}
              />
            )}
          </ChartSvgSurface>
        )}
      </div>
    </BarChartFrame>
  );
}

function barValueLabel(
  series: ReadonlyArray<BarSeries>,
  index: number,
  formatValue: (value: number) => string,
): string {
  return series
    .map((item) => {
      const value = item.values[index];

      return `${item.label}: ${value === null || value === undefined ? 'Unavailable' : formatValue(value)}`;
    })
    .join(' · ');
}
