import { MechStatus, TurnEnded, TurnStatus } from '@mechane/protocol';
import { DateTime, Effect, Option, Result, Schema } from 'effect';
import type { CleanupRecord, RoleIntent, RoleReceipt } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import { captureEvalResult } from '../capture-eval-result.ts';
import { EvalRole } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { readRoleRuns } from '../trial/read-role-runs.ts';
import { openRole, readRoleRecord, selectRoleFiles } from '../trial/run-role.ts';
import type { EvalRunFailure } from '../types.ts';

type CleanupTrialInput = { readonly context: RoleContext };
type CleanupRoleInput = CleanupTrialInput & { readonly role: EvalRole; readonly intent: RoleIntent };
type SelectedRoleInput = CleanupTrialInput & { readonly role: EvalRole };
type ArchiveRoleInput = CleanupTrialInput & { readonly receipt: RoleReceipt };
type CleanupSteps = Pick<CleanupRecord, 'resources' | 'steps' | 'errors'>;

const ROLES = [EvalRole.Subject, EvalRole.Judge] as const;
const CLEANUP_STAGE = 'cleanup';
const POLL_INTERVAL = '250 millis';
const ACTIVE_STATUSES: ReadonlySet<TurnStatus> = new Set([TurnStatus.Queued, TurnStatus.Running]);

/** Append a cleanup attempt while retaining every unconfirmed local release failure. */
export const cleanupTrial = Effect.fn('cleanupTrial')(function* ({
  context,
}: CleanupTrialInput): Effect.fn.Return<CleanupRecord, EvalRunFailure> {
  const previous = yield* context.files.readCleanup();
  const failures = yield* context.files.readFailures();
  const unconfirmed = failures.filter((failure) => failure.stage === CLEANUP_STAGE);
  const roles = yield* Effect.forEach(ROLES, (role) => cleanupSelectedRole({ context, role }), { concurrency: 1 });

  const resources = [
    ...unconfirmed.map((failure) => `unconfirmed-release:${failure.sequence}`),
    ...roles.flatMap((role) => role.resources),
  ];

  const steps = roles.flatMap((role) => role.steps);
  const errors = [...unconfirmed.map((failure) => failure.reason), ...roles.flatMap((role) => role.errors)];

  const cleanup: CleanupRecord = {
    attempt: previous.length + 1,
    completedAt: DateTime.nowUnsafe(),
    isComplete: errors.length === 0,
    resources,
    steps,
    errors,
  };

  yield* context.files.saveCleanup({ cleanup });

  return cleanup;
});

const cleanupSelectedRole = Effect.fn('cleanupSelectedRole')(function* ({
  context,
  role,
}: SelectedRoleInput): Effect.fn.Return<CleanupSteps, EvalRunFailure> {
  const files = selectRoleFiles({ context, role });
  const savedIntent = yield* files.intent.read();

  if (Option.isNone(savedIntent)) {
    return { resources: [], steps: [], errors: [] };
  }

  const intent = savedIntent.value;
  const secretReference = `eval_${intent.creationRequestId.replaceAll('-', '_')}`;
  const resources = [`creation:${intent.creationRequestId}`, `credential:${secretReference}`];

  const program = cleanupRole({ context, role, intent }).pipe(
    Effect.timeoutOrElse({
      duration: context.bounds.cleanupTimeout,
      orElse: () => {
        const failure = new EvalAdapterFailed({
          operation: EvalAdapterOperation.CancelRole,
          reason: 'Terminal cancellation was not confirmed before the cleanup deadline',
        });

        return Effect.fail(failure);
      },
    }),
  );

  const result = yield* captureEvalResult({ program });

  const roleResult: CleanupSteps = Result.match(result, {
    onFailure: (failure) => ({ resources: [], steps: [], errors: [`${role}: ${String(failure)}`] }),
    onSuccess: (receipt) => ({
      resources: [`mech:${receipt.mechId}`],
      steps: [`${role}: cancellation confirmed and mech archived`],
      errors: [],
    }),
  });

  const connections = yield* cleanupConnections({ context, role, intent });
  const { call, access } = context.target;

  const revocation = call({
    name: 'deleteCredential',
    input: { workspaceId: access.workspaceId, secretReference },
    credential: access.token,
  });

  const revoked = yield* captureEvalResult({ program: revocation });

  const credentialResult: CleanupSteps = Result.match(revoked, {
    onFailure: (failure) => ({ resources: [], steps: [], errors: [`${role} credential: ${String(failure)}`] }),
    onSuccess: () => ({ resources: [], steps: [`${role}: credential deleted`], errors: [] }),
  });

  const results = [roleResult, connections, credentialResult];

  return {
    resources: [...resources, ...results.flatMap((step) => step.resources)],
    steps: results.flatMap((step) => step.steps),
    errors: results.flatMap((step) => step.errors),
  };
});

