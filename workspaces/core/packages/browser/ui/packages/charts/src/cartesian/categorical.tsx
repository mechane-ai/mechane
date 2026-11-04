import * as stylex from '@stylexjs/stylex';
import { hierarchy, Treemap as VisxTreemap } from '@visx/hierarchy';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../core/src/tokens.stylex.ts';
import { ChartDatumButton, ChartFrame, ChartLegend } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';

export type BreakdownItem = {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly tone?: ChartTone | undefined;
};

export type BreakdownBarProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly items: ReadonlyArray<BreakdownItem>;
  readonly total: number;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection | undefined;
};

export type TreemapProps = Omit<BreakdownBarProps, 'total'> & { readonly height?: number | undefined };

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

const categoricalLimits = { items: 200, series: 12 } as const;
const TONES: ReadonlyArray<ChartTone> = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'];

const styles = stylex.create({
  track: {
    display: 'flex',
    height: 10,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    marginBlockEnd: spacing.sm,
  },
  segment: (width: number, color: string) => ({ width: `${width}%`, backgroundColor: color, height: '100%' }),
  rows: { display: 'grid', margin: 0, padding: 0, listStyle: 'none' },
  name: { display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  swatch: (color: string) => ({ width: 8, height: 8, flexShrink: 0, backgroundColor: color }),
  value: { color: colors.muted, textAlign: 'end' },
  empty: { color: colors.muted, margin: 0, fontSize: typography.captionSize },
  plot: { marginBlock: spacing.md },
  treeLabel: { fill: colors.ink, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
  treeRect: { stroke: colors.surface, strokeWidth: 1 },
});

function colorTone(tone: ChartTone | undefined, index: number): ChartTone {
  return tone ?? TONES[index % TONES.length] ?? 'series1';
}

function validateBreakdown(items: ReadonlyArray<BreakdownItem>): string | undefined {
  if (items.length > categoricalLimits.items) {
    return `Choose a window with at most ${categoricalLimits.items} items.`;
  }

  if (!hasUniqueIds(items)) {
    return 'Every breakdown item needs a unique identifier.';
  }

  if (items.some((item) => item.value !== null && (!Number.isFinite(item.value) || item.value < 0))) {
    return 'Breakdown values must be finite and nonnegative, or explicitly missing.';
  }

  if (!Number.isFinite(items.reduce((sum, item) => sum + (item.value ?? 0), 0))) {
    return 'The sum of recorded values must be finite.';
  }

  return undefined;
}

function CategoricalValues({
  items,
  selection,
}: {
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly valueLabel: string;
    readonly tone: ChartTone;
  }>;
  readonly selection?: ChartSelection | undefined;
}): ReactNode {
  return (
    <ul {...stylex.props(styles.rows)}>
      {items.map((item) => (
        <li key={item.id}>
          <ChartDatumButton
            label={`${item.label}: ${item.valueLabel}`}
            selected={selection?.selectedId === item.id}
            onSelect={selection === undefined ? undefined : () => selection.onSelect(item.id)}
          >
            <span {...stylex.props(styles.name)}>
              <span aria-hidden {...stylex.props(styles.swatch(chartToneColors[item.tone]))} />
              {item.label}
            </span>
            <span {...stylex.props(styles.value)}>{item.valueLabel}</span>
          </ChartDatumButton>
        </li>
      ))}
    </ul>
  );
}

export function BreakdownBar({
  title,
  description,
  items,
  total,
  formatValue,
  selection,
}: BreakdownBarProps): ReactNode {
  const issue = validateBreakdown(items);
  const recorded = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const roundingTolerance = Number.EPSILON * Math.max(recorded, total, 1) * items.length;

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} message={issue} />;
  }

  if (!Number.isFinite(total) || total < 0 || recorded - total > roundingTolerance) {
    return (
      <ChartInputError
        title={title}
        description={description}
        message="The total must be finite and at least the sum of recorded values."
      />
    );
  }

  return (
    <ChartFrame title={title} description={description}>
      {items.length === 0 ? (
        <p {...stylex.props(styles.empty)}>No values</p>
      ) : (
        <>
          <div aria-hidden {...stylex.props(styles.track)}>
            {items.map((item, index) =>
              item.value === null ? null : (
                <span
                  key={item.id}
                  {...stylex.props(
                    styles.segment(
                      total === 0 ? 0 : (item.value / total) * 100,
                      chartToneColors[colorTone(item.tone, index)],
                    ),
                  )}
                />
              ),
            )}
          </div>
          <CategoricalValues
            items={items.map((item, index) => ({
              id: item.id,
              label: item.label,
              valueLabel: item.value === null ? 'Unavailable' : formatValue(item.value),
              tone: colorTone(item.tone, index),
            }))}
            selection={selection}
          />
          {total - recorded > roundingTolerance && (
            <p {...stylex.props(styles.empty)}>
              Unassigned portion: {formatValue(total - recorded)} of {formatValue(total)}
            </p>
          )}
        </>
      )}
    </ChartFrame>
  );
}

