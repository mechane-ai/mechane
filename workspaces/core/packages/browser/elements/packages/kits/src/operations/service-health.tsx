import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { SmallMultiples, Sparkline } from '../../../charts/src/cartesian/index.ts';
import type { SmallMultiplesPanel, TimeSeriesPoint, TimestampUnit } from '../../../charts/src/cartesian/index.ts';
import { formatValue, ToneScope } from '../../../charts/src/index.ts';
import type { FigureStatus, NumericDomain, PlotHeight, TimeFormat, ValueFormat } from '../../../charts/src/index.ts';
import { Metric, MetricGrid } from '../../../collections/src/index.ts';
import { Muted, Status, Subheading } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

/** How the service is doing right now, as the application judged it. The kit never infers it from the numbers. */
export type ServiceState = 'healthy' | 'degraded' | 'down' | 'unknown';

/** One headline measure of the service, shown as a tile. */
export type ServiceIndicator = {
  /** Also the id of the chart series that draws the same measure, so the tile and the chart share one hue. */
  readonly id: string;
  readonly label: string;
  /** The latest value, or null where it was not measured. */
  readonly value: number | null;
  readonly format: ValueFormat;
  /** How the value moved, written beside it: the amount, how to write it, and what it is compared with. */
  readonly change?: { readonly value: number; readonly format: ValueFormat; readonly label: string } | undefined;
  /** The level the measure is held against, such as "Objective". */
  readonly target?: { readonly value: number; readonly label: string } | undefined;
  /** A small line of recent values. `valueDomain` must contain every value. */
  readonly trend?:
    | { readonly points: ReadonlyArray<TimeSeriesPoint>; readonly valueDomain: NumericDomain; readonly unit: string }
    | undefined;
};

/** The words ServiceHealth writes itself. Each has an English default. */
export type ServiceHealthLabels = {
  readonly healthy: string;
  readonly degraded: string;
  readonly down: string;
  readonly unknown: string;
  readonly indicators: string;
  readonly charts: string;
  readonly trendSummary: string;
  readonly duplicateIds: string;
};

export type ServiceHealthProps = {
  readonly service: {
    readonly id: string;
    readonly label: string;
    readonly state: ServiceState;
    /** One sentence on why the service is in this state. */
    readonly stateDetail?: string | undefined;
  };
  readonly indicators: ReadonlyArray<ServiceIndicator>;
  /** Time-series panels on the same observation timestamps. They share one time axis and one inspected timestamp. */
  readonly charts: ReadonlyArray<SmallMultiplesPanel>;
  readonly timestampUnit: TimestampUnit;
  readonly timeFormat: TimeFormat;
  readonly locale: string;
  readonly height?: PlotHeight | undefined;
  readonly status?: FigureStatus | undefined;
  readonly labels?: Partial<ServiceHealthLabels> | undefined;
};

const defaultLabels: ServiceHealthLabels = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  unknown: 'State unknown',
  indicators: 'Right now',
  charts: 'Over time',
  trendSummary: 'Recent values of the measure.',
  duplicateIds: 'Indicators and chart panels each need unique identifiers.',
};

const stateTones = { healthy: 'positive', degraded: 'warning', down: 'negative', unknown: 'neutral' } as const;

const styles = stylex.create({
  root: { display: 'grid', gap: spacing.xl, minWidth: 0, fontFamily: typography.fontFamily, color: colors.ink },
  header: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  state: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xs },
  section: { display: 'grid', gap: spacing.md, minWidth: 0 },
  heading: {
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
  },
});

function hasDuplicates(ids: ReadonlyArray<string>): boolean {
  return new Set(ids).size !== ids.length;
}

/**
 * One service at a glance: its state in words, a row of headline tiles with their recent trend, and time-series panels
 * on one shared time axis. The application judges the state and supplies every value; nothing here infers health from a
 * number or a color. Name a chart series like its tile and the two share a hue.
 */
export function ServiceHealth({
  service,
  indicators,
  charts,
  timestampUnit,
  timeFormat,
  locale,
  height = 'compact',
  status,
  labels,
}: ServiceHealthProps): ReactNode {
  const headingId = useId();
  const words = { ...defaultLabels, ...labels };
  const isLoading = status === 'loading';

  if (hasDuplicates(indicators.map((item) => item.id)) || hasDuplicates(charts.map((chart) => chart.id))) {
    return <Notice hasError>{words.duplicateIds}</Notice>;
  }

  const toneIds = [
    ...new Set([
      ...indicators.map((item) => item.id),
      ...charts.flatMap((chart) => chart.series.map((item) => item.id)),
    ]),
  ];

  return (
    <ToneScope ids={toneIds}>
      <section aria-labelledby={headingId} {...stylex.props(styles.root)}>
        <header {...stylex.props(styles.header)}>
          <Subheading id={headingId}>{service.label}</Subheading>
          <div {...stylex.props(styles.state)}>
            <Status tone={stateTones[service.state]}>{words[service.state]}</Status>
            {service.stateDetail !== undefined && <Muted>{service.stateDetail}</Muted>}
          </div>
        </header>
        {indicators.length > 0 && (
          <div {...stylex.props(styles.section)}>
            <h3 {...stylex.props(styles.heading)}>{words.indicators}</h3>
            <MetricGrid layout="columns">
              {indicators.map((item) => {
                const detail = [
                  item.change === undefined
                    ? undefined
                    : `${formatValue({ value: item.change.value, locale, format: item.change.format })} ${item.change.label}`,
                  item.target === undefined
                    ? undefined
                    : `${item.target.label} ${formatValue({ value: item.target.value, locale, format: item.format })}`,
                ]
                  .filter((part) => part !== undefined)
                  .join(' · ');

                return isLoading ? (
                  <Metric key={item.id} variant="statistic" label={item.label} isLoading hasDetail />
                ) : (
                  <Metric
                    key={item.id}
                    variant="statistic"
                    label={item.label}
                    value={formatValue({ value: item.value, locale, format: item.format })}
                    {...(detail === '' ? {} : { detail })}
                    {...(item.trend === undefined
                      ? {}
                      : {
                          trend: (
                            <Sparkline
                              title={`${item.label} trend`}
                              summary={words.trendSummary}
                              unit={item.trend.unit}
                              timestampUnit={timestampUnit}
                              series={{ id: item.id, label: item.label, points: item.trend.points }}
                              valueDomain={item.trend.valueDomain}
                            />
                          ),
                        })}
                  />
                );
              })}
            </MetricGrid>
          </div>
        )}
        {charts.length > 0 && (
          <div {...stylex.props(styles.section)}>
            <h3 {...stylex.props(styles.heading)}>{words.charts}</h3>
            <SmallMultiples
              charts={charts}
              timestampUnit={timestampUnit}
              timeFormat={timeFormat}
              height={height}
              locale={locale}
              status={status}
            />
          </div>
        )}
      </section>
    </ToneScope>
  );
}
