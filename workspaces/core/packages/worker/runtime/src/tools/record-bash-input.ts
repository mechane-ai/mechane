import { TOOL_TRACE_COMMAND_MAX_BYTES } from '@mechane/protocol';
import { boundTraceText, toolExecutionId as executionId } from '@mechane/records';
import { Record } from 'effect';
import type { RuntimeToolStore } from './context.ts';
import type { PreparedEnvironment, RuntimeToolContext } from './types.ts';

type RecordBashInput = RuntimeToolContext & {
  readonly store: RuntimeToolStore;
  readonly command: string;
  readonly executionId: string;
  readonly secrets: PreparedEnvironment['secrets'];
};

/** Capture once while the command's actual granted secrets are available, before its external effect. */
export async function recordBashInput(input: RecordBashInput): Promise<void> {
  const snapshot = { text: input.command };

  const secrets = Record.values(input.secrets)
    .filter((value) => value.length > 0)
    .toSorted((left, right) => right.length - left.length);

  for (const secret of secrets) {
    snapshot.text = snapshot.text.replaceAll(secret, '[redacted]');
  }

  const command = boundTraceText({
    text: snapshot.text,
    omittedBytes: 0,
    maxBytes: TOOL_TRACE_COMMAND_MAX_BYTES,
    keep: 'start',
  });

  const id = await executionId({ runId: input.runId, toolCallId: `activity:${input.executionId}:input` });

  await input.store.appendActivity({
    id,
    workspaceId: input.workspaceId,
    mechId: input.mechId,
    runId: input.runId,
    type: 'tool.input',
    payload: { name: 'bash', executionId: input.executionId, command },
  });
}
