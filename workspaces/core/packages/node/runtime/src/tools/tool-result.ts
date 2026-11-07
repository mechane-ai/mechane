import { HttpMethod } from '@mechane/records';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { TOOL_MODEL_RESULT_MAX_BYTES, TOOL_RESULT_CHUNK_CHARACTERS } from './constants.ts';
import { requestSandboxExecution } from './sandbox-client.ts';
import type { RuntimeToolContext } from './types.ts';

type ModelToolResult = { readonly executionId: string; readonly output: unknown };
type ReadToolResult = RuntimeToolContext & { readonly executionId: string; readonly offsetCharacters: number };

export function modelToolResult({ executionId, output }: ModelToolResult): unknown {
  const text = JSON.stringify(output);

  if (Buffer.byteLength(text) <= TOOL_MODEL_RESULT_MAX_BYTES) {
    return output;
  }

  return {
    status: 'completed',
    executionId,
    isTruncated: true,
    preview: text.slice(0, TOOL_RESULT_CHUNK_CHARACTERS),
    nextOffsetCharacters: TOOL_RESULT_CHUNK_CHARACTERS,
    totalCharacters: text.length,
    message: 'The operation completed. Use read_tool_result to read its saved result without repeating the operation.',
  };
}

export async function readToolResult(input: ReadToolResult) {
  'use step';

  return await withRuntimeStore(async (store) => {
    const receipt = await store.getExecution({
      id: input.executionId,
      workspaceId: input.workspaceId,
      mechId: input.mechId,
    });

    if (receipt === null || receipt.result === null) {
      return { status: 'unavailable', message: 'This mech has no saved result for that execution.' };
    }

    const text = await retainedResult({ input, kind: receipt.kind, result: receipt.result });

    if (text === undefined) {
      return { status: 'unavailable', message: 'This execution has no confirmed result.' };
    }

    const end = Math.min(input.offsetCharacters + TOOL_RESULT_CHUNK_CHARACTERS, text.length);

    return {
      executionId: input.executionId,
      status: receipt.status,
      text: text.slice(input.offsetCharacters, end),
      offsetCharacters: input.offsetCharacters,
      nextOffsetCharacters: end,
      totalCharacters: text.length,
      isTruncated: end < text.length,
    };
  });
}

type RetainedResultInput = {
  readonly input: ReadToolResult;
  readonly kind: 'sandbox' | 'mcp';
  readonly result: Readonly<Record<string, unknown>>;
};

async function retainedResult({ input, kind, result }: RetainedResultInput): Promise<string | undefined> {
  if (kind === 'mcp') {
    return JSON.stringify(result['output']);
  }

  const progress = await requestSandboxExecution({ ...input, method: HttpMethod.Get, waitMs: 0 });

  switch (progress._tag) {
    case 'Exited':
    case 'TimedOut':
    case 'PersistenceFailed':
      return JSON.stringify({ output: progress.output.text, omittedBytes: progress.output.omittedBytes });
    case 'ExecutionEnvironmentRequired':
    case 'ExecutionNotFound':
    case 'ExecutionReused':
    case 'CapacityRefused':
    case 'Running':
    case 'Unavailable':
    case 'Uncertain':
      return undefined;
  }
}
