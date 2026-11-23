import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { ChartGrid, ToneScope } from '../../../charts/src/index.ts';
import type { FigureProps, PlotAxis, PlotHeight } from '../../../charts/src/index.ts';
import { CurveChart } from '../../../charts/src/trend/index.ts';
import type { CurvePoint } from '../../../charts/src/trend/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { RunLegend } from './run-legend.tsx';
import type { RunLegendLabels } from './run-legend.tsx';
import { pinnedTones, runsProblem, runStateLabels } from './runs.ts';
import type { RunChangeDetails, RunRecord } from './runs.ts';

/** One measure the dashboard draws in its own panel. */
export type RunMetric = {
  readonly id: string;
  readonly title: string;
  /** The measure's axis: its label, format and, when it should stay fixed between reads, its domain. */
  readonly y: PlotAxis;
  /** One sentence under the panel title: what is measured and which direction is better. */
  readonly description?: string | undefined;
};

/** One observation of a metric at a step. A null `y` is a step with no recording; the line breaks there. */
export type MetricPoint = Pick<CurvePoint, 'x' | 'y'>;

/** The curves to draw: metric id, then run id, then the run's observations in increasing step. */
export type MetricSeries = Readonly<Record<string, Readonly<Record<string, ReadonlyArray<MetricPoint>>>>>;

/** The words around the dashboard. Each has an English default. */
export type RunDashboardLabels = RunLegendLabels & { readonly noRuns: string; readonly allHidden: string };

export type RunDashboardProps = Pick<
  FigureProps,
  'title' | 'description' | 'locale' | 'status' | 'coverage' | 'transforms'
> & {
  readonly runs: ReadonlyArray<RunRecord>;
  readonly metrics: ReadonlyArray<RunMetric>;
  readonly series: MetricSeries;
  /** The step axis every panel shares. */
  readonly x: PlotAxis;
  /** The run in focus: its curves keep their hue and every other run turns gray. Null or absent focuses none. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string | null, details: RunChangeDetails) => void) | undefined;
  /** The ids of the runs toggled off. They leave the charts but keep their hue for when they come back. */
  readonly hidden?: ReadonlyArray<string> | undefined;
  readonly onHiddenChange?: ((ids: ReadonlyArray<string>, details: RunChangeDetails) => void) | undefined;
  /** Shows a row of run chips above the panels. Turn it off when a `RunTable` is the legend. */
  readonly hasLegend?: boolean | undefined;
  readonly height?: PlotHeight | undefined;
  /** The narrowest a panel may be, in CSS pixels. */
  readonly minPanelWidth?: number | undefined;
  readonly labels?: Partial<RunDashboardLabels> | undefined;
};

const defaultLabels: RunDashboardLabels = {
  legend: 'Runs',
  hide: 'Hide',
  show: 'Show',
  states: runStateLabels,
  noRuns: 'There are no runs to compare.',
  allHidden: 'Every run is hidden. Show a run to see its curves.',
};

const styles = stylex.create({ root: { display: 'grid', gap: spacing.lg, minWidth: 0 } });

function dashboardProblem({
  runs,
  metrics,
  series,
  selected,
  hidden,
}: Pick<RunDashboardProps, 'runs' | 'metrics' | 'series'> & {
  readonly selected: string | null;
  readonly hidden: ReadonlyArray<string>;
}): string | undefined {
  const runIds = new Set(runs.map((run) => run.id));
  const metricIds = new Set(metrics.map((metric) => metric.id));
  const unknownMetric = Object.keys(series).find((id) => !metricIds.has(id));

  const unknownRun = Object.values(series)
    .flatMap((byRun) => Object.keys(byRun))
    .find((id) => !runIds.has(id));

  if (metricIds.size !== metrics.length) {
    return 'Metrics must have unique identifiers.';
  }

  if (unknownMetric !== undefined) {
    return `The series name metric ${unknownMetric}, which is not among the metrics.`;
  }

  if (unknownRun !== undefined) {
    return `The series name run ${unknownRun}, which is not among the runs.`;
  }

  if (selected !== null && !runIds.has(selected)) {
    return `The selected run ${selected} is not among the runs.`;
  }

  const unknownHidden = hidden.find((id) => !runIds.has(id));

  return unknownHidden === undefined ? runsProblem(runs) : `The hidden run ${unknownHidden} is not among the runs.`;
}

/**
 * A panel of curves per metric for a set of runs, as a training team watches them. It has one hue per run in every
 * panel and one step cursor that moves in all panels together, and focusing a run turns the others gray. Hiding a run
 * removes its curves, and the application holds both choices and supplies prepared series, smoothed or not, for every
 * metric.
 */
export function RunDashboard({
  title,
  description,
  locale,
  status,
  coverage,
  transforms,
  runs,
  metrics,
  series,
  x,
  selected = null,
  onSelectedChange,
  hidden = [],
  onHiddenChange,
  hasLegend = true,
  height = 'compact',
  minPanelWidth,
  labels: given,
}: RunDashboardProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const problem = dashboardProblem({ runs, metrics, series, selected, hidden });

  if (problem !== undefined) {
    return <Notice hasError>{`${title}: ${problem}`}</Notice>;
  }

  const shown = runs.filter((run) => !hidden.includes(run.id));
  const emptyLabel = runs.length === 0 ? labels.noRuns : labels.allHidden;

  return (
    <ToneScope ids={runs.map((run) => run.id)} tones={pinnedTones(runs)}>
      <div {...stylex.props(styles.root)}>
        {hasLegend && (
          <RunLegend
            runs={runs}
            selected={selected}
            hidden={hidden}
            labels={labels}
            onSelectedChange={onSelectedChange}
            onHiddenChange={onHiddenChange}
          />
        )}
        <ChartGrid
          title={title}
          description={description}
          minPanelWidth={minPanelWidth}
          ids={runs.map((run) => run.id)}
          tones={pinnedTones(runs)}
        >
          {metrics.map((metric) => (
            <CurveChart
              key={metric.id}
              title={metric.title}
              description={metric.description}
              locale={locale}
              status={status}
              coverage={coverage}
              transforms={transforms}
              emptyLabel={emptyLabel}
              x={x}
              y={metric.y}
              height={height}
              labels="none"
              highlighted={selected}
              series={shown.map((run) => ({ id: run.id, label: run.label, points: series[metric.id]?.[run.id] ?? [] }))}
            />
          ))}
        </ChartGrid>
      </div>
    </ToneScope>
  );
}
