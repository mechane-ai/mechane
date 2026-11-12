import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import { useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { Skeleton } from '../../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalLimits, CategoricalValues, colorTone } from '../categorical-values.tsx';
import { ChartDataDisclosure, ChartFrame, ChartLegend } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';
import { validateComposition } from './bar-data.ts';
import type { BarComposition, BarSeries } from './bar-data.ts';
import { CompositionBars } from './composition-bars.tsx';

export type { BarSeries, BarBucket, BarComposition } from './bar-data.ts';

const styles = stylex.create({
  legend: { minHeight: typography.captionLineHeight },
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  plot: { marginBlock: spacing.md },
  inspection: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    minHeight: `calc(${typography.captionLineHeight} * 2)`,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  guide: { fill: colors.canvas },
  placeholderHint: { position: 'relative', minWidth: 0 },
  placeholderDecoration: { position: 'absolute', inset: 0 },
  hidden: { visibility: 'hidden' },
});

const selectionKeys: ReadonlySet<string> = new Set(['Enter', ' ']);
const DEFAULT_HEIGHT = 200;
const INSPECTION_HINT = 'Point, tap, or use the arrow keys to inspect values.';

export type BarChartProps = {
  readonly title: string;
  readonly description?: string | undefined;
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
  readonly selection?: ChartSelection | undefined;
  readonly height?: number | undefined;
};

export type BarChartPlaceholderProps = Pick<BarChartProps, 'description' | 'height'> & {
  readonly title?: string | undefined;
  readonly series?: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>> | undefined;
};

type BarChartFrameProps = Pick<BarChartProps, 'title' | 'description'> & {
  readonly series: ReadonlyArray<Pick<BarSeries, 'id' | 'label' | 'tone'>>;
  readonly children: ReactNode;
};

function BarChartFrame({ title, description, series, children }: BarChartFrameProps): ReactNode {
  const legend = series.map((item, index) => ({ id: item.id, label: item.label, tone: colorTone(item.tone, index) }));

  return (
    <ChartFrame title={title} description={description}>
      <div {...stylex.props(styles.legend)}>
        <ChartLegend items={legend} isScrollable />
      </div>
      {children}
    </ChartFrame>
  );
}

export function BarChartPlaceholder({
  title = 'Loading chart',
  description,
  series = [],
  height = DEFAULT_HEIGHT,
}: BarChartPlaceholderProps): ReactNode {
  const issue = barHeightError(height);

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} message={issue} />;
  }

  return (
    <div aria-hidden inert>
      <BarChartFrame title={title} description={description} series={series}>
        <div {...stylex.props(chartStyles.plot, styles.plot)}>
          <Skeleton height={height} />
        </div>
        <div {...stylex.props(styles.inspection)}>
          <span {...stylex.props(styles.placeholderHint)}>
            <span {...stylex.props(styles.hidden)}>{INSPECTION_HINT}</span>
            <span {...stylex.props(styles.placeholderDecoration)}>
              <Skeleton height="100%" />
            </span>
          </span>
        </div>
        <div {...stylex.props(styles.hidden)}>
          <ChartDataDisclosure>{null}</ChartDataDisclosure>
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
  categories,
  series,
  domain,
  mode = 'grouped',
  formatValue,
  selection,
  height = DEFAULT_HEIGHT,
  composition,
}: BarChartProps): ReactNode {
  const focusSeries = composition?.focusedSeries;
  const contextId = useId();

  const focusIssue =
    focusSeries === undefined
      ? undefined
      : validateBars({ categories, series: [focusSeries], domain, mode: 'grouped' });

  const inputIssue = validateBars({ categories, series, domain, mode }) ?? focusIssue;

  const frameIssue =
    validateComposition({ composition, series, categoryIds: categories.map((category) => category.id), domain }) ??
    barHeightError(height);

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

  const inspectedSeries =
    context === undefined ? series : [context, ...(focusSeries === undefined ? [] : [focusSeries])];

  const disclosedSeries =
    context === undefined
      ? series
      : [
          context,
          ...series,
          ...(focusSeries === undefined || series.some((item) => item.id === focusSeries.id) ? [] : [focusSeries]),
        ];

  const legend = series.length > 0 ? series : inspectedSeries;
  const { ref, width } = usePlotWidth();
  const inspectionId = useId();
  const [inspection, setInspection] = useState<{ readonly id: string; readonly source: 'pointer' | 'keyboard' }>();
  const activeIndex = categories.findIndex((category) => category.id === inspection?.id);
  const active = categories[activeIndex];
  const selectedIndex = categories.findIndex((category) => category.id === selection?.selectedId);
  const selected = categories[selectedIndex];
  const readout = active ?? selected;
  const readoutIndex = active === undefined ? selectedIndex : activeIndex;

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} message={issue} />;
  }

  const bottom = height - 28;
  const y = scaleLinear({ domain: [...domain], range: [bottom, 12] });
  const left = Math.max(52, ...y.ticks(3).map((tick) => formatValue(tick).length * 7 + 12));
  const right = Math.max(left + 1, width - 16);
  const x = scaleBand({ domain: categories.map((category) => category.id), range: [left, right], padding: 0.3 });
  const grouped = scaleBand({ domain: series.map((item) => item.id), range: [0, x.bandwidth()], padding: 0.08 });

  const labelWidth = Math.min(
    120,
    Math.max(40, ...categories.map((category) => (category.axisLabel ?? category.label).length * 7)),
  );

  const labelEvery = Math.max(1, Math.ceil((labelWidth + 16) / x.step()));
  const hasData = categories.length > 0 && (series.length > 0 || composition !== undefined);

  const labelCharacters = Math.max(1, Math.floor((x.step() * labelEvery - 16) / 7));

  function inspectPointer(event: PointerEvent<SVGSVGElement>): void {
    const rectangle = event.currentTarget.getBoundingClientRect();
    const point = ((event.clientX - rectangle.left) / rectangle.width) * width;
    const index = Math.floor((point - left) / x.step());
    const category = categories[Math.max(0, Math.min(categories.length - 1, index))];

    if (category !== undefined) {
      setInspection({ id: category.id, source: 'pointer' });
    }
  }

  function inspectKey(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setInspection(undefined);

      return;
    }

    if (selectionKeys.has(event.key)) {
      if (active !== undefined && selection !== undefined) {
        event.preventDefault();
        selection.onSelect(active.id);
      }

      return;
    }

    const index = {
      ArrowRight: Math.min(categories.length - 1, activeIndex + 1),
      ArrowLeft: Math.max(0, activeIndex - 1),
      Home: 0,
      End: categories.length - 1,
    }[event.key];

    const category = index === undefined ? undefined : categories[index];

    if (category !== undefined) {
      event.preventDefault();
      setInspection({ id: category.id, source: 'keyboard' });
    }
  }

  return (
    <BarChartFrame title={title} description={description} series={legend}>
      <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
        {categories.length === 0 || (series.length === 0 && composition === undefined) ? (
          <p {...stylex.props(styles.empty)}>No categories</p>
        ) : (
          <svg
            role="img"
            aria-label={`${title}. Use arrow keys to inspect categories.${selection === undefined ? '' : ' Press Enter to select.'}`}
            aria-describedby={inspectionId}
            tabIndex={0}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            onKeyDown={inspectKey}
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
            {...stylex.props(chartStyles.svg, chartStyles.focus)}
          >
            {active !== undefined && (
              <rect
                x={(x(active.id) ?? left) - (x.step() - x.bandwidth()) / 2}
                y={12}
                width={x.step()}
                height={bottom - 12}
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
                  {formatValue(tick)}
                </text>
              </g>
            ))}
            {composition?.annotation !== undefined &&
              categories.some((category) => category.id === composition.annotation?.categoryId) && (
                <text
                  x={x(composition.annotation.categoryId)}
                  y={Math.max(12, y(composition.annotation.value) - 8)}
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
                          {...stylex.props(isHighlighted && chartStyles.selected)}
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
                    />
                  )}
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
          </svg>
        )}
      </div>
      {hasData && (
        <div
          id={inspectionId}
          aria-live={inspection?.source === 'pointer' ? 'off' : 'polite'}
          {...stylex.props(styles.inspection)}
        >
          {readout === undefined ? (
            <span {...stylex.props(styles.empty)}>{INSPECTION_HINT}</span>
          ) : (
            <>
              <span>{readout.label}</span>
              {inspectedSeries.map((item) => (
                <span key={item.id}>
                  {item.label}:{' '}
                  {item.values[readoutIndex] === null || item.values[readoutIndex] === undefined
                    ? 'Unavailable'
                    : formatValue(item.values[readoutIndex])}
                </span>
              ))}
            </>
          )}
        </div>
      )}
      <ChartDataDisclosure>
        <CategoricalValues
          items={categories.map((category, index) => ({
            id: category.id,
            label: category.label,
            valueLabel: barValueLabel(disclosedSeries, index, formatValue),
            tone: 'neutral',
          }))}
          selection={selection}
        />
      </ChartDataDisclosure>
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
