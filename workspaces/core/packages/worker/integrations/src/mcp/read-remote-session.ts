import { RemoteToolsOutcome } from '@mechane/protocol';
import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';
import { REMOTE_TIMEOUT_MS } from './constants.ts';
import { executeRemoteMcp } from './execute-remote-mcp.ts';
import type { RemoteMcpInput, RemoteSession } from './types.ts';

type ReadRemoteSessionInput = RemoteMcpInput & RemoteSession;

/** Converts SDK failures into bounded diagnostics without exposing transport exception text. */
export async function readRemoteSession({ ...input }: ReadRemoteSessionInput): Promise<RemoteToolsOutcome> {
  const promise = performRemoteSession(input);
  const result = await capturePromise({ promise });

  if (Result.isSuccess(result)) {
    return result.success;
  }

  if (input.abortSignal.aborted) {
    return RemoteToolsOutcome.cases.Failed.make({
      reason: 'The remote operation was canceled or reached its deadline',
    });
  }

  return RemoteToolsOutcome.cases.Failed.make({ reason: 'The remote server did not complete a valid MCP operation' });
}

async function performRemoteSession({ ...input }: ReadRemoteSessionInput): Promise<RemoteToolsOutcome> {
  const { client, transport, abortSignal } = input;

  await client.connect(transport, { signal: abortSignal, timeout: REMOTE_TIMEOUT_MS });

  return await executeRemoteMcp(input);
}
