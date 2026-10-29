import { RemoteToolDescription } from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import type { Tool } from '@modelcontextprotocol/client';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/client/validators/cf-worker';
import { Result, Schema } from 'effect';
import type { RemoteMcpInvocation } from './types.ts';

const REMOTE_REQUEST_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;

type ValidateRemoteArgumentsInput = { readonly tool: Tool; readonly invocation: RemoteMcpInvocation };

/** Refuses oversized arguments and schema mismatches before any tools/call request. */
export function validateRemoteArguments({ tool, invocation }: ValidateRemoteArgumentsInput): boolean {
  const serialized = JSON.stringify(invocation.arguments);
  const encoded = new TextEncoder().encode(serialized);
  const bytes = encoded.byteLength;

  if (bytes > REMOTE_REQUEST_MAX_BYTES) {
    return false;
  }

  const validator = new CfWorkerJsonSchemaValidator();
  const inputSchema = Schema.decodeUnknownResult(RemoteToolDescription.fields.inputSchema)(tool.inputSchema);

  if (Result.isFailure(inputSchema)) {
    return false;
  }

  const validate = validator.getValidator(inputSchema.success);
  const result = validate(invocation.arguments);

  return result.valid;
}
