import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import { useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalLimits, CategoricalValues, colorTone } from '../categorical-values.tsx';
import { ChartDataDisclosure, ChartFrame, ChartLegend } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';

const styles = stylex.create({
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  plot: { marginBlock: spacing.md },
  inspection: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.md,
    minHeight: typography.captionLineHeight,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  guide: { fill: colors.canvas },
});

const selectionKeys: ReadonlySet<string> = new Set(['Enter', ' ']);

export type BarSeries = {
  readonly id: string;
  readonly label: string;
  readonly values: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

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
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection | undefined;
  readonly height?: number | undefined;
};

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
  height = 200,
}: BarChartProps): ReactNode {
  const issue = validateBars({ categories, series, domain, mode });
  const { ref, width } = usePlotWidth();
  const inspectionId = useId();
  const [inspection, setInspection] = useState<{ readonly id: string; readonly source: 'pointer' | 'keyboard' }>();
  const activeIndex = categories.findIndex((category) => category.id === inspection?.id);
  const active = categories[activeIndex];

  if (issue !== undefined || !Number.isFinite(height) || height < 48) {
    return (
      <ChartInputError
        title={title}
        description={description}
        message={issue ?? 'Chart height must be at least 48 pixels.'}
      />
    );
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
  const labelCharacters = Math.max(1, Math.floor((x.step() * labelEvery - 16) / 7));
  const legend = series.map((item, index) => ({ id: item.id, label: item.label, tone: colorTone(item.tone, index) }));

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
    <ChartFrame title={title} description={description}>
      <ChartLegend items={legend} />
      <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
        {categories.length === 0 || series.length === 0 ? (
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
            {categories.map((category, categoryIndex) => {
              const axisLabel = category.axisLabel ?? category.label;

              return (
                <g key={category.id}>
                  {series.map((item, seriesIndex) => {
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
                  })}
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
      {categories.length > 0 && series.length > 0 && (
        <div
          id={inspectionId}
          aria-live={inspection?.source === 'keyboard' ? 'polite' : 'off'}
          {...stylex.props(styles.inspection)}
        >
          {active === undefined ? (
            <span {...stylex.props(styles.empty)}>Point, tap, or use the arrow keys to inspect values.</span>
          ) : (
            <>
              <span>{active.label}</span>
              {series.map((item) => (
                <span key={item.id}>
                  {item.label}:{' '}
                  {item.values[activeIndex] === null || item.values[activeIndex] === undefined
                    ? 'Unavailable'
                    : formatValue(item.values[activeIndex])}
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
            valueLabel: series
              .map(
                (item) =>
                  `${item.label}: ${item.values[index] === null || item.values[index] === undefined ? 'Unavailable' : formatValue(item.values[index])}`,
              )
              .join(' · '),
            tone: 'neutral',
          }))}
          selection={selection}
        />
      </ChartDataDisclosure>
    </ChartFrame>
  );
}
