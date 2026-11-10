import { RemoteToolPolicy } from '@mechane/protocol';
import type { RemoteToolsOutcome } from '@mechane/protocol';
import type { Tool } from '@modelcontextprotocol/client';
import { Option } from 'effect';
import { callRemoteMcp } from './call-remote-mcp.ts';
import { REMOTE_TIMEOUT_MS } from './constants.ts';
import { remoteToolMetadata } from './remote-tool-metadata.ts';
import type { RemoteMcpInput, RemoteSession } from './types.ts';

type ExecuteRemoteMcpInput = RemoteMcpInput & RemoteSession;
type PermittedToolInput = Pick<RemoteMcpInput, 'tools' | 'connection'> & { readonly tool: Tool };

/** Remote metadata may narrow an owner grant but cannot expand it. */
export async function executeRemoteMcp({
  connection,
  client,
  abortSignal: signal,
  tools,
  invocation,
  token,
  authorize,
}: ExecuteRemoteMcpInput): Promise<RemoteToolsOutcome> {
  const listed = await client.listTools(undefined, { signal, timeout: REMOTE_TIMEOUT_MS });
  const permitted = listed.tools.filter((tool) => isPermittedRemoteTool({ tool, tools, connection }));

  if (Option.isNone(invocation)) {
    return remoteToolMetadata({ tools: permitted, token });
  }

  return await callRemoteMcp({
    client,
    abortSignal: signal,
    tools: permitted,
    invocation: invocation.value,
    token,
    authorize,
  });
}

function isPermittedRemoteTool({ tool, tools, connection }: PermittedToolInput): boolean {
  if (!tools.includes(tool.name)) {
    return false;
  }

  const annotations = Option.fromUndefinedOr(tool.annotations);

  if (Option.isNone(annotations)) {
    return true;
  }

  if (annotations.value.readOnlyHint !== false) {
    return true;
  }

  return connection.policy === RemoteToolPolicy.IdempotentFree && annotations.value.idempotentHint === true;
}
