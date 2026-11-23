import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { FigureProps, FigureSelectionProps, PlotAxis, PlotHeight } from '../../../charts/src/index.ts';
import { RunsChart } from '../../../charts/src/trend/index.ts';
import type { RunsSummary, TrainingRun } from '../../../charts/src/trend/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

export type RunsOverviewProps = FigureProps &
  FigureSelectionProps & {
    /** Every run of the sweep with its curve of one metric. Each is a thin gray line until it is selected. */
    readonly runs: ReadonlyArray<TrainingRun>;
    readonly x: PlotAxis;
    readonly y: PlotAxis;
    /** The median and a band across runs, which the application computes. */
    readonly summary?: RunsSummary | undefined;
    /** A line the application writes under the plot: "48 runs · median final loss 2.13 · best run 17". */
    readonly summaryText?: string | undefined;
    readonly height?: PlotHeight | undefined;
  };

const styles = stylex.create({
  root: { display: 'grid', gap: spacing.sm, minWidth: 0 },
  summary: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
});

/**
 * A whole sweep at a glance: every run as a thin gray line, the selected run named in its hue, and a median with a band
 * across all runs. Use it above a `RunTable` when there are too many runs to give each one a hue. The application holds
 * the selection and computes the summary.
 */
export function RunsOverview({ summaryText, selected, ...chart }: RunsOverviewProps): ReactNode {
  return (
    <div {...stylex.props(styles.root)}>
      <RunsChart
        {...chart}
        selected={selected}
        featured={selected === null || selected === undefined ? [] : [selected]}
      />
      {summaryText !== undefined && <p {...stylex.props(styles.summary)}>{summaryText}</p>}
    </div>
  );
}
