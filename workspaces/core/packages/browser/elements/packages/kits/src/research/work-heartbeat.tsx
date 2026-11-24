import type { ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import { Timestamp } from '../../../collections/src/index.ts';
import { Badge, Identifier, Panel, Row, Stack, Status, Text } from '../../../core/src/index.ts';
import { Progress } from '../../../feedback/src/index.ts';

export type WorkHeartbeatState = 'running' | 'completed' | 'blocked' | 'overdue' | 'stopped';

export type WorkProgress = { readonly completed: number; readonly total: number; readonly unit: string };

export type WorkReportItem = {
  readonly id: string;
  readonly title: string;
  readonly state: WorkHeartbeatState;
  readonly observedAt: string;
  readonly observedLabel: string;
  readonly executionRef?: string | undefined;
  readonly nextCheckpoint?: string | undefined;
  readonly progress?: WorkProgress | undefined;
};

export type WorkHeartbeatLabels = {
  readonly title: string;
  readonly empty: string;
  readonly nextCheckpoint: string;
  readonly states: Readonly<Record<WorkHeartbeatState, string>>;
};

export type WorkHeartbeatProps = {
  readonly reports: ReadonlyArray<WorkReportItem>;
  readonly locale: string;
  readonly title?: string | undefined;
  readonly labels?: Partial<WorkHeartbeatLabels> | undefined;
};

const defaultLabels: WorkHeartbeatLabels = {
  title: 'Active work reports',
  empty: 'No active or recent work reports.',
  nextCheckpoint: 'Next checkpoint',
  states: {
    running: 'Running',
    completed: 'Completed',
    blocked: 'Blocked',
    overdue: 'Update overdue',
    stopped: 'Stopped',
  },
};

const stateTone: Readonly<Record<WorkHeartbeatState, 'positive' | 'warning' | 'negative' | 'neutral'>> = {
  running: 'positive',
  completed: 'neutral',
  blocked: 'negative',
  overdue: 'warning',
  stopped: 'neutral',
};

function validProgress(progress: WorkProgress | undefined): WorkProgress | null {
  if (progress === undefined) {
    return null;
  }

  const isFiniteValues = Number.isFinite(progress.completed) && Number.isFinite(progress.total);

  return isFiniteValues && progress.total > 0 ? progress : null;
}

/**
 * Displays reported execution checkpoints with explicit freshness and optional finite batch progress. The application
 * owns the state (including when an expired report becomes `'overdue'`); the kit never infers failure from staleness.
 */
export function WorkHeartbeat({ reports, locale, title, labels: given }: WorkHeartbeatProps): ReactNode {
  const labels: WorkHeartbeatLabels = {
    ...defaultLabels,
    ...given,
    states: { ...defaultLabels.states, ...given?.states },
  };

  if (reports.length === 0) {
    return (
      <Panel title={title ?? labels.title}>
        <Text variant="caption" tone="muted">
          {labels.empty}
        </Text>
      </Panel>
    );
  }

  return (
    <Stack isCompact>
      {reports.map((report) => {
        const progress = validProgress(report.progress);
        const pct = progress === null ? null : Math.max(0, Math.min(100, (progress.completed / progress.total) * 100));

        return (
          <Panel
            key={report.id}
            title={report.title}
            meta={
              <Row>
                <Status tone={stateTone[report.state]}>{labels.states[report.state]}</Status>
                <Timestamp dateTime={report.observedAt} label={report.observedLabel} />
              </Row>
            }
          >
            <Stack isCompact>
              {progress !== null && pct !== null && (
                <Stack isCompact>
                  <Row shouldSpaceBetween>
                    <Text variant="caption" tone="muted">
                      {formatValue({ value: progress.completed, locale, format: { maximumFractionDigits: 0 } })} /{' '}
                      {formatValue({ value: progress.total, locale, format: { maximumFractionDigits: 0 } })}{' '}
                      {progress.unit}
                    </Text>
                    <Badge tone="neutral">
                      {formatValue({
                        value: pct / 100,
                        locale,
                        format: { style: 'percent', maximumFractionDigits: 0 },
                      })}
                    </Badge>
                  </Row>
                  <Progress
                    label={report.title}
                    value={progress.completed}
                    max={progress.total}
                    valueLabel={formatValue({
                      value: pct / 100,
                      locale,
                      format: { style: 'percent', maximumFractionDigits: 0 },
                    })}
                  />
                </Stack>
              )}
              <Row shouldSpaceBetween>
                {report.nextCheckpoint !== undefined && (
                  <Text variant="caption" tone="muted">
                    {labels.nextCheckpoint}: {report.nextCheckpoint}
                  </Text>
                )}
                {report.executionRef !== undefined && <Identifier>{report.executionRef}</Identifier>}
              </Row>
            </Stack>
          </Panel>
        );
      })}
    </Stack>
  );
}
