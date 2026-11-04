import * as stylex from '@stylexjs/stylex';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { categoricalLimits, CategoricalValues, colorTone } from '../categorical-values.tsx';
import { ChartFrame, ChartLegend } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';

const styles = stylex.create({
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  plot: { marginBlock: spacing.md },
});

export type BarSeries = {
  readonly id: string;
  readonly label: string;
  readonly values: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

export type BarChartProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly categories: ReadonlyArray<{ readonly id: string; readonly label: string }>;
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
  const labelEvery = Math.max(1, Math.ceil(56 / x.step()));
  const labelCharacters = Math.max(1, Math.floor((x.step() * labelEvery) / 12) - 1);
  const legend = series.map((item, index) => ({ id: item.id, label: item.label, tone: colorTone(item.tone, index) }));

  return (
    <ChartFrame title={title} description={description}>
      <ChartLegend items={legend} />
      <div ref={ref} {...stylex.props(chartStyles.plot, styles.plot)}>
        {categories.length === 0 || series.length === 0 ? (
          <p {...stylex.props(styles.empty)}>No categories</p>
        ) : (
          <svg
            role="img"
            aria-label={title}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            {...stylex.props(chartStyles.svg)}
          >
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
            {categories.map((category, categoryIndex) => (
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

                  return (
                    <Bar
                      key={item.id}
                      x={(x(category.id) ?? left) + (mode === 'stacked' ? 0 : (grouped(item.id) ?? 0))}
                      y={Math.min(start, end)}
                      width={mode === 'stacked' ? x.bandwidth() : grouped.bandwidth()}
                      height={Math.max(value === 0 ? 1 : 0, Math.abs(end - start))}
                      fill={chartToneColors[colorTone(item.tone, seriesIndex)]}
                      {...stylex.props(selection?.selectedId === category.id && chartStyles.selected)}
                    >
                      <title>
                        {category.label} · {item.label}: {formatValue(value)}
                      </title>
                    </Bar>
                  );
                })}
                {categoryIndex % labelEvery === 0 && (
                  <text
                    x={(x(category.id) ?? left) + x.bandwidth() / 2}
                    y={height - 4}
                    textAnchor="middle"
                    {...stylex.props(chartStyles.label)}
                  >
                    {category.label.length > labelCharacters
                      ? `${category.label.slice(0, labelCharacters)}…`
                      : category.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
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
    </ChartFrame>
  );
}
