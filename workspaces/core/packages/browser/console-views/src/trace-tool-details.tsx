import { CopyValue, Stack, Text } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { LogViewer } from '@mechane-ai/elements/content';
import { CodeBlock } from '@mechane-ai/elements/content/code';
import type { TurnToolCall } from '@mechane/protocol';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { preciseTimeLabel } from './format.ts';

type BashInspection = NonNullable<TurnToolCall['inspection']>;

const COMMAND_VIEW_HEIGHT = 240;
const OUTPUT_VIEW_HEIGHT = 320;
const OUTPUT_VIEW_LINES = 200;

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
    <>
      {command === undefined ? (
        <Text tone="muted">Command unavailable for this run.</Text>
      ) : (
        <Stack isCompact>
          {command.text.length === 0 && command.omittedBytes > 0 ? (
            <Text tone="muted">Command omitted from this trace preview.</Text>
          ) : (
            <CodeBlock
              code={command.text}
              language="bash"
              filename="Command"
              shouldWrap
              showLineNumbers={false}
              maxHeight={COMMAND_VIEW_HEIGHT}
            />
          )}
          {command.omittedBytes > 0 && (
            <Text variant="caption" tone="muted">
              {command.omittedBytes.toLocaleString('en-US')} command bytes omitted from this preview.
            </Text>
          )}
        </Stack>
      )}
      {output === undefined ? (
        <Text tone="muted">Output unavailable.</Text>
      ) : (
        <Stack isCompact>
          {output.text.length > 0 ? (
            <LogViewer
              output={output.text}
              label="Combined output"
              maxLines={OUTPUT_VIEW_LINES}
              maxHeight={OUTPUT_VIEW_HEIGHT}
              isRunning={!isImported && result?.status === 'running'}
            />
          ) : (
            <Text tone="muted">
              {output.omittedBytes > 0 ? 'Output omitted from this trace preview.' : 'No output.'}
            </Text>
          )}
          {output.omittedBytes > 0 && (
            <Text variant="caption" tone="muted">
              {output.omittedBytes.toLocaleString('en-US')} output bytes omitted from this preview.
            </Text>
          )}
        </Stack>
      )}
    </>
  );
}
