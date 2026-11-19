import Anthropic from '@anthropic-ai/sdk';
import { call } from '@mechane/client';
import { managedWorkspaceId } from '@mechane/protocol';
import { Bytes, BYTES_PER_MEBIBYTE, WorkspaceId } from '@mechane/records';
import { Duration, Effect, Option, Redacted, Schema } from 'effect';
import type { EvalTarget } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';
import { validateTargetOrigin } from './validate-target-origin.ts';

type CreateEvalTargetInput = {
  readonly origin: URL;
  readonly token: Redacted.Redacted;
  readonly workspaceId: unknown;
  readonly kind: EvalTarget['kind'];
  readonly artifactIdentity: string;
};

const REQUEST_TIMEOUT = Duration.seconds(30);
const RESPONSE_MAX_BYTES = 32 * BYTES_PER_MEBIBYTE;

/** Bind both installation diagnostics and the Managed Agents SDK to the selected workspace. */
export const createEvalTarget = Effect.fn('createEvalTarget')(function* ({
  origin,
  token,
  workspaceId,
  kind,
  artifactIdentity,
}: CreateEvalTargetInput): Effect.fn.Return<EvalTarget, EvalAdapterFailed> {
  yield* validateTargetOrigin({ origin, kind });

  const admittedWorkspaceId = yield* Schema.decodeUnknownEffect(WorkspaceId)(workspaceId).pipe(
    Effect.mapError(
      (failure) => new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateTarget, reason: failure.message }),
    ),
  );

  const access = { token, workspaceId: admittedWorkspaceId };
  const responseBytes = Bytes.make(RESPONSE_MAX_BYTES);
  const maxResponseBytes = Option.some(responseBytes);

  const operationCall: EvalTarget['call'] = (request) =>
    call({ ...request, origin, timeout: REQUEST_TIMEOUT, userAgent: '@mechane/eval', maxResponseBytes });

  const apiKey = Redacted.value(token);
  const timeout = Duration.toMillis(REQUEST_TIMEOUT);
  const workspaceHeader = managedWorkspaceId({ workspaceId: admittedWorkspaceId });

  const managed = new Anthropic({
    baseURL: origin.origin,
    apiKey,
    defaultHeaders: { 'anthropic-workspace-id': workspaceHeader },
    timeout,
    maxRetries: 0,
  });

  return { call: operationCall, access, kind, origin, artifactIdentity, managed };
});
