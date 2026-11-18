import { Collapsible, CopyValue, Row, Stack, Status, Subheading, Text } from '@mechane-ai/elements';
import { Waterfall } from '@mechane-ai/elements/charts/timeline';
import type { WaterfallItem } from '@mechane-ai/elements/charts/timeline';
import { Details } from '@mechane-ai/elements/collections';
import { Notice, SkeletonText } from '@mechane-ai/elements/feedback';
import type {
  NativeSnapshotReport,
  SandboxReport,
  StartupFailure,
  StartupPhase,
  StartupProgress,
} from '@mechane/protocol';
import { DateTime, Duration, Option } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';

const PHASE_LABELS: Readonly<Record<StartupPhase, string>> = {
  container: 'Starting computer',
  bootstrap: 'Preparing tools',
  download: 'Downloading tool',
  verify: 'Verifying files',
  extract: 'Extracting files',
  check_tool: 'Checking tool',
  guest_ready: 'Tools ready',
  transfer: 'Restoring saved files',
  restore: 'Activating saved files',
  ready: 'Ready',
};

const FAILURE_LABELS: Readonly<Record<StartupFailure, string>> = {
  tool_preparation_failed: 'A managed tool could not be prepared.',
  provider_start_failed: 'The computer could not be started.',
  startup_deadline_exceeded: 'Computer preparation exceeded its deadline.',
  workspace_restore_failed: 'Saved files could not be restored.',
  guest_exited_during_startup: 'The guest exited before preparation finished.',
};

const LIVE_STATUSES: ReadonlySet<string> = new Set(['starting', 'ready']);
const COMPLETE_PHASES: ReadonlySet<StartupPhase> = new Set(['ready', 'guest_ready']);

const SNAPSHOT_SELECTION_LABELS: Readonly<Record<NativeSnapshotReport['selection'], string>> = {
  unavailable: 'Not available on this provider',
  no_checkpoint: 'No committed checkpoint',
  missing: 'No cached snapshot',
  expired: 'Cached snapshot expired',
  incompatible: 'Checkpoint or runtime configuration changed',
  selected: 'Cached snapshot selected',
  start_rejected: 'Snapshot start rejected',
  guest_exited: 'Snapshot guest exited',
};

type SnapshotCapture = Option.Option.Value<NativeSnapshotReport['capture']>;

const SNAPSHOT_CAPTURE_LABELS: Readonly<Record<SnapshotCapture['status'], string>> = {
  capturing: 'Capture started; completion not observed',
  saved: 'Saved',
  failed: 'Capture failed',
  timed_out: 'Capture exceeded its time limit',
  uncommitted_checkpoint: 'Skipped: checkpoint was not committed by this machine',
  machine_changed: 'Skipped: machine changed or stopped',
  configuration_changed: 'Skipped: runtime configuration changed',
};

export function EnvironmentStartupPlaceholder(): ReactNode {
  return (
    <Stack isCompact>
      <Row>
        <Subheading>Computer</Subheading>
        <SkeletonText width="16ch" />
      </Row>
      <SkeletonText width="36ch" />
    </Stack>
  );
}

