import { RemoteToolsOutcome } from '@mechane/protocol';
import type { Tool } from '@modelcontextprotocol/client';
import { Option } from 'effect';
import { REMOTE_TIMEOUT_MS } from './constants.ts';
import { readRemoteResult } from './read-remote-result.ts';
import type { RemoteMcpInput, RemoteMcpInvocation, RemoteSession } from './types.ts';
import { validateRemoteArguments } from './validate-remote-arguments.ts';

type CallRemoteMcpInput = Pick<RemoteMcpInput, 'token' | 'authorize'> &
  Pick<RemoteSession, 'client' | 'abortSignal'> & {
    readonly invocation: RemoteMcpInvocation;
    readonly tools: ReadonlyArray<Tool>;
  };

/** Validates arguments and rechecks live authorization immediately before dispatch. */
export async function callRemoteMcp({
  client,
  abortSignal: signal,
  tools,
  invocation,
  token,
  authorize,
}: CallRemoteMcpInput): Promise<RemoteToolsOutcome> {
  const found = tools.find((tool) => tool.name === invocation.toolName);
  const requestedTool = Option.fromUndefinedOr(found);

  if (Option.isNone(requestedTool)) {
    return RemoteToolsOutcome.cases.Refused.make({
      reason: 'The tool is not granted or explicitly declares mutating behavior',
    });
  }

  if (!validateRemoteArguments({ tool: requestedTool.value, invocation })) {
    return RemoteToolsOutcome.cases.Refused.make({
      reason: 'Remote tool arguments do not satisfy its schema or byte limit',
    });
  }

  if (!(await authorize())) {
    return RemoteToolsOutcome.cases.Refused.make({ reason: 'The connection or grant changed before dispatch' });
  }

  const result = await client.callTool(
    { name: invocation.toolName, arguments: invocation.arguments },
    { signal, timeout: REMOTE_TIMEOUT_MS },
  );

  return readRemoteResult({ result, token });
}
