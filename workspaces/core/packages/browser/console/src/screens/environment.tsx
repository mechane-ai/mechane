import { problemMessage } from '@mechane/console-data';
import type { ConsoleData, ReadRequest } from '@mechane/console-data';
import {
  EnvironmentPlaceholder,
  EnvironmentProcesses,
  EnvironmentProcessOutput,
  EnvironmentProcessOutputPlaceholder,
} from '@mechane/console-views';
import type { ProcessSummaries, ProcessSummary } from '@mechane/protocol';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useEnvironmentProcess, useEnvironmentProcesses } from '../reads.ts';
import { ResourceView } from '../resource.tsx';
import { useScreenLifetime } from '../use-screen-lifetime.ts';

export function EnvironmentScreen({
  data,
  request,
  isActive,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'environmentProcesses'>;
  readonly isActive: boolean;
}): ReactNode {
  const state = useEnvironmentProcesses(data, request, isActive);

  return (
    <ResourceView state={state} placeholder={<EnvironmentPlaceholder />} label="Loading environment">
      {(processes, notice) => (
        <>
          {notice}
          <ProcessControls data={data} request={request} processes={processes} isActive={isActive} />
        </>
      )}
    </ResourceView>
  );
}

function ProcessControls({
  data,
  request,
  processes,
  isActive,
}: {
  readonly data: ConsoleData;
  readonly request: ReadRequest<'environmentProcesses'>;
  readonly processes: ProcessSummaries;
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
