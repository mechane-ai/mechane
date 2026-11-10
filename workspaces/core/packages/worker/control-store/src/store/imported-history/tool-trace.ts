import {
  BashExecutionStatus,
  TOOL_TRACE_COMMAND_MAX_BYTES,
  TOOL_TRACE_MAX_BYTES,
  TOOL_TRACE_OUTPUT_MAX_BYTES,
  ToolCallStatus,
  ToolInspectionKind,
} from '@mechane/protocol';
import type { TurnToolCall } from '@mechane/protocol';
import { boundTraceText, toolExecutionId as executionId } from '@mechane/records';
import type { TraceText } from '@mechane/records';
import { Schema } from 'effect';
import type { ImportedActivity as ActivityEvent } from '../../imported-history.ts';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';

type ToolEvidence = typeof TurnToolCall.Encoded;
type BashInspection = NonNullable<ToolEvidence['inspection']>;

type ReadToolTraceInput = {
  readonly context: StoreContext;
  readonly runId: string;
  readonly events: ReadonlyArray<ActivityEvent>;
};

const JSON_DELIMITER_BYTES = 1;

const NonnegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const BashInputSnapshot = Schema.Struct({
  name: Schema.Literal('bash'),
  executionId: StoredText,
  command: Schema.Struct({ text: StoredText, omittedBytes: NonnegativeInt }),
});

const BashReceiptPreview = Schema.Struct({
  id: StoredText,
  status: Schema.Enum(BashExecutionStatus),
  exit_code: Schema.NullOr(Schema.Int),
  duration_ms: Schema.NullOr(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))),
  output: Schema.NullOr(StoredText),
  omitted_bytes: Schema.NullOr(NonnegativeInt),
});

type BashReceiptPreview = typeof BashReceiptPreview.Type;

type ToolTiming = Pick<ToolEvidence, 'started_at' | 'ended_at'>;

const TOOL_EVENT_STATUSES: Readonly<Record<string, ToolCallStatus>> = {
  'tool.started': ToolCallStatus.Running,
  'tool.completed': ToolCallStatus.Completed,
  'tool.failed': ToolCallStatus.Failed,
};

export async function readToolTrace({ context, runId, events }: ReadToolTraceInput) {
  const recorded = await context.client.query(
    `SELECT id,result->>'status' AS status,result->'exitCode' AS exit_code,
       result->'durationMs' AS duration_ms,result->'output' AS output,result->'omittedBytes' AS omitted_bytes
     FROM mechane.execution_receipts WHERE run_id=$1 AND kind='sandbox' ORDER BY created_at,id`,
    [runId],
  );

  const receipts = new Map<string, BashReceiptPreview>();
  const commands = new Map<string, TraceText>();
  const rows: ReadonlyArray<unknown> = recorded.rows;

  for (const row of rows) {
    if (Schema.is(BashReceiptPreview)(row)) {
      receipts.set(row.id, row);
    }
  }

  for (const event of events) {
    if (event.type === 'tool.input' && Schema.is(BashInputSnapshot)(event.payload)) {
      commands.set(event.payload.executionId, event.payload.command);
    }
  }

  const metadata = readToolMetadata(events);
  const toolCalls: Array<ToolEvidence> = [];
  const budget = { retainedBytes: JSON_DELIMITER_BYTES };

  for (const tool of metadata) {
    const call = await readToolInspection({ tool, runId, receipts, commands });
    const encoded = new TextEncoder().encode(JSON.stringify(call));
    const bytes = encoded.byteLength + JSON_DELIMITER_BYTES;

    if (budget.retainedBytes + bytes > TOOL_TRACE_MAX_BYTES) {
      break;
    }

    toolCalls.push(call);

    budget.retainedBytes += bytes;
  }

  const omittedToolCalls = metadata.length - toolCalls.length;
  const evidenceNotices: Array<string> = [];

  if (omittedToolCalls > 0) {
    evidenceNotices.push(`${omittedToolCalls} tool calls omitted from this trace preview.`);
  }

  return { toolCalls, evidenceNotices };
}

function readToolMetadata(events: ReadonlyArray<ActivityEvent>): ReadonlyArray<ToolEvidence> {
  const tools = new Map<string, ToolEvidence>();

  for (const event of events) {
    const { toolCallId, name } = event.payload;
    const status = TOOL_EVENT_STATUSES[event.type];

    if (typeof toolCallId === 'string' && typeof name === 'string' && status !== undefined) {
      const current = tools.get(toolCallId);
      const timing = readToolTiming({ current, status, createdAt: event.createdAt });

      tools.set(toolCallId, { id: toolCallId, name, status, ...timing });
    }
  }

  return [...tools.values()];
}

type ReadToolTimingInput = {
  readonly current: ToolEvidence | undefined;
  readonly status: ToolCallStatus;
  readonly createdAt: string;
};

function readToolTiming({ current, status, createdAt }: ReadToolTimingInput): ToolTiming {
  if (status === ToolCallStatus.Running) {
    return { started_at: createdAt, ended_at: null };
  }

  return { started_at: current?.started_at ?? null, ended_at: createdAt };
}

type ReadToolInspectionInput = {
  readonly tool: ToolEvidence;
  readonly runId: string;
  readonly receipts: ReadonlyMap<string, BashReceiptPreview>;
  readonly commands: ReadonlyMap<string, TraceText>;
};

async function readToolInspection({ tool, runId, receipts, commands }: ReadToolInspectionInput): Promise<ToolEvidence> {
  if (tool.name !== 'bash') {
    return tool;
  }

  const id = await executionId({ runId, toolCallId: tool.id });
  const command = commands.get(id);

  const inspection: BashInspection = {
    kind: ToolInspectionKind.Bash,
    command: encodeTraceText({
      text: command?.text ?? null,
      omittedBytes: command?.omittedBytes ?? 0,
      maxBytes: TOOL_TRACE_COMMAND_MAX_BYTES,
      keep: 'start',
    }),
    result: readBashResult(receipts.get(id)),
  };

  return { ...tool, inspection };
}

function readBashResult(receipt: BashReceiptPreview | undefined): BashInspection['result'] {
  if (receipt === undefined) {
    return null;
  }

  return {
    status: receipt.status,
    exit_code: receipt.exit_code,
    duration_ms: receipt.duration_ms,
    output: encodeTraceText({
      text: receipt.output,
      omittedBytes: receipt.omitted_bytes ?? 0,
      maxBytes: TOOL_TRACE_OUTPUT_MAX_BYTES,
      keep: 'end',
    }),
  };
}

type TraceTextInput = {
  readonly text: string | null;
  readonly omittedBytes: number;
  readonly maxBytes: number;
  readonly keep: 'start' | 'end';
};

function encodeTraceText(input: TraceTextInput) {
  if (input.text === null) {
    return null;
  }

  const bounded = boundTraceText({ ...input, text: input.text });

  return { text: bounded.text, omitted_bytes: bounded.omittedBytes };
}