type TreemapDatum = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly tone: ChartTone;
  readonly children?: ReadonlyArray<TreemapDatum>;
};

export function Treemap({ title, description, items, formatValue, selection, height = 180 }: TreemapProps): ReactNode {
  const issue = validateBreakdown(items);
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
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

  const children = items.flatMap((item, index) =>
    item.value === null || item.value === 0
      ? []
      : [{ id: item.id, label: item.label, value: item.value, tone: colorTone(item.tone, index) }],
  );

  const root = hierarchy<TreemapDatum>({ id: 'root', label: title, value: 0, tone: 'neutral', children }, (datum) =>
    datum.children === undefined ? undefined : [...datum.children],
  ).sum((datum) => datum.value);

  return (
    <ChartFrame title={title} description={description}>
      <div ref={ref} {...stylex.props(chartStyles.plot)}>
        {total === 0 ? (
          <p {...stylex.props(styles.empty)}>No positive values to size the areas</p>
        ) : (
          <svg
            role="img"
            aria-label={`${title}. Areas compare recorded values.`}
            viewBox={`0 0 ${width} ${height}`}
            height={height}
            {...stylex.props(chartStyles.svg)}
          >
            <VisxTreemap root={root} size={[width, height]} paddingInner={2}>
              {(tree) =>
                tree.leaves().map((node) => {
                  const hasLabelRoom = node.x1 - node.x0 > 96 && node.y1 - node.y0 > 40;

                  return (
                    <g key={node.data.id}>
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={node.x1 - node.x0}
                        height={node.y1 - node.y0}
                        fill={chartToneColors[node.data.tone]}
                        fillOpacity={0.18}
                        {...stylex.props(
                          styles.treeRect,
                          selection?.selectedId === node.data.id && chartStyles.selected,
                        )}
                      />
                      <title>
                        {node.data.label}: {formatValue(node.data.value)}
                      </title>
                      {hasLabelRoom && (
                        <svg
                          x={node.x0}
                          y={node.y0}
                          width={node.x1 - node.x0}
                          height={node.y1 - node.y0}
                          overflow="hidden"
                        >
                          <text x={8} y={18} {...stylex.props(styles.treeLabel)}>
                            {node.data.label.slice(0, Math.floor((node.x1 - node.x0 - 16) / 7))}
                          </text>
                          {formatValue(node.data.value).length * 12 < node.x1 - node.x0 - 16 && (
                            <text x={8} y={34} {...stylex.props(styles.treeLabel)}>
                              {formatValue(node.data.value)}
                            </text>
                          )}
                        </svg>
                      )}
                    </g>
                  );
                })
              }
            </VisxTreemap>
          </svg>
        )}
      </div>
      <CategoricalValues
        items={items.map((item, index) => ({
          id: item.id,
          label: item.label,
          valueLabel: item.value === null ? 'Unavailable' : formatValue(item.value),
          tone: colorTone(item.tone, index),
        }))}
        selection={selection}
      />
      {items.some((item) => item.value === null) && (
        <p {...stylex.props(styles.empty)}>Unavailable values have no area.</p>
      )}
    </ChartFrame>
  );
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
