import type { ChartTone } from '../../../charts/src/index.ts';

/** Where a run stands: still training, done, ended with an error, or stopped by a person. */
export type RunState = 'running' | 'finished' | 'failed' | 'stopped';

/** One training run. Its id is the same in the dashboard, the table and every chart, so a run keeps one hue. */
export type RunRecord = {
  readonly id: string;
  readonly label: string;
  /** A short line under the name, such as the model and dataset. */
  readonly detail?: string | undefined;
  readonly state: RunState;
  /** Pins the run's hue. Absent takes the next hue in the order the runs are listed. */
  readonly tone?: ChartTone | undefined;
};

/** Why a run list or table changed: a press on a control, or a call such as an agent's step. */
export type RunChangeDetails = { readonly reason: 'press' | 'imperative'; readonly event?: Event | undefined };

/** The words that name each state. */
export type RunStateLabels = Readonly<Record<RunState, string>>;

export const runStateLabels = {
  running: 'Running',
  finished: 'Finished',
  failed: 'Failed',
  stopped: 'Stopped',
} as const satisfies RunStateLabels;

/** The most runs the dashboard and table show. Each needs its own hue and a legend entry. */
export const runLimits = { runs: 12 } as const;

/** Why the runs cannot be shown, or undefined when they can. */
export function runsProblem(runs: ReadonlyArray<RunRecord>): string | undefined {
  if (new Set(runs.map((run) => run.id)).size !== runs.length) {
    return 'Runs must have unique identifiers.';
  }

  return runs.length > runLimits.runs
    ? `This view shows at most ${runLimits.runs} runs. Use RunsOverview for a sweep.`
    : undefined;
}

/** The hues the application pinned, keyed by run id, for a tone scope. */
export function pinnedTones(runs: ReadonlyArray<RunRecord>): Readonly<Record<string, ChartTone>> {
  return Object.fromEntries(runs.flatMap((run) => (run.tone === undefined ? [] : [[run.id, run.tone]])));
}
