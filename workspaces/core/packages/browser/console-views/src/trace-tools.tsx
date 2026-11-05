import { CopyValue } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Trace as ExecutionTrace } from '@mechane-ai/elements/content';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { Trace, TurnToolCall } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';

const toolStatuses = { running: 'running', completed: 'complete', failed: 'failed', unknown: 'unknown' } as const;

export function TraceTools({ trace }: { readonly trace: Trace }): ReactNode {
  if (trace.toolCalls === undefined) {
    return <EmptyState title="Tool evidence unavailable" />;
  }

  if (trace.toolCalls.length === 0) {
    return <EmptyState title="No tool steps recorded" />;
  }

  return (
    <ExecutionTrace.Root label="Recorded tool steps">
      {trace.toolCalls.map((call) => (
        <ExecutionTrace.Item
          key={call.id}
          id={call.id}
          label={call.name}
          description={toolTiming(call)}
          status={toolStatuses[call.status]}
          statusLabel={call.status}
          detail={
            <Details
              items={[
                {
                  label: 'Started',
                  value: Option.isSome(call.startedAt) ? (
                    <ConsoleTimestamp value={call.startedAt.value} />
                  ) : (
                    'Not recorded'
                  ),
                },
                {
                  label: 'Finished',
                  value: Option.isSome(call.endedAt) ? (
                    <ConsoleTimestamp value={call.endedAt.value} />
                  ) : (
                    'No committed result'
                  ),
                },
                { label: 'Call ID', value: <CopyValue label="tool call ID" value={call.id} /> },
              ]}
            />
          }
        />
      ))}
    </ExecutionTrace.Root>
  );
}

function toolTiming(call: TurnToolCall): string {
  if (Option.isNone(call.endedAt)) {
    return 'No committed result';
  }

  if (Option.isNone(call.startedAt)) {
    return 'Duration not recorded';
  }

  const elapsed = DateTime.toEpochMillis(call.endedAt.value) - DateTime.toEpochMillis(call.startedAt.value);

  return `${durationLabel(elapsed)} recorded`;
}
