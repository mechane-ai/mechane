import { DateTime, Effect, Option, Predicate, Result } from 'effect';
import type { CleanupRecord, RoleIntent, RoleReceipt } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import { captureEvalResult } from '../capture-eval-result.ts';
import { EvalRole } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { managedRequest } from '../managed-request.ts';
import { readRoleRecord } from '../trial/read-role-record.ts';
import { selectRoleFiles } from '../trial/role-files.ts';
import { isOwned, provisioningIssue, recoverRoleResource } from '../trial/role-resources.ts';
import type { EvalSession, OwnedResource } from '../trial/role-resources.ts';
import type { EvalRunFailure } from '../types.ts';

type CleanupSteps = Pick<CleanupRecord, 'resources' | 'steps' | 'errors'>;
type CleanupTrialInput = { readonly context: RoleContext };
type CleanupLine = { readonly line: string };

type CleanupRoleInput = {
  readonly context: RoleContext;
  readonly role: EvalRole;
  readonly intent: RoleIntent;
  readonly receipt: Option.Option<RoleReceipt>;
  readonly recordResource: (input: CleanupLine) => void;
  readonly recordStep: (input: CleanupLine) => void;
};

const CLEANUP_STAGE = 'cleanup';
const ACTIVE: ReadonlySet<EvalSession['status']> = new Set(['running', 'rescheduling']);
const TERMINATED = 'terminated';
const ROLES = [EvalRole.Subject, EvalRole.Judge] as const;

export const cleanupTrial = Effect.fn('cleanupTrial')(function* ({
  context,
}: CleanupTrialInput): Effect.fn.Return<CleanupRecord, EvalRunFailure> {
  const previous = yield* context.files.readCleanup();
  const failures = yield* context.files.readFailures();
  const unconfirmed = failures.filter((failure) => failure.stage === CLEANUP_STAGE);
  const roles = yield* Effect.forEach(ROLES, (role) => cleanupSelectedRole(context, role), { concurrency: 1 });
  const errors = [...unconfirmed.map((failure) => failure.reason), ...roles.flatMap((role) => role.errors)];

  const cleanup: CleanupRecord = {
    attempt: previous.length + 1,
    completedAt: DateTime.nowUnsafe(),
    isComplete: errors.length === 0,
    resources: [
      ...unconfirmed.map((failure) => `unconfirmed-release:${failure.sequence}`),
      ...roles.flatMap((role) => role.resources),
    ],
    steps: roles.flatMap((role) => role.steps),
    errors,
  };

  yield* context.files.saveCleanup({ cleanup });

  return cleanup;
});

const cleanupSelectedRole = Effect.fn('cleanupSelectedRole')(function* (
  context: RoleContext,
  role: EvalRole,
): Effect.fn.Return<CleanupSteps, EvalRunFailure> {
  const files = selectRoleFiles({ context, role });
  const intent = yield* files.intent.read();

  if (Option.isNone(intent)) {
    return { resources: [], steps: [], errors: [] };
  }

  const receipt = yield* files.receipt.read();

  if (Option.isSome(receipt) && receipt.value.creationRequestId !== intent.value.creationRequestId) {
    return { resources: [], steps: [], errors: [`${role}: the saved receipt does not match the role intent`] };
  }

  const resources = [`creation:${intent.value.creationRequestId}`];
  const steps: Array<string> = [];

  const timeout = new EvalAdapterFailed({
    operation: EvalAdapterOperation.CancelRole,
    reason: 'Resource cleanup was not confirmed within the cleanup deadline',
  });

  const program = cleanupRole({
    context,
    role,
    intent: intent.value,
    receipt,
    recordResource: ({ line }) => {
      resources.push(line);
    },
    recordStep: ({ line }) => {
      steps.push(line);
    },
  }).pipe(Effect.timeoutOrElse({ duration: context.bounds.cleanupTimeout, orElse: () => Effect.fail(timeout) }));

  const result = yield* captureEvalResult({ program });
  const errors: Array<string> = [];

  if (Result.isFailure(result)) {
    const failure = String(result.failure);

    errors.push(`${role}: ${failure}`);
  }

  return { resources, steps, errors };
});

type Retrieval = { readonly id: OwnedResource['id']; readonly signal: AbortSignal };

type ResourceInput<R extends OwnedResource> = {
  readonly context: RoleContext;
  readonly intent: RoleIntent;
  readonly kind: 'agent' | 'environment' | 'session';
  readonly id: Option.Option<OwnedResource['id']>;
  readonly retrieve: (input: Retrieval) => Promise<R>;
  readonly list: (signal: AbortSignal) => AsyncIterable<R>;
};

