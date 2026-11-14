import { catalog, NotificationId, RemoteToolPolicy, TurnStatus } from '@mechane/protocol';
import type { NotificationReceipt, RemoteConnection, Turn } from '@mechane/protocol';
import { CreationRequestId, MechId } from '@mechane/records';
import { DateTime, Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { EvalCallId, EvalRoleStatus } from '../application-schemas.ts';
import type { RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { HostedEnvironment, ObservationJournal, RoleContext, RunRoleInput } from '../application-types.ts';
import { EvalRole } from '../constants.ts';
import { hostEnvironment } from '../environment/host-environment.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { encodeRoleToolCalls } from '../store/encode-eval-records.ts';
import { recordTrialFailure } from '../store/record-trial-failure.ts';
import type { EvalRunFailure, OnceFile } from '../types.ts';
import { readRolePublication } from './read-role-publication.ts';
import { readRoleRuns } from './read-role-runs.ts';

type OpenRoleInput = {
  readonly context: RoleContext;
  readonly role: RunRoleInput['role'];
  readonly intent: RoleIntent;
};

type ReadRoleRecordInput = OpenRoleInput & {
  readonly receipt: RoleReceipt;
  readonly runs: ReadonlyArray<Turn>;
  readonly hosted: Option.Option<HostedEnvironment>;
  readonly hasRemoteTools: boolean;
  readonly wasDeadlineExceeded: boolean;
  readonly cancellationIssue: Option.Option<string>;
};

type ConnectEnvironmentInput = OpenRoleInput & {
  readonly receipt: RoleReceipt;
  readonly hosted: HostedEnvironment;
  readonly tools: RunRoleInput['tools'];
};

type RoleFiles = {
  readonly intent: OnceFile<RoleIntent>;
  readonly receipt: OnceFile<RoleReceipt>;
  readonly notification: OnceFile<NotificationReceipt>;
  readonly record: OnceFile<RoleRecord>;
};

type FinishExpiredRoleInput = Omit<ReadRoleRecordInput, 'runs' | 'wasDeadlineExceeded' | 'cancellationIssue'>;
type HostingFailureInput = { readonly reason: string };
type RoleStatusInput = Pick<ReadRoleRecordInput, 'runs' | 'wasDeadlineExceeded' | 'cancellationIssue'>;
type DeadlineInput = { readonly intent: RoleIntent };

const POLL_INTERVAL = '250 millis';
const ACTIVE_STATUSES: ReadonlySet<TurnStatus> = new Set([TurnStatus.Queued, TurnStatus.Running]);

function isDeadlineElapsed({ intent }: DeadlineInput): boolean {
  const now = DateTime.nowUnsafe();
  const currentMillis = DateTime.toEpochMillis(now);
  const deadlineMillis = DateTime.toEpochMillis(intent.deadlineAt);

  return currentMillis >= deadlineMillis;
}

function observationJournal({ context, role }: Pick<RunRoleInput, 'context' | 'role'>): ObservationJournal {
  if (role === EvalRole.Subject) {
    return context.files;
  }

  return { readObservations: context.files.readJudgeObservations, saveObservation: context.files.saveJudgeObservation };
}

function roleStatus({ runs, wasDeadlineExceeded, cancellationIssue }: RoleStatusInput): RoleRecord['status'] {
  if (
    wasDeadlineExceeded ||
    Option.isSome(cancellationIssue) ||
    runs.some((run) => run.status === TurnStatus.Stopped)
  ) {
    return EvalRoleStatus.Cancelled;
  }

  if (runs.some((run) => run.status === TurnStatus.Failed)) {
    return EvalRoleStatus.Failed;
  }

  return EvalRoleStatus.Completed;
}

/** Reconcile one persisted role identity and preserve its original execution deadline. */
export const runRole = Effect.fn('runRole')(function* ({
  context,
  role,
  settings,
  text,
  tools,
  environment,
  connectionName,
}: RunRoleInput): Effect.fn.Return<RoleRecord, EvalRunFailure, Scope.Scope> {
  const files = selectRoleFiles({ context, role });
  const saved = yield* files.record.read();

  if (Option.isSome(saved)) {
    return saved.value;
  }

  const previousIntent = yield* files.intent.read();

  const intent = Option.getOrElse(previousIntent, () => {
    const now = DateTime.nowUnsafe();

    return {
      creationRequestId: CreationRequestId.make(crypto.randomUUID()),
      notificationId: NotificationId.make(crypto.randomUUID()),
      role,
      name: `${role} ${context.trialId}`,
      settings,
      text,
      connectionName,
      deadlineAt: DateTime.addDuration(now, context.bounds.roleTimeout),
      capMicros: context.bounds.roleCapMicros,
    };
  });

  if (Option.isNone(previousIntent)) {
    yield* files.intent.create({ record: intent });
  }

  const receipt = yield* openRole({ context, role, intent });
  const { call, access } = context.target;
  const { token, workspaceId } = access;

  const completionInput: FinishExpiredRoleInput = {
    context,
    role,
    intent,
    receipt,
    hosted: Option.none(),
    hasRemoteTools: tools.length > 0,
  };

  if (isDeadlineElapsed({ intent })) {
    return yield* finishExpiredRole(completionInput);
  }

  yield* verifyRoleCapabilities({ context, intent, receipt });

  const deniedExecutionAccess = Option.none();

  yield* call({
    name: 'configureExecutionAccess',
    input: { workspaceId, mechId: receipt.mechId, access: deniedExecutionAccess },
    credential: token,
  });

  const openHosting = Effect.fn('openHosting')(function* (): Effect.fn.Return<
    Option.Option<HostedEnvironment>,
    EvalRunFailure,
    Scope.Scope
  > {
    if (tools.length === 0 || Option.isNone(environment)) {
      return Option.none();
    }

    const onCleanupFailure = Effect.fn('onCleanupFailure')(function* ({
      reason,
    }: HostingFailureInput): Effect.fn.Return<void, EvalRunFailure> {
      yield* recordTrialFailure({
        files: context.files,
        failure: { stage: 'cleanup', tag: 'EvalTransportFailed', reason },
      });
    });

    const journal = observationJournal({ context, role });
    const selectedJournal = Option.some(journal);
    const selectedCleanupSink = Option.some(onCleanupFailure);

    const hosting = yield* hostEnvironment({
      environment: environment.value,
      tools,
      journal: selectedJournal,
      scopeId: context.trialId,
      maxRequestBytes: context.bounds.maxObservationBytes,
      maxToolRequests: context.bounds.maxToolRequests,
      target: context.target,
      onCleanupFailure: selectedCleanupSink,
    });

    yield* connectEnvironment({ context, role, intent, receipt, hosted: hosting, tools });

    return Option.some(hosting);
  });

  const hosted = yield* openHosting();

  const notification = yield* files.notification.read();

  if (isDeadlineElapsed({ intent })) {
    return yield* finishExpiredRole({ ...completionInput, hosted });
  }

  if (Option.isNone(notification)) {
    const accepted = yield* call({
      name: 'sendNotification',
      input: {
        workspaceId,
        mechId: receipt.mechId,
        notificationId: intent.notificationId,
        text: intent.text,
        source: { name: 'eval', eventId: intent.notificationId },
      },
      credential: token,
    });

    yield* files.notification.create({ record: accepted });
  }

  const completion = {
    runs: yield* readRoleRuns({ call, access, mechId: receipt.mechId }),
    wasDeadlineExceeded: false,
  };

  while (!hasCompletedRole({ runs: completion.runs, intent })) {
    if (isDeadlineElapsed({ intent })) {
      completion.wasDeadlineExceeded = true;

      break;
    }

    yield* Effect.sleep(POLL_INTERVAL);

    completion.runs = yield* readRoleRuns({ call, access, mechId: receipt.mechId });
  }

  const cancellationIssue = Option.none<string>();

  const record = yield* readRoleRecord({
    context,
    role,
    intent,
    receipt,
    runs: completion.runs,
    hosted,
    hasRemoteTools: tools.length > 0,
    wasDeadlineExceeded: completion.wasDeadlineExceeded,
    cancellationIssue,
  });

  yield* files.record.create({ record });

  return record;
});

/** A role can access only the stage files assigned to its trial and purpose. */
export function selectRoleFiles({ context, role }: Pick<RunRoleInput, 'context' | 'role'>): RoleFiles {
  const { files } = context;

  if (role === EvalRole.Subject) {
    return {
      intent: files.subjectIntent,
      receipt: files.subjectReceipt,
      notification: files.subjectNotification,
      record: files.subject,
    };
  }

  return {
    intent: files.judgeIntent,
    receipt: files.judgeReceipt,
    notification: files.judgeNotification,
    record: files.judge,
  };
}

/** Persist the accepted creation receipt before a notification can be sent. */
export const openRole = Effect.fn('openRole')(function* ({
  context,
  role,
  intent,
}: OpenRoleInput): Effect.fn.Return<RoleReceipt, EvalRunFailure> {
  const files = selectRoleFiles({ context, role });
  const saved = yield* files.receipt.read();

  if (Option.isSome(saved)) {
    return saved.value;
  }

  const { call, access } = context.target;
  const settingsSchema = Schema.toType(catalog.createMech.body);

  const body = yield* Schema.decodeUnknownEffect(settingsSchema, { onExcessProperty: 'error' })({
    ...intent.settings,
    name: intent.name,
    requestId: intent.creationRequestId,
    dailyCapMicros: intent.capMicros,
  }).pipe(
    Effect.mapError(
      (failure) =>
        new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateRoleSettings, reason: failure.message }),
    ),
  );

  const created = yield* call({
    name: 'createMech',
    input: { ...body, workspaceId: access.workspaceId },
    credential: access.token,
  });

  const receipt = {
    creationRequestId: intent.creationRequestId,
    notificationId: intent.notificationId,
    mechId: MechId.make(created.id),
    resolvedModel: created.model,
    createdAt: created.createdAt,
    providerRevision: Option.none(),
  };

  yield* files.receipt.create({ record: receipt });

  return receipt;
});

