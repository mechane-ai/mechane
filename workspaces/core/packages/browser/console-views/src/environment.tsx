import { Accordion, Button, Row, Stack, Status, Subheading, Text } from '@mechane-ai/elements';
import { LogViewer } from '@mechane-ai/elements/content';
import { EmptyState, Notice, Skeleton, SkeletonText } from '@mechane-ai/elements/feedback';
import type { ProcessHandle, ProcessObservation, ProcessSummaries, ProcessSummary } from '@mechane/protocol';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { EnvironmentDurabilityPlaceholder } from './environment-durability.tsx';
import { EnvironmentStartupPlaceholder } from './environment-startup.tsx';
import { ConsoleTimestamp } from './record-time.tsx';

function processKey(handle: ProcessHandle): string {
  return `${handle.machineId}:${handle.processId}`;
}

function processLabel(process: ProcessSummary): string {
  switch (process.state._tag) {
    case 'Running':
      return 'Running';
    case 'Stopped':
      return 'Stopped';
    case 'Lost':
      return 'Machine stopped';
    case 'Exited':
      return process.state.exitCode === 0 ? 'Finished' : `Exited ${process.state.exitCode}`;
  }
}

type ProcessActions = {
  readonly onStop: (process: ProcessSummary) => void;
  readonly renderDetails: (process: ProcessSummary, isExpanded: boolean) => ReactNode;
};

function ProcessRow({
  process,
  isStopping,
  isExpanded,
  onStop,
  renderDetails,
}: ProcessActions & {
  readonly process: ProcessSummary;
  readonly isStopping: boolean;
  readonly isExpanded: boolean;
}): ReactNode {
  const disclosure = useRef<HTMLButtonElement>(null);
  const isRunning = process.state._tag === 'Running';

  function stop(): void {
    disclosure.current?.focus({ preventScroll: true });
    onStop(process);
  }

  return (
    <Accordion.Item value={processKey(process.handle)}>
      <Accordion.Header>
        <Accordion.Trigger ref={disclosure}>
          <Row>
            <Text>{process.handle.processId}</Text>
            <Status tone={isRunning ? 'positive' : 'neutral'}>{processLabel(process)}</Status>
          </Row>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>
        <Stack isCompact>
          {isRunning && (
            <Row>
              <Button onClick={stop} isPending={isStopping} pendingLabel="Stopping…" disabled={isStopping}>
                Stop process
              </Button>
            </Row>
          )}
          {renderDetails(process, isExpanded)}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function EnvironmentPlaceholder(): ReactNode {
  return (
    <Stack>
      <EnvironmentStartupPlaceholder />
      <EnvironmentDurabilityPlaceholder />
      <Subheading>Processes</Subheading>
      <SkeletonText width="32ch" />
      <Accordion.Root>
        {[0, 1].map((item) => (
          <Accordion.Item key={item} value={item}>
            <Accordion.Header>
              <Accordion.Trigger disabled>
                <SkeletonText width="24ch" />
              </Accordion.Trigger>
            </Accordion.Header>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </Stack>
  );
}

export function EnvironmentProcesses({
  processes,
  observedAt = Option.none(),
  stopping,
  failure,
  onStop,
  renderDetails,
}: ProcessActions & {
  readonly observedAt?: Option.Option<DateTime.Utc>;
  readonly processes: Option.Option<ProcessSummaries>;
  readonly stopping: ReadonlySet<string>;
  readonly failure: string | undefined;
}): ReactNode {
  const [expanded, setExpanded] = useState<Array<string>>([]);

  return (
    <Stack>
      <Subheading>Processes</Subheading>
      <Text variant="caption" tone="muted">
        {Option.isSome(observedAt) ? (
          <>
            Recorded <ConsoleTimestamp value={observedAt.value} /> UTC. Expand a process to refresh its output.
          </>
        ) : (
          'No process observation recorded yet.'
        )}
      </Text>
      {failure !== undefined && <Notice hasError>{failure}</Notice>}
      {Option.isNone(processes) ? (
        <Notice hasError>Process status is unavailable. Computer and saved-file status are still shown.</Notice>
      ) : processes.value.length === 0 ? (
        <EmptyState title="No recorded processes">
          Development servers and other processes started by this mech appear here.
        </EmptyState>
      ) : (
        <Stack isCompact>
          <Text variant="caption" tone="muted">
            Active and recently finished processes.
          </Text>
          <Accordion.Root value={expanded} onValueChange={setExpanded}>
            {processes.value.map((process) => {
              const key = processKey(process.handle);

              return (
                <ProcessRow
                  key={key}
                  process={process}
                  isStopping={stopping.has(key)}
                  isExpanded={expanded.includes(key)}
                  onStop={onStop}
                  renderDetails={renderDetails}
                />
              );
            })}
          </Accordion.Root>
        </Stack>
      )}
    </Stack>
  );
}

export function EnvironmentProcessOutputPlaceholder(): ReactNode {
  return <Skeleton height="6rem" />;
}

export function EnvironmentProcessOutput({ process }: { readonly process: ProcessObservation }): ReactNode {
  return (
    <Stack isCompact>
      {process.state._tag === 'Lost' && (
        <Text tone="muted">This machine is no longer available. The process was not restarted.</Text>
      )}
      <LogViewer output={process.output.text} label="Process output" isRunning={process.state._tag === 'Running'} />
      {process.output.omittedBytes > 0 && (
        <Text variant="caption" tone="muted">
          {process.output.omittedBytes.toLocaleString('en-US')} earlier output bytes omitted.
        </Text>
      )}
    </Stack>
  );
}