const ownedResource = Effect.fn('ownedResource')(function* <R extends OwnedResource>(
  input: ResourceInput<R>,
): Effect.fn.Return<Option.Option<R>, EvalRunFailure> {
  if (Option.isNone(input.id)) {
    return yield* recoverRoleResource(input);
  }

  const id = input.id.value;

  const resource = yield* managedRequest({
    action: `Inspect owned eval ${input.kind}`,
    operation: (signal) => input.retrieve({ id, signal }),
  });

  if (!isOwned({ resource, intent: input.intent })) {
    return yield* provisioningIssue({ reason: 'The recorded resource belongs to a different creation request' });
  }

  return Option.some(resource);
});

const cleanupRole = Effect.fn('cleanupRole')(function* ({
  context,
  role,
  intent,
  receipt,
  recordResource,
  recordStep,
}: CleanupRoleInput): Effect.fn.Return<void, EvalRunFailure> {
  const { agents, environments, sessions } = context.target.managed.beta;
  const lookup = { include_archived: true };
  const sessionId = Option.map(receipt, (saved) => saved.sessionId);

  const session = yield* ownedResource({
    context,
    intent,
    kind: 'session',
    id: sessionId,
    retrieve: ({ id, signal }) => sessions.retrieve(id, {}, { signal }),
    list: (signal) => sessions.list(lookup, { signal }),
  });

  if (Option.isSome(session)) {
    recordResource({ line: `session:${session.value.id}` });
    yield* stopSession(context, session.value);
    recordStep({ line: `${role}: session terminated and archived` });
  }

  const agentId = Option.map(receipt, (saved) => saved.agentId);

  const agent = yield* ownedResource({
    context,
    intent,
    kind: 'agent',
    id: agentId,
    retrieve: ({ id, signal }) => agents.retrieve(id, {}, { signal }),
    list: (signal) => agents.list(lookup, { signal }),
  });

  if (Option.isSome(agent)) {
    const { id, archived_at } = agent.value;

    recordResource({ line: `agent:${id}` });

    if (Predicate.isNull(archived_at)) {
      const archived = yield* managedRequest({
        action: 'Archive eval agent',
        operation: (signal) => agents.archive(id, {}, { signal }),
      });

      if (archived.id !== id || Predicate.isNull(archived.archived_at)) {
        return yield* provisioningIssue({ reason: 'The service did not confirm archival of the owned agent' });
      }
    }

    recordStep({ line: `${role}: agent archived` });
  }

  const environmentId = Option.map(receipt, (saved) => saved.environmentId);

  const environment = yield* ownedResource({
    context,
    intent,
    kind: 'environment',
    id: environmentId,
    retrieve: ({ id, signal }) => environments.retrieve(id, {}, { signal }),
    list: (signal) => environments.list(lookup, { signal }),
  });

  if (Option.isSome(environment)) {
    const { id, archived_at } = environment.value;

    recordResource({ line: `environment:${id}` });

    if (Predicate.isNull(archived_at)) {
      const archived = yield* managedRequest({
        action: 'Archive eval environment',
        operation: (signal) => environments.archive(id, {}, { signal }),
      });

      if (archived.id !== id || Predicate.isNull(archived.archived_at)) {
        return yield* provisioningIssue({ reason: 'The service did not confirm archival of the owned environment' });
      }
    }

    recordStep({ line: `${role}: environment archived` });
  }

  const files = selectRoleFiles({ context, role });
  const previous = yield* files.record.read();

  if (Option.isSome(receipt) && Option.isNone(previous)) {
    const record = yield* readRoleRecord({
      context,
      intent,
      receipt: receipt.value,
      reason: 'The session was archived during cleanup before its result was saved',
    });

    yield* files.record.create({ record });
  }
});

const stopSession = Effect.fn('stopSession')(function* (
  context: RoleContext,
  original: EvalSession,
): Effect.fn.Return<void, EvalAdapterFailed> {
  const { sessions } = context.target.managed.beta;
  const id = original.id;

  const read = managedRequest({
    action: 'Inspect eval session while stopping',
    operation: (signal) => sessions.retrieve(id, {}, { signal }),
  });

  let session = original;

  if (ACTIVE.has(session.status)) {
    yield* managedRequest({
      action: 'Interrupt eval session',
      operation: (signal) => sessions.events.send(id, { events: [{ type: 'user.interrupt' }] }, { signal }),
    });

    do {
      session = yield* read;

      if (ACTIVE.has(session.status)) {
        yield* Effect.sleep('250 millis');
      }
    } while (ACTIVE.has(session.status));
  }

  if (Predicate.isNull(session.archived_at)) {
    session = yield* managedRequest({
      action: 'Archive eval session',
      operation: (signal) => sessions.archive(id, {}, { signal }),
    });
  }

  if (session.id !== id || Predicate.isNull(session.archived_at) || session.status !== TERMINATED) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.CancelRole,
      reason: 'The owned session was not confirmed terminated and archived',
    });
  }
});