const cleanupConnections = Effect.fn('cleanupConnections')(function* ({
  context,
  role,
  intent,
}: CleanupRoleInput): Effect.fn.Return<CleanupSteps, EvalRunFailure> {
  const { call, access } = context.target;
  const secretReference = `eval_${intent.creationRequestId.replaceAll('-', '_')}`;

  const listing = call({
    name: 'listConnections',
    input: { workspaceId: access.workspaceId },
    credential: access.token,
  });

  const listed = yield* captureEvalResult({ program: listing });

  if (Result.isFailure(listed)) {
    return { resources: [], steps: [], errors: [`${role} connections: ${String(listed.failure)}`] };
  }

  const connections = listed.success.connections.filter((connection) =>
    Option.contains(connection.secretReference, secretReference),
  );

  const results = yield* Effect.forEach(
    connections,
    (connection) => {
      const program = call({
        name: 'deleteConnection',
        input: { workspaceId: access.workspaceId, connectionId: connection.id },
        credential: access.token,
      });

      return captureEvalResult({ program });
    },
    { concurrency: 1 },
  );

  return {
    resources: connections.map((connection) => `connection:${connection.id}`),
    steps: results.filter(Result.isSuccess).map(() => `${role}: connection deleted`),
    errors: results.filter(Result.isFailure).map((result) => `${role} connection: ${String(result.failure)}`),
  };
});

const cleanupRole = Effect.fn('cleanupRole')(function* ({
  context,
  role,
  intent,
}: CleanupRoleInput): Effect.fn.Return<RoleReceipt, EvalRunFailure> {
  const receipt = yield* openRole({ context, role, intent });
  const { call, access } = context.target;
  const before = yield* readRoleRuns({ call, access, mechId: receipt.mechId });
  const active = before.filter((run) => ACTIVE_STATUSES.has(run.status));

  for (const run of active) {
    yield* call({
      name: 'cancelTurn',
      input: { workspaceId: access.workspaceId, mechId: receipt.mechId, turnId: run.id },
      credential: access.token,
    }).pipe(
      Effect.catchTags({
        OperationFailed: (failure) => {
          if (Schema.is(TurnEnded)(failure.failure)) {
            return Effect.void;
          }

          return Effect.fail(failure);
        },
      }),
    );
  }

  yield* archiveRole({ context, receipt });

  const state = { runs: yield* readRoleRuns({ call, access, mechId: receipt.mechId }) };

  while (state.runs.some((run) => ACTIVE_STATUSES.has(run.status))) {
    yield* Effect.sleep(POLL_INTERVAL);

    state.runs = yield* readRoleRuns({ call, access, mechId: receipt.mechId });
  }

  const files = selectRoleFiles({ context, role });
  const saved = yield* files.record.read();

  if (Option.isNone(saved)) {
    const observations = yield* context.files.readObservations();
    const hasRemoteTools = role === EvalRole.Judge || observations.length > 0;
    const wasCancelled = state.runs.length === 0 || active.length > 0;
    const keepCancellationReason = Option.liftPredicate<string>(() => wasCancelled);

    const cancellationIssue = keepCancellationReason(
      'The role was archived during cleanup before its result was saved',
    );

    const hosted = Option.none();

    const record = yield* readRoleRecord({
      context,
      role,
      intent,
      receipt,
      runs: state.runs,
      hasRemoteTools,
      hosted,
      wasDeadlineExceeded: false,
      cancellationIssue,
    });

    yield* files.record.create({ record });
  }

  return receipt;
});

const archiveRole = Effect.fn('archiveRole')(function* ({
  context,
  receipt,
}: ArchiveRoleInput): Effect.fn.Return<void, EvalRunFailure> {
  const { call, access } = context.target;
  const input = { workspaceId: access.workspaceId, mechId: receipt.mechId };
  const mech = yield* call({ name: 'showMech', input, credential: access.token });

  if (mech.status === MechStatus.Archived) {
    return;
  }

  yield* call({
    name: 'updateMech',
    input: { ...input, expectedRevision: mech.revision, status: MechStatus.Archived },
    credential: access.token,
  });
});
