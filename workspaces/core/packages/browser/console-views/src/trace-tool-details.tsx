import { CopyValue, Stack } from '@mechane-ai/elements';
import { CommandDetails } from '@mechane-ai/elements/ai';
import { Details } from '@mechane-ai/elements/collections';
import type { TurnToolCall } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { preciseTimeLabel } from './format.ts';

type BashInspection = NonNullable<TurnToolCall['inspection']>;

export function TraceToolDetails({
  call,
  isImported,
}: {
  readonly call: TurnToolCall;
  readonly isImported: boolean;
}): ReactNode {
  return (
    <Stack isCompact>
      {call.inspection !== undefined && <BashDetails inspection={call.inspection} isImported={isImported} />}
      <Details
        items={[
          { label: 'Tool call', value: call.status },
          {
            label: 'Tool started',
            value: Option.isSome(call.startedAt) ? (
              <CopyValue label="tool start time in UTC" value={preciseTimeLabel(call.startedAt.value)} />
            ) : (
              'Not recorded'
            ),
          },
          {
            label: 'Result recorded',
            value: Option.isSome(call.endedAt) ? (
              <CopyValue label="tool result time in UTC" value={preciseTimeLabel(call.endedAt.value)} />
            ) : (
              'Not recorded'
            ),
          },
          { label: 'Call ID', value: <CopyValue label="tool call ID" value={call.id} /> },
        ]}
      />
    </Stack>
  );
}

function BashDetails({
  inspection,
  isImported,
}: {
  readonly inspection: BashInspection;
  readonly isImported: boolean;
}): ReactNode {
  const command = Option.getOrUndefined(inspection.command);
  const result = Option.getOrUndefined(inspection.result);
  const output = result === undefined ? undefined : Option.getOrUndefined(result.output);

  return (
    <CommandDetails
      command={command?.text}
      output={output?.text}
      isRunning={!isImported && result?.status === 'running'}
      commandNotice={
        command !== undefined && command.omittedBytes > 0
          ? `${command.omittedBytes.toLocaleString('en-US')} command bytes omitted from this preview.`
          : undefined
      }
      outputNotice={
        output !== undefined && output.omittedBytes > 0
          ? `${output.omittedBytes.toLocaleString('en-US')} output bytes omitted from this preview.`
          : undefined
      }
    />
  );
}