type VerifyRoleCapabilitiesInput = Pick<ReadRoleRecordInput, 'context' | 'intent' | 'receipt'>;

const verifyRoleCapabilities = Effect.fn('verifyRoleCapabilities')(function* ({
  context,
  intent,
  receipt,
}: VerifyRoleCapabilitiesInput): Effect.fn.Return<void, EvalRunFailure> {
  const { call, access } = context.target;

  const mech = yield* call({
    name: 'showMech',
    input: { workspaceId: access.workspaceId, mechId: receipt.mechId },
    credential: access.token,
  });

  const nativeTools = Option.fromUndefinedOr(mech.nativeTools).pipe(Option.flatten);

  if (Option.isNone(nativeTools)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.VerifyRoleCapabilities,
      reason: 'The selected runtime does not confirm its native tool allowlist',
    });
  }

  const selected: ReadonlySet<string> = new Set(nativeTools.value);

  if (
    selected.size !== intent.settings.nativeTools.length ||
    !intent.settings.nativeTools.every((name) => selected.has(name))
  ) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.VerifyRoleCapabilities,
      reason: 'The runtime applied a different native tool allowlist',
    });
  }

  if (mech.dailyCapMicros !== intent.capMicros || mech.model !== receipt.resolvedModel) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.VerifyRoleSettings,
      reason: 'The runtime role cap or resolved model changed after creation',
    });
  }
});

