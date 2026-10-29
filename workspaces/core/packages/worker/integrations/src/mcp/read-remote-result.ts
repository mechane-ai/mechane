import { RemoteToolsOutcome } from '@mechane/protocol';
import type { CallToolResult } from '@modelcontextprotocol/client';
import type { Option, Redacted } from 'effect';
import { REMOTE_RESULT_MAX_BYTES } from './constants.ts';
import { redactRemoteJson } from './redact-remote-json.ts';

type ReadRemoteResultInput = {
  readonly result: CallToolResult;
  /** None means the request carried no configured credential to remove from echoed output. */
  readonly token: Option.Option<Redacted.Redacted>;
};

/** Removes exact credential echoes before enforcing the returned JSON byte limit. */
export function readRemoteResult({ result, token }: ReadRemoteResultInput): RemoteToolsOutcome {
  const serialized = JSON.stringify({ content: result.content, structuredContent: result.structuredContent });
  const content = redactRemoteJson({ serialized, token });

  const encoded = new TextEncoder().encode(content);

  if (encoded.byteLength > REMOTE_RESULT_MAX_BYTES) {
    return RemoteToolsOutcome.cases.Failed.make({ reason: 'Remote tool result exceeded the byte limit' });
  }

  return RemoteToolsOutcome.cases.Returned.make({ content, isError: result.isError === true });
}
