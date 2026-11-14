import { call } from '@mechane/client';
import { Bytes, BYTES_PER_MEBIBYTE, WorkspaceId } from '@mechane/records';
import { Duration, Effect, Option, Schema } from 'effect';
import type { Redacted } from 'effect';
import type { EvalTarget, OpenEvalTransport } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';
import { validateTargetOrigin } from './validate-target-origin.ts';

type CreateEvalTargetInput = {
  readonly origin: URL;
  readonly token: Redacted.Redacted;
  readonly workspaceId: unknown;
  readonly kind: EvalTarget['kind'];
  readonly artifactIdentity: string;
  readonly openTransport: OpenEvalTransport;
};

const REQUEST_TIMEOUT = Duration.seconds(30);
const RESPONSE_MAX_BYTES = 32 * BYTES_PER_MEBIBYTE;

/** Public clients validate a workspace before binding authenticated canonical operations to it. */
export const createEvalTarget = Effect.fn('createEvalTarget')(function* ({
  origin,
  token,
  workspaceId,
  kind,
  artifactIdentity,
  openTransport,
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

  return { call: operationCall, access, kind, origin, artifactIdentity, openTransport };
});

/** Local fixtures use the authenticated loopback listener directly. */
export const localTransport: OpenEvalTransport = ({ localOrigin }) =>
  Effect.succeed({ origin: localOrigin, release: Effect.void });
