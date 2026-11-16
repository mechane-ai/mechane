import { Collapsible, CopyValue, Row, Stack, Status, Subheading, Text } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Notice, SkeletonText } from '@mechane-ai/elements/feedback';
import type { SandboxReport } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';

type SandboxStop = Option.Option.Value<SandboxReport['environment']['stop']>;

const STOP_LABELS: Readonly<Record<SandboxStop['phase'], string>> = {
  requested: 'Shutdown requested',
  waiting_for_commands: 'Waiting for the running command',
  checkpointing: 'Saving workspace before shutdown',
  canceling: 'Releasing the saved workspace',
  canceled: 'Idle shutdown canceled for new work',
  stopping: 'Stopping computer',
  completed: 'Computer stopped',
  failed: 'Computer shutdown failed',
};

const STOP_ORIGIN_LABELS: Readonly<Record<NonNullable<SandboxStop['origin']>, string>> = {
  idle: 'Idle timeout',
  explicit: 'Explicit request',
};

export function EnvironmentDurabilityPlaceholder(): ReactNode {
  return (
    <Stack isCompact>
      <Row>
        <Subheading>Saved files</Subheading>
        <SkeletonText width="14ch" />
      </Row>
      <SkeletonText width="28ch" />
      <SkeletonText />
      <SkeletonText width="14ch" />
    </Stack>
  );
}

export function EnvironmentDurability({ report }: { readonly report: SandboxReport }): ReactNode {
  const { environment } = report;
  const { durability } = environment;
  const generation = Option.getOrUndefined(environment.committedGeneration);
  const checkpoint = Option.getOrUndefined(environment.checkpoint);
  const recovery = Option.getOrUndefined(environment.recovery);
  const capturedAt = Option.getOrUndefined(durability?.capturedAt ?? Option.none());
  const capturedSequence = Option.getOrUndefined(durability?.capturedSequence ?? Option.none());
  const nextCheckpointAt = Option.getOrUndefined(durability?.nextCheckpointAt ?? Option.none());
  const lastError = Option.getOrUndefined(durability?.lastError ?? Option.none());

  const stop = Option.getOrUndefined(
    Option.filter(
      environment.stop,
      (receipt) =>
        Option.isNone(environment.startup) ||
        Option.exists(environment.startup, (startup) => Option.contains(receipt.machineId, startup.machineId)),
    ),
  );

  return (
    <Stack isCompact>
      <Row>
        <Subheading>Saved files</Subheading>
        <Status tone={recovery !== undefined || lastError !== undefined ? 'negative' : 'neutral'}>
          {recovery === undefined
            ? checkpoint === undefined
              ? generation === undefined
                ? 'No saved checkpoint'
                : 'Saved checkpoint'
              : 'Saving files'
            : 'Recovery required'}
        </Status>
      </Row>
      <Text variant="caption" tone="muted">
        {generation === undefined ? (
          'No files saved yet.'
        ) : capturedAt === undefined ? (
          'Last saved time not recorded.'
        ) : (
          <>
            Last saved: <ConsoleTimestamp value={capturedAt} /> UTC.
          </>
        )}
      </Text>
      {checkpoint !== undefined && (
        <Text variant="caption" tone="muted" role="status">
          {Option.isSome(checkpoint.totalParts)
            ? `${checkpoint.uploadedParts.toLocaleString('en-US')} of ${checkpoint.totalParts.value.toLocaleString('en-US')} parts uploaded.`
            : 'Preparing files to save.'}
        </Text>
      )}
      {lastError !== undefined && <Notice hasError>Last save error: {lastError}</Notice>}
      {recovery !== undefined && <Notice hasError>{recovery.reason}</Notice>}
      {stop !== undefined && <StopStatus stop={stop} />}
      <Text variant="caption" tone="muted">
        Commands may finish before saving. Background writes may be newer.
      </Text>
      <Collapsible.Root>
        <Collapsible.Trigger>Technical details</Collapsible.Trigger>
        <Collapsible.Panel>
          <Details
            items={[
              {
                label: 'Saved checkpoint',
                value:
                  generation === undefined ? (
                    'Not saved yet'
                  ) : (
                    <CopyValue label="saved checkpoint" value={generation} />
                  ),
              },
              {
                label: 'Captured activity',
                value: capturedSequence === undefined ? 'Not recorded' : capturedSequence.toLocaleString('en-US'),
              },
              {
                label: 'Latest recorded activity',
                value: durability === undefined ? 'Not reported' : durability.activitySequence.toLocaleString('en-US'),
              },
              {
                label: 'Next scheduled save (UTC)',
                value:
                  durability === undefined ? (
                    'Not reported'
                  ) : nextCheckpointAt === undefined ? (
                    'Not scheduled'
                  ) : (
                    <ConsoleTimestamp value={nextCheckpointAt} />
                  ),
              },
              ...(checkpoint === undefined
                ? []
                : [
                    {
                      label: checkpoint.isAutomatic === true ? 'Automatic save started (UTC)' : 'Save started (UTC)',
                      value: <ConsoleTimestamp value={checkpoint.startedAt} />,
                    },
                  ]),
              ...(recovery === undefined
                ? []
                : [
                    {
                      label: 'Recovery checkpoint',
                      value: <CopyValue label="recovery checkpoint" value={recovery.generation} />,
                    },
                  ]),
            ]}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  );
}

function StopStatus({ stop }: { readonly stop: SandboxStop }): ReactNode {
  const elapsed = Option.map(stop.requestedAt, (at) =>
    durationLabel(Math.max(0, DateTime.toEpochMillis(stop.updatedAt) - DateTime.toEpochMillis(at))),
  );

  const origin = stop.origin === undefined ? 'Origin not recorded' : STOP_ORIGIN_LABELS[stop.origin];

  return (
    <Stack isCompact>
      <Text variant="caption" tone="muted" role="status">
        {STOP_LABELS[stop.phase]}
        {' · '}
        {origin}
        {Option.isSome(elapsed) && ` · ${elapsed.value} recorded`}
      </Text>
      <CopyValue label="stop operation" value={stop.operationId} />
    </Stack>
  );
}