const finishExpiredRole = Effect.fn('finishExpiredRole')(function* ({
  context,
  role,
  intent,
  receipt,
  hosted,
  hasRemoteTools,
}: FinishExpiredRoleInput): Effect.fn.Return<RoleRecord, EvalRunFailure> {
  const { call, access } = context.target;
  const runs = yield* readRoleRuns({ call, access, mechId: receipt.mechId });
  const wasDeadlineExceeded = !hasCompletedRole({ runs, intent });
  const cancellationIssue = Option.none<string>();

  const record = yield* readRoleRecord({
    context,
    role,
    intent,
    receipt,
    hosted,
    hasRemoteTools,
    runs,
    wasDeadlineExceeded,
    cancellationIssue,
  });

  const files = selectRoleFiles({ context, role });

  yield* files.record.create({ record });

  return record;
});

const connectEnvironment = Effect.fn('connectEnvironment')(function* ({
  context,
  role,
  intent,
  receipt,
  hosted,
  tools,
}: ConnectEnvironmentInput): Effect.fn.Return<void, EvalRunFailure> {
  const { call, access } = context.target;
  const { token, workspaceId } = access;
  const secretReference = `eval_${intent.creationRequestId.replaceAll('-', '_')}`;
  const name = Option.getOrElse(intent.connectionName, () => secretReference);

  const configuration = {
    workspaceId,
    name,
    url: hosted.url,
    secretReference: Option.some(secretReference),
    allowedTools: tools.map((tool) => tool.name),
    policy: RemoteToolPolicy.IdempotentFree,
  };

  yield* call({
    name: 'putCredential',
    input: { workspaceId, secretReference, value: hosted.token, isCreateOnly: false },
    credential: token,
  });

  const listed = yield* call({ name: 'listConnections', input: { workspaceId }, credential: token });

  const existing = listed.connections.filter((connection) =>
    Option.contains(connection.secretReference, secretReference),
  );

  if (existing.length > 1) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ReconcileConnection,
      reason: 'Several connections name the same role creation identity',
    });
  }

  const resolveConnection = Effect.fn('resolveConnection')(function* (): Effect.fn.Return<
    RemoteConnection,
    EvalRunFailure
  > {
    const found = existing.at(0);
    const previous = Option.fromUndefinedOr(found);

    if (Option.isSome(previous)) {
      return yield* call({
        name: 'updateConnection',
        input: { ...configuration, connectionId: previous.value.id },
        credential: token,
      });
    }

    return yield* call({ name: 'createConnection', input: configuration, credential: token });
  });

  const connection = yield* resolveConnection();
  const connectionFile = context.files.connection({ role });
  const recorded = yield* connectionFile.read();

  if (Option.isNone(recorded)) {
    yield* connectionFile.create({ record: { id: connection.id, secretReference, role } });
  }

  yield* call({
    name: 'grantTools',
    input: { workspaceId, mechId: receipt.mechId, connectionId: connection.id, tools: configuration.allowedTools },
    credential: token,
  });
});

