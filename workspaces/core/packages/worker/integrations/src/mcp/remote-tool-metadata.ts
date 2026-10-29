import { RemoteToolDescription, RemoteToolsOutcome } from '@mechane/protocol';
import type { Tool } from '@modelcontextprotocol/client';
import { Option, Result, Schema } from 'effect';
import { REMOTE_RESULT_MAX_BYTES } from './constants.ts';
import { redactRemoteJson } from './redact-remote-json.ts';
import type { RemoteMcpInput } from './types.ts';

type RemoteToolMetadataInput = Pick<RemoteMcpInput, 'token'> & { readonly tools: ReadonlyArray<Tool> };

/** Sanitizes and bounds remote descriptions before decoding model-visible metadata. */
export function remoteToolMetadata({ tools, token }: RemoteToolMetadataInput): RemoteToolsOutcome {
  const describe: (tool: Tool) => Omit<RemoteToolDescription, 'inputSchema'> & Pick<Tool, 'inputSchema'> = (tool) => {
    const description = Option.fromUndefinedOr(tool.description);

    return { name: tool.name, description: Option.getOrElse(description, () => ''), inputSchema: tool.inputSchema };
  };

  const metadata = tools.map(describe);

  const serialized = JSON.stringify(metadata);
  const sanitized = redactRemoteJson({ serialized, token });

  const encoded = new TextEncoder().encode(sanitized);

  if (encoded.byteLength > REMOTE_RESULT_MAX_BYTES) {
    return RemoteToolsOutcome.cases.Failed.make({ reason: 'The remote tool descriptions exceeded the byte limit' });
  }

  const descriptionList = Schema.Array(RemoteToolDescription);
  const descriptionJson = Schema.fromJsonString(descriptionList);
  const available = Schema.decodeUnknownResult(descriptionJson)(sanitized);

  if (Result.isFailure(available)) {
    return RemoteToolsOutcome.cases.Failed.make({ reason: 'The remote tool descriptions were invalid' });
  }

  return RemoteToolsOutcome.cases.Tools.make({ tools: available.success });
}
