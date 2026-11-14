import { RandomId, Sequence } from '@mechane/records';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import { DateTime, Effect, Option, Redacted, Semaphore } from 'effect';
import type { Scope } from 'effect';
import type { EvalToolResult } from '../application-schemas.ts';
import type { ExecuteToolInput, HostedEnvironment, HostEnvironmentInput } from '../application-types.ts';
import { ObservationProvenance } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import type { EvalTransportFailed } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { encodeObservation } from '../store/encode-eval-records.ts';
import type { EvalRunFailure } from '../types.ts';
import { buildMcpPath, openEnvironmentServer } from './http-entry.ts';

type RecordExecutionFailure = (failure: EvalRunFailure) => Effect.Effect<void>;

/** Authentication and trial journals stay scoped to one declared tool selection. */
export const hostEnvironment = Effect.fn('hostEnvironment')(function* (
  input: HostEnvironmentInput,
): Effect.fn.Return<HostedEnvironment, EvalRunFailure, Scope.Scope> {
  const token = RandomId.make(crypto.randomUUID());
  const routeId = RandomId.make(crypto.randomUUID());
  const path = buildMcpPath({ id: routeId });
  const issues: Array<string> = [];
  const unrecorded = { calls: 0 };
  const semaphore = yield* Semaphore.make(1);

  const tools = yield* Effect.try({
    try: () =>
      input.tools.map((definition) =>
        ToolSchema.parse({
          ...definition,
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        }),
      ),
    catch: (cause) =>
      new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateToolDefinition, reason: String(cause) }),
  });

  const executeRecorded = Effect.fn('executeRecorded')(function* (
    request: ExecuteToolInput,
  ): Effect.fn.Return<EvalToolResult, EvalRunFailure> {
    const requestDigest = jsonDigest({ value: { name: request.name, arguments: request.arguments } });

    if (!input.tools.some((tool) => tool.name === request.name)) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ExecuteTool,
        reason: "The tool is outside this role's frozen selection",
      });
    }

    if (Option.isSome(input.journal)) {
      const observations = yield* input.journal.value.readObservations();
      const recorded = observations.find((observation) => observation.callId === request.callId);
      const previous = Option.fromUndefinedOr(recorded);

      if (Option.isSome(previous)) {
        if (previous.value.requestDigest !== requestDigest) {
          return yield* new EvalAdapterFailed({
            operation: EvalAdapterOperation.ReplayTool,
            reason: 'The tool call identity already names different arguments',
          });
        }

        return previous.value.result;
      }

      if (observations.length >= input.maxToolRequests) {
        return yield* new EvalAdapterFailed({
          operation: EvalAdapterOperation.RecordTool,
          reason: 'The frozen tool-call bound was reached',
        });
      }
    }

    if (Option.isNone(input.journal)) {
      if (unrecorded.calls >= input.maxToolRequests) {
        return yield* new EvalAdapterFailed({
          operation: EvalAdapterOperation.ExecuteTool,
          reason: 'The frozen tool-call bound was reached',
        });
      }

      unrecorded.calls += 1;
    }

    const result = yield* input.environment.execute(request);

    if (Option.isSome(input.journal)) {
      const observations = yield* input.journal.value.readObservations();

      const observation = {
        trialId: input.scopeId,
        sequence: Sequence.make(observations.length + 1),
        callId: request.callId,
        requestDigest,
        name: request.name,
        arguments: request.arguments,
        result,
        observedAt: DateTime.nowUnsafe(),
        provenance: ObservationProvenance.Mcp,
      };

      const record = encodeObservation({ observation });
      const encoded = JSON.stringify(record);
      const observationBytes = Buffer.byteLength(encoded);

      if (observationBytes > input.maxRequestBytes) {
        return yield* new EvalAdapterFailed({
          operation: EvalAdapterOperation.RecordToolResult,
          reason: 'The observation exceeds the frozen byte bound',
        });
      }

      yield* input.journal.value.saveObservation({ observation });
    }

    return result;
  });

  const recordExecutionFailure: RecordExecutionFailure = (failure) => {
    issues.push(failure.message);

    return Effect.void;
  };

  const execute: Parameters<typeof openEnvironmentServer>[0]['execute'] = (request) => {
    const recorded = executeRecorded(request).pipe(Effect.tapError(recordExecutionFailure));

    return semaphore.withPermits(1)(recorded);
  };

  const recordCleanupFailure = Effect.fn('recordCleanupFailure')(function* (
    failure: EvalTransportFailed,
  ): Effect.fn.Return<void, EvalRunFailure> {
    const reason = `Fixture ${input.scopeId}: ${failure.message}`;

    issues.push(`Cleanup: ${reason}`);

    if (Option.isNone(input.onCleanupFailure)) {
      return yield* failure;
    }

    yield* input.onCleanupFailure.value({ reason });
  });

  const opening = openEnvironmentServer({
    token,
    path,
    tools,
    execute,
    maxRequestBytes: input.maxRequestBytes,
    onIssue: ({ reason }) => {
      issues.push(reason);
    },
  });

  const server = yield* Effect.acquireRelease(opening, (opened) =>
    opened.release.pipe(
      Effect.catchTags({ EvalTransportFailed: (failure) => recordCleanupFailure(failure).pipe(Effect.orDie) }),
    ),
  );

  const localOrigin = server.origin;
  const transport = yield* input.target.openTransport({ localOrigin });

  const closeHosting = Effect.fn('closeHosting')(function* (): Effect.fn.Return<void, EvalTransportFailed> {
    yield* server.release;
    yield* transport.release;
  });

  const release = closeHosting();

  yield* Effect.acquireRelease(Effect.void, () =>
    release.pipe(
      Effect.catchTags({ EvalTransportFailed: (failure) => recordCleanupFailure(failure).pipe(Effect.orDie) }),
    ),
  );

  return { url: new URL(path, transport.origin), token: Redacted.make(token), release, readIssues: () => [...issues] };
});