function hasCompletedRole({ runs, intent }: Pick<ReadRoleRecordInput, 'runs' | 'intent'>): boolean {
  return (
    runs.some((run) => run.notificationIds.includes(intent.notificationId)) &&
    !runs.some((run) => ACTIVE_STATUSES.has(run.status))
  );
}

/** Capture terminal execution and evidence coverage independently of grading and cleanup. */
export const readRoleRecord = Effect.fn('readRoleRecord')(function* ({
  context,
  intent,
  receipt,
  runs,
  hosted,
  hasRemoteTools,
  wasDeadlineExceeded,
  cancellationIssue,
}: ReadRoleRecordInput): Effect.fn.Return<RoleRecord, EvalRunFailure> {
  const { call, access } = context.target;

  const traces = yield* Effect.forEach(
    runs,
    (run) =>
      call({
        name: 'showTurn',
        input: { workspaceId: access.workspaceId, mechId: receipt.mechId, turnId: run.id },
        credential: access.token,
      }),
    { concurrency: 1 },
  );

  const runIds = runs.map((run) => run.id);
  const selectedRunIds = new Set(runIds);
  const publication = yield* readRolePublication({ call, access, mechId: receipt.mechId, runIds: selectedRunIds });
  const observations = yield* context.files.readObservations();
  const recordedCallIds = observations.map((observation) => observation.callId);
  const observationIds = new Set(recordedCallIds);

  const toolCalls = traces.flatMap((trace) => {
    const calls = Option.fromUndefinedOr(trace.toolCalls);

    return Option.getOrElse(calls, () => []);
  });

  const unknowns = traces.flatMap((trace) => {
    const notices = Option.fromUndefinedOr(trace.evidenceNotices);

    return Option.getOrElse(notices, () => []);
  });

  const issues = Option.match(hosted, { onNone: () => [], onSome: (hosting) => hosting.readIssues() });

  unknowns.push(...issues);

  const hasIncompleteMetadata = traces.some((trace) => {
    const calls = Option.fromUndefinedOr(trace.toolCalls);

    return Option.isNone(calls);
  });

  if (hasRemoteTools && hasIncompleteMetadata) {
    unknowns.push('The runtime did not provide complete remote tool-call metadata');
  }

  if (
    intent.role === EvalRole.Subject &&
    toolCalls.some((tool) => {
      if (!tool.name.startsWith('mcp_')) {
        return false;
      }

      const invocationId = Option.fromUndefinedOr(tool.invocationId);

      if (Option.isNone(invocationId)) {
        return true;
      }

      const callId = EvalCallId.make(invocationId.value);

      return !observationIds.has(callId);
    })
  ) {
    unknowns.push('A remote tool call has no durable observation receipt');
  }

  if (traces.length === 0) {
    unknowns.push('No completed activation trace is available');
  }

  const status = roleStatus({ runs, wasDeadlineExceeded, cancellationIssue });

  const record: RoleRecord = {
    status,
    mechId: receipt.mechId,
    notificationId: intent.notificationId,
    runIds,
    requestedModel: Option.fromUndefinedOr(intent.settings.model),
    resolvedModel: receipt.resolvedModel,
    providerRevision: Option.none(),
    dispatches: traces.flatMap((trace) => trace.dispatches),
    toolCalls: encodeRoleToolCalls({ toolCalls }),
    isEvidenceComplete: status === EvalRoleStatus.Completed && unknowns.length === 0,
    unknowns,
    endedAt: DateTime.nowUnsafe(),
  };

  if (Option.isSome(publication)) {
    return { ...record, reply: publication.value.text };
  }

  if (wasDeadlineExceeded) {
    return { ...record, issue: 'The original role deadline was exceeded' };
  }

  if (Option.isSome(cancellationIssue)) {
    return { ...record, issue: cancellationIssue.value };
  }

  return record;
});
