import { Stack } from '@mechane-ai/elements';
import { problemMessage } from '@mechane/console-data';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import {
  EnvironmentDurability,
  EnvironmentPlaceholder,
  EnvironmentProcesses,
  EnvironmentProcessOutput,
  EnvironmentProcessOutputPlaceholder,
  EnvironmentStartup,
} from '@mechane/console-views';
import type { ProcessSummaries, ProcessSummary } from '@mechane/protocol';
import type { DateTime, Option } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useEnvironment, useEnvironmentProcess } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

export function EnvironmentScreen({
  data,
  request,
  isActive,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'environment'>;
  readonly isActive: boolean;
}): ReactNode {
  const state = useEnvironment(data, request, isActive);

  return (
    <ResourceView state={state} placeholder={<EnvironmentPlaceholder />} label="Loading environment">
      {(environment, notice) => (
        <Stack>
          {notice}
          <EnvironmentStartup report={environment} />
          <EnvironmentDurability report={environment} />
          <ProcessControls
            observedAt={environment.environment.processesObservedAt}
            data={data}
            request={request}
            processes={environment.environment.processes}
            isActive={isActive}
          />
        </Stack>
      )}
    </ResourceView>
  );
}

function ProcessControls({
  data,
  request,
  processes,
  observedAt,
  isActive,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'environment'>;
  readonly observedAt: Option.Option<DateTime.Utc>;
  readonly processes: Option.Option<ProcessSummaries>;
  readonly isActive: boolean;
}): ReactNode {
  const [stopping, setStopping] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<string>();
  const isMounted = useScreenLifetime();

  function stop(process: ProcessSummary): void {
    const { machineId, processId } = process.handle;
    const key = `${machineId}:${processId}`;

    if (stopping.has(key)) {
      return;
    }

    setStopping((current) => new Set([...current, key]));
    setFailure(undefined);

    function finish(): void {
      if (isMounted()) {
        setStopping((current) => new Set([...current].filter((value) => value !== key)));
      }
    }

    void data.commands.stopEnvironmentProcess({ mechId: request.mechId, machineId, processId }).then(
      () => finish(),
      (cause: unknown) => {
        if (isMounted()) {
          setFailure(problemMessage(cause));
        }

        finish();
      },
    );
  }

  return (
    <EnvironmentProcesses
      observedAt={observedAt}
      processes={processes}
      stopping={stopping}
      failure={failure}
      onStop={stop}
      renderDetails={(process, isExpanded) => (
        <ProcessDetails
          data={data}
          request={data.reads.environmentProcess(request.mechId, process.handle)}
          isActive={isActive && isExpanded}
        />
      )}
    />
  );
}

function ProcessDetails({
  data,
  request,
  isActive,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'environmentProcess'>;
  readonly isActive: boolean;
}): ReactNode {
  const state = useEnvironmentProcess(data, request, isActive);

  return (
    <ResourceView state={state} placeholder={<EnvironmentProcessOutputPlaceholder />} label="Loading process output">
      {(process, notice) => (
        <>
          {notice}
          <EnvironmentProcessOutput process={process} />
        </>
      )}
    </ResourceView>
  );
}
