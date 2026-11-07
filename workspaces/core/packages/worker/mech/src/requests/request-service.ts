import { readServiceRequest, resolveIntegrationSecret } from '@mechane/integrations';
import type { RequestServiceOutcome } from '@mechane/integrations';
import type { MechStore } from '@mechane/mech-store';
import { ExternalRequestRecovery, ExternalRequestUnavailable, ThreadState } from '@mechane/protocol';
import type { ExternalRequestKind, RequestService } from '@mechane/protocol';
import { HttpMethod, MechId, WorkspaceId } from '@mechane/records';
import type { ExternalRequestId, ThreadId } from '@mechane/records';
import { ExecutionAccessReading, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import type { Redacted } from 'effect';
import { requestServiceKey } from './request-service-key.ts';

type ServiceOwner = { readonly settings: ObjectSettings; readonly workspaceId: WorkspaceId; readonly mechId: MechId };

type LoadedRequestService = {
  readonly service: RequestService;
  readonly token: Redacted.Redacted;
  readonly identity: string;
};

type LoadedService = Result.Result<LoadedRequestService, ExternalRequestUnavailable>;

type OpenWorkServiceInput = {
  readonly store: MechStore;
  readonly settings: ObjectSettings;
  readonly threadId: ThreadId;
};

/** Closed work cannot submit a new request or replace an existing wait. */
export async function loadOpenWorkService({ store, settings, threadId }: OpenWorkServiceInput): Promise<LoadedService> {
  const state = await store.atomic({ run: (tables) => ({ mech: tables.mech(), thread: tables.thread({ threadId }) }) });

  if (Option.isNone(state.mech) || Option.isNone(state.thread) || state.thread.value.state === ThreadState.Resolved) {
    const failure = new ExternalRequestUnavailable({
      reason: 'Open a work thread before requesting or waiting for access',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  const workspaceId = WorkspaceId.make(state.mech.value.workspaceId);
  const mechId = MechId.make(state.mech.value.id);

  return await loadRequestService({ settings, workspaceId, mechId });
}

/** The request credential remains host-only and is resolved anew for every submission and poll. */
async function loadRequestService({ settings, workspaceId, mechId }: ServiceOwner): Promise<LoadedService> {
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const request: Promise<unknown> = workspace.executionAccess({ mechId });
  const fetched = await capturePromise({ promise: request });

  if (Result.isFailure(fetched)) {
    const failure = new ExternalRequestUnavailable({
      reason: 'Execution access could not be read',
      recovery: ExternalRequestRecovery.Retry,
    });

    return Result.fail(failure);
  }

  const decoded = Schema.decodeUnknownResult(ExecutionAccessReading)(fetched.success);

  if (Result.isFailure(decoded) || ExecutionAccessReading.guards.MechNotFound(decoded.success)) {
    const failure = new ExternalRequestUnavailable({
      reason: 'Execution access is unavailable',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  const service = Option.flatMap(decoded.success.configuration.access, (access) => access.requestService);

  if (Option.isNone(service)) {
    const failure = new ExternalRequestUnavailable({
      reason: 'No request service is configured for this mech',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  const resolved = await resolveIntegrationSecret({
    settings,
    workspaceId,
    secretReference: service.value.secretReference,
  });

  if (Result.isFailure(resolved) || Option.isNone(resolved.success)) {
    const failure = new ExternalRequestUnavailable({
      reason: 'The request service credential is unavailable',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  const identity = requestServiceKey({ service: service.value });

  return Result.succeed({ service: service.value, token: resolved.success.value, identity });
}

type ReadStatusInput = ServiceOwner & {
  readonly kind: ExternalRequestKind;
  readonly requestId: ExternalRequestId;
  readonly expectedServiceIdentity: string;
  /** None means another caller created the request, so a missing request cannot be recreated by this host. */
  readonly submissionBody: Option.Option<string>;
  readonly isCurrent: () => Promise<boolean>;
};

/** Reconcile uncertain creation with the same frozen body and ID; a client timeout cannot duplicate an approval. */
export async function readRequestStatus({
  settings,
  workspaceId,
  mechId,
  kind,
  requestId,
  expectedServiceIdentity,
  submissionBody,
  isCurrent,
}: ReadStatusInput): Promise<RequestServiceOutcome> {
  const owner = { settings, workspaceId, mechId };
  const loaded = await loadRequestService(owner);

  if (Result.isFailure(loaded)) {
    return Result.fail(loaded.failure);
  }

  if (loaded.success.identity !== expectedServiceIdentity) {
    return changedService();
  }

  const emptyBody = Option.none<string>();

  const result = await readServiceRequest({
    ...loaded.success,
    kind,
    requestId,
    method: HttpMethod.Get,
    body: emptyBody,
  });

  if (
    Result.isSuccess(result) ||
    result.failure.recovery !== ExternalRequestRecovery.Missing ||
    Option.isNone(submissionBody)
  ) {
    return result;
  }

  if (!(await isCurrent())) {
    const failure = new ExternalRequestUnavailable({
      reason: 'This request wait is not currently runnable',
      recovery: ExternalRequestRecovery.Retry,
    });

    return Result.fail(failure);
  }

  const refreshed = await loadRequestService(owner);

  if (Result.isFailure(refreshed)) {
    return Result.fail(refreshed.failure);
  }

  if (refreshed.success.identity !== expectedServiceIdentity) {
    return changedService();
  }

  return await readServiceRequest({
    ...refreshed.success,
    kind,
    requestId,
    method: HttpMethod.Post,
    body: submissionBody,
  });
}

function changedService(): RequestServiceOutcome {
  const failure = new ExternalRequestUnavailable({
    reason: 'The request service grant changed while this work was waiting',
    recovery: ExternalRequestRecovery.Stop,
  });

  return Result.fail(failure);
}
