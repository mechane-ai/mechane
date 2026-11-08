import { Trace as ExecutionTrace } from '@mechane-ai/elements/content';
import type { TraceStatus } from '@mechane-ai/elements/content';
import { EmptyState } from '@mechane-ai/elements/feedback';
import type { Trace, TurnToolCall } from '@mechane/protocol';
import { DateTime, Duration, Option } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { TraceToolDetails } from './trace-tool-details.tsx';

const toolStatuses = { running: 'running', completed: 'complete', failed: 'failed', unknown: 'unknown' } as const;
const COMMAND_PREVIEW_CHARACTERS = 160;

type ToolOutcome = { readonly status: TraceStatus; readonly label: string };

export function TraceTools({ trace }: { readonly trace: Trace }): ReactNode {
  if (trace.toolCalls === undefined) {
    return <EmptyState title="Tool evidence unavailable" />;
  }

  if (trace.toolCalls.length === 0) {
    return <EmptyState title="No tool steps recorded" />;
  }

  return (
    <ExecutionTrace.Root label="Recorded tool steps">
      {trace.toolCalls.map((call) => {
        const outcome = toolOutcome(call);
        const timing = toolTiming(call);
        const preview = commandPreview(call);

        return (
          <ExecutionTrace.Item
            key={call.id}
            id={call.id}
            label={call.name}
            {...(preview === undefined ? {} : { description: preview })}
            status={outcome.status}
            statusLabel={timing === undefined ? outcome.label : `${outcome.label} · ${timing}`}
            detail={<TraceToolDetails call={call} />}
          />
        );
      })}
    </ExecutionTrace.Root>
  );
}

function toolOutcome(call: TurnToolCall): ToolOutcome {
  const inspection = call.inspection;

  if (inspection === undefined) {
    return { status: toolStatuses[call.status], label: `Tool ${call.status}` };
  }

  if (Option.isNone(inspection.result)) {
    if (call.status === 'completed') {
      return { status: 'unknown', label: 'Command outcome unavailable' };
    }

    return { status: toolStatuses[call.status], label: `Tool ${call.status}` };
  }

  const result = inspection.result.value;

  switch (result.status) {
    case 'completed':
      if (Option.isNone(result.exitCode)) {
        return { status: 'unknown', label: 'Command finished · Exit code unavailable' };
      }

      return { status: result.exitCode.value === 0 ? 'complete' : 'failed', label: `Exited ${result.exitCode.value}` };
    case 'running':
      return { status: 'running', label: 'Command running' };
    case 'timed_out':
      return { status: 'failed', label: 'Command timed out' };
    case 'uncertain':
      return { status: 'unknown', label: 'Command outcome uncertain' };
    case 'unavailable':
      return { status: 'unknown', label: 'Execution unavailable' };
    case 'persistence_failed':
      return { status: 'failed', label: 'Result could not be saved' };
    case 'refused':
      return { status: 'failed', label: 'Command refused' };
  }
}

function commandPreview(call: TurnToolCall): string | undefined {
  const inspection = call.inspection;

  if (inspection === undefined) {
    return undefined;
  }

  if (Option.isNone(inspection.command)) {
    return 'Command unavailable';
  }

  const command = inspection.command.value;
  const source = command.text.trim();

  if (source.length === 0 && command.omittedBytes > 0) {
    return 'Command omitted from this trace preview';
  }

  const firstLine = source.split(/\r\n|\n|\r/u)[0] ?? '';
  const preview = firstLine.slice(0, COMMAND_PREVIEW_CHARACTERS);
  const isTruncated = preview.length < source.length || command.omittedBytes > 0;

  return isTruncated ? `${preview}…` : preview;
}

function toolTiming(call: TurnToolCall): string | undefined {
  const result = call.inspection === undefined ? undefined : Option.getOrUndefined(call.inspection.result);

  if (result !== undefined && Option.isSome(result.duration)) {
    return `${durationLabel(Duration.toMillis(result.duration.value))} command duration`;
  }

  if (Option.isNone(call.endedAt) || Option.isNone(call.startedAt)) {
    return undefined;
  }

  const elapsed = DateTime.toEpochMillis(call.endedAt.value) - DateTime.toEpochMillis(call.startedAt.value);

  return `${durationLabel(elapsed)} tool duration`;
}
