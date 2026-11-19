import { Sequence } from '@mechane/records';
import { Array, DateTime, Effect, Option } from 'effect';
import type { EvalToolDefinition, EvalToolResult } from '../application-schemas.ts';
import type { EvalEnvironment, ExecuteToolInput, RoleContext } from '../application-types.ts';
import { EvalRole, ObservationProvenance } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { beginObservedTool } from '../store/begin-observed-tool.ts';
import { encodeObservation } from '../store/encode-eval-records.ts';
import type { EvalRunFailure } from '../types.ts';

type ObservedToolInput = {
  readonly context: RoleContext;
  readonly role: EvalRole;
  readonly tools: ReadonlyArray<EvalToolDefinition>;
  readonly environment: EvalEnvironment;
  readonly request: ExecuteToolInput;
};

/** The role's single writer saves the result before sending the tool acknowledgment to its session. */
export const executeObservedTool = Effect.fn('executeObservedTool')(function* ({
  context,
  role,
  tools,
  environment,
  request,
}: ObservedToolInput): Effect.fn.Return<EvalToolResult, EvalRunFailure> {
  if (!tools.some((tool) => tool.name === request.name)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ExecuteTool,
      reason: "The tool is outside this role's frozen selection",
    });
  }

  const payload = { name: request.name, arguments: request.arguments };
  const requestText = JSON.stringify(payload);

  if (Buffer.byteLength(requestText) > context.bounds.maxObservationBytes) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ExecuteTool,
      reason: 'The tool request exceeds the frozen observation byte bound',
    });
  }

  const requestDigest = jsonDigest({ value: payload });
  const files = context.files;

  const journal = {
    [EvalRole.Subject]: { read: files.readObservations, save: files.saveObservation },
    [EvalRole.Judge]: { read: files.readJudgeObservations, save: files.saveJudgeObservation },
  }[role];

  const observations = yield* journal.read();
  const previous = Array.findFirst(observations, (observation) => observation.callId === request.callId);

  if (Option.isSome(previous)) {
    if (previous.value.requestDigest !== requestDigest) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ReplayTool,
        reason: 'The tool call identity already names a different request',
      });
    }

    return previous.value.result;
  }

  yield* beginObservedTool({
    folder: files.folder,
    role,
    callId: request.callId,
    requestDigest,
    maxToolRequests: context.bounds.maxToolRequests,
  });

  const result = yield* environment.execute(request);

  const observation = {
    trialId: context.trialId,
    sequence: Sequence.make(observations.length + 1),
    callId: request.callId,
    requestDigest,
    ...payload,
    result,
    observedAt: DateTime.nowUnsafe(),
    provenance: ObservationProvenance.CustomTool,
  };

  const record = encodeObservation({ observation });
  const encoded = JSON.stringify(record);
  const bytes = Buffer.byteLength(encoded);

  if (bytes > context.bounds.maxObservationBytes) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.RecordToolResult,
      reason: 'The observation exceeds the frozen byte bound',
    });
  }

  yield* journal.save({ observation });

  return result;
});