export function EnvironmentStartup({ report }: { readonly report: SandboxReport }): ReactNode {
  const startup = Option.getOrUndefined(report.environment.startup);
  const [selected, setSelected] = useState<string>();

  if (startup === undefined) {
    return (
      <Stack isCompact>
        <Row>
          <Subheading>Computer</Subheading>
          <Status tone="neutral">Not started</Status>
        </Row>
        <Text variant="caption" tone="muted">
          Starts when a tool needs a computer.
        </Text>
      </Stack>
    );
  }

  const progress = startup.progress;
  const failure = Option.getOrUndefined(progress.failure);
  const guest = Option.getOrUndefined(startup.guest);
  const restoration = Option.getOrUndefined(startup.restoration);
  const nativeSnapshot = Option.getOrUndefined(startup.nativeSnapshot);
  const lastFailure = Option.getOrUndefined(report.environment.lastStartupFailure);
  const isSleeping = report.status === 'sleeping';
  const isLive = LIVE_STATUSES.has(report.status);
  const isReady = progress.phase === 'ready';
  const hasFailure = failure !== undefined;

  const label = hasFailure
    ? 'Preparation failed'
    : isSleeping
      ? 'Sleeping'
      : isLive
        ? PHASE_LABELS[progress.phase]
        : report.status === 'recovery_required'
          ? 'File recovery required'
          : 'Stopped';

  const guestProgress =
    progress.phase === 'bootstrap'
      ? guest?.bootstrap
      : guest === undefined
        ? undefined
        : Option.getOrUndefined(guest.restoration);

  const guestStep = guestProgress?.steps.at(-1);
  const tool = guestStep === undefined ? undefined : Option.getOrUndefined(guestStep.tool);
  const execution = Option.getOrUndefined(report.environment.execution);
  const isPreparing = isLive && !isReady;
  const hasProgress = isPreparing && failure === undefined;
  const isCopyingArchive = restoration?.source === 'archive' && !isReady;

  return (
    <Stack isCompact>
      <Row>
        <Subheading>Computer</Subheading>
        <Status tone={failure === undefined ? (isReady && isLive ? 'positive' : 'neutral') : 'negative'}>
          {label}
        </Status>
      </Row>
      {hasProgress && (
        <Text variant="caption" tone="muted">
          {guestProgress === undefined ? PHASE_LABELS[progress.phase] : PHASE_LABELS[guestProgress.phase]}
          {tool !== undefined && ` ${tool}`}
          {' · '}Last progress: <ConsoleTimestamp value={progress.updatedAt} /> UTC.
        </Text>
      )}
      {restoration !== undefined && isCopyingArchive && (
        <Text variant="caption" tone="muted">
          {restoration.copiedParts} of {restoration.parts} parts copied · {restoration.bytes.toLocaleString('en-US')}{' '}
          archive bytes.
        </Text>
      )}
      {failure !== undefined && (
        <Notice hasError>{FAILURE_LABELS[failure]} Inspect the original command receipt before retrying work.</Notice>
      )}
      {lastFailure !== undefined && failure === undefined && (
        <Text variant="caption" tone="muted">
          Previous preparation: {FAILURE_LABELS[lastFailure.code]} <ConsoleTimestamp value={lastFailure.at} /> UTC.
        </Text>
      )}
      <Collapsible.Root>
        <Collapsible.Trigger>Startup details</Collapsible.Trigger>
        <Collapsible.Panel>
          <Stack isCompact>
            <Details
              items={[
                { label: 'Machine', value: <CopyValue label="machine" value={startup.machineId} /> },
                { label: 'Started (UTC)', value: <ConsoleTimestamp value={progress.startedAt} /> },
                { label: 'Overall startup deadline (UTC)', value: <ConsoleTimestamp value={startup.deadlineAt} /> },
                { label: 'Recorded phase', value: PHASE_LABELS[progress.phase] },
                {
                  label: 'Workspace restore',
                  value:
                    restoration === undefined
                      ? 'Not observed'
                      : restoration.source === 'native'
                        ? 'Native snapshot'
                        : 'Portable archive',
                },
              ]}
            />
            {nativeSnapshot !== undefined && <NativeSnapshotDetails snapshot={nativeSnapshot} />}
            <Text variant="caption" tone="muted">
              Each timeline shows recorded observations from one process.
            </Text>
            <StartupWaterfall
              progress={progress}
              label="Environment startup"
              selected={selected}
              onSelect={setSelected}
            />
            {guest !== undefined && (
              <>
                <StartupWaterfall
                  progress={guest.bootstrap}
                  label="Guest tool preparation"
                  selected={selected}
                  onSelect={setSelected}
                />
                {Option.isSome(guest.restoration) && (
                  <StartupWaterfall
                    progress={guest.restoration.value}
                    label="Guest file restoration"
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
              </>
            )}
            {execution !== undefined && (
              <Details
                items={[
                  { label: 'Latest command', value: <CopyValue label="execution" value={execution.executionId} /> },
                  { label: 'Claimed (UTC)', value: <ConsoleTimestamp value={execution.claimedAt} /> },
                  {
                    label: 'Claim to dispatch',
                    value: Option.match(execution.dispatchedAt, {
                      onNone: () => 'Not dispatched',
                      onSome: (at) =>
                        durationLabel(
                          Math.max(0, DateTime.toEpochMillis(at) - DateTime.toEpochMillis(execution.claimedAt)),
                        ),
                    }),
                  },
                  {
                    label: 'Dispatched (UTC)',
                    value: Option.isSome(execution.dispatchedAt) ? (
                      <ConsoleTimestamp value={execution.dispatchedAt.value} />
                    ) : (
                      'Not dispatched'
                    ),
                  },
                  {
                    label: 'Receipt stored (UTC)',
                    value: Option.isSome(execution.settledAt) ? (
                      <ConsoleTimestamp value={execution.settledAt.value} />
                    ) : (
                      'No terminal receipt'
                    ),
                  },
                  {
                    label: 'Command execution',
                    value: Option.isSome(execution.duration)
                      ? durationLabel(Duration.toMillis(execution.duration.value))
                      : 'Not recorded',
                  },
                ]}
              />
            )}
          </Stack>
        </Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  );
}

type StartupWaterfallProps = {
  readonly progress: StartupProgress;
  readonly label: string;
  readonly selected: string | undefined;
  readonly onSelect: (id: string) => void;
};

function NativeSnapshotDetails({ snapshot }: { readonly snapshot: NativeSnapshotReport }): ReactNode {
  const capture = Option.getOrUndefined(snapshot.capture);

  return (
    <Stack isCompact>
      <Details items={[{ label: 'Native cache selection', value: SNAPSHOT_SELECTION_LABELS[snapshot.selection] }]} />
      {capture !== undefined && (
        <>
          <Details
            items={[
              { label: 'Last native capture', value: SNAPSHOT_CAPTURE_LABELS[capture.status] },
              { label: 'Capture machine', value: <CopyValue label="capture machine" value={capture.machineId} /> },
              {
                label: 'Capture generation',
                value: <CopyValue label="capture generation" value={capture.generation} />,
              },
              { label: 'Capture observed (UTC)', value: <ConsoleTimestamp value={capture.at} /> },
              {
                label: 'Capture duration',
                value: Option.match(capture.duration, {
                  onNone: () => 'Not recorded',
                  onSome: (value) => durationLabel(Duration.toMillis(value)),
                }),
              },
              {
                label: 'Native snapshot bytes',
                value: Option.match(capture.bytes, {
                  onNone: () => 'Not recorded',
                  onSome: (value) => value.toLocaleString('en-US'),
                }),
              },
            ]}
          />
          <Text variant="caption" tone="muted">
            Native snapshots accelerate startup. Saved-file durability comes from the committed portable checkpoint.
          </Text>
        </>
      )}
    </Stack>
  );
}

function StartupWaterfall({ progress, label, selected, onSelect }: StartupWaterfallProps): ReactNode {
  const start = DateTime.toEpochMillis(progress.startedAt);
  const end = Math.max(start, DateTime.toEpochMillis(progress.updatedAt));

  const items: ReadonlyArray<WaterfallItem> = progress.steps.map((step, index, steps) => {
    const at = DateTime.toEpochMillis(step.startedAt);
    const next = steps[index + 1];

    const base = {
      id: `${label}:${index}`,
      label: PHASE_LABELS[step.phase],
      detail: Option.getOrElse(step.tool, () => label),
      tone: 'neutral' as const,
      summary: Option.isSome(step.duration)
        ? `${durationLabel(Duration.toMillis(step.duration.value))} measured work`
        : 'Duration not recorded',
    };

    if (next === undefined) {
      if (Option.isSome(progress.failure)) {
        return { ...base, tone: 'negative', geometry: { kind: 'interval', start: at, end: Math.max(at, end) } };
      }

      const isComplete = COMPLETE_PHASES.has(step.phase);

      return {
        ...base,
        tone: isComplete ? 'positive' : 'neutral',
        geometry: { kind: 'point', at, marker: isComplete ? 'filled' : 'hollow' },
        summary: isComplete ? PHASE_LABELS[step.phase] : 'In progress at last observation',
      };
    }

    return {
      ...base,
      geometry: { kind: 'interval', start: at, end: Math.max(at, DateTime.toEpochMillis(next.startedAt)) },
    };
  });

  return (
    <Waterfall
      items={items}
      start={start}
      end={end}
      label={label}
      rowLabel="Phase"
      summaryLabel="Observation"
      emptyLabel="No phases recorded"
      selectedId={selected}
      onSelect={onSelect}
      formatOffset={durationLabel}
    />
  );
}
