import type { AccessRequestInput, MechRequests, TaskContext } from '@mechane/harness-tools';
import { readServiceRequest } from '@mechane/integrations';
import {
  ExternalRequestKind,
  ExternalRequestRecovery,
  ExternalRequestState,
  ExternalRequestUnavailable,
} from '@mechane/protocol';
import type { ExternalRequestStatus } from '@mechane/protocol';
import { ExternalRequestId, HttpMethod } from '@mechane/records';
import { DateTime, Option, Result } from 'effect';
import { notifyAutomaticAccess } from './notify-automatic-access.ts';
import { loadOpenWorkService } from './request-service.ts';
import { readTaskContext } from './task-context.ts';
import type { MechRequestsInput } from './types.ts';
import { registerRequestWait } from './wait-for-request.ts';

type RequestAccessInput = MechRequestsInput & AccessRequestInput;

/** Save creation identity and payload before transport, including work recovered after a lost response. */
export async function requestAccess({
  store,
  settings,
  signal,
  recorded,
  taskId,
  threadId,
  capability,
  reason,
  minutes,
}: RequestAccessInput): ReturnType<MechRequests['request']> {
  const owner = { store, settings, signal, recorded };
  const loaded = await loadOpenWorkService({ store, settings, threadId });

  if (Result.isFailure(loaded)) {
    return Result.fail(loaded.failure);
  }

  const now = DateTime.nowUnsafe();
  const requestId = ExternalRequestId.make(crypto.randomUUID());
  const workThread = Option.some(threadId);

  const saved = await store.atomic({
    run: (tables) => {
      const task = readTaskContext({ store: tables, threadId: workThread });
      const body = accessBody({ requestId, capability, reason, minutes, task });

      return tables.beginRequestSubmission({
        taskId,
        threadId,
        requestId,
        serviceIdentity: loaded.success.identity,
        body,
        now,
      });
    },
  });

  if (saved.serviceIdentity !== loaded.success.identity) {
    const failure = new ExternalRequestUnavailable({
      reason: 'The request service changed after this access request was submitted',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  const submissionBody = Option.some(saved.body);

  const result = await readServiceRequest({
    ...loaded.success,
    kind: ExternalRequestKind.Access,
    requestId: saved.requestId,
    method: HttpMethod.Post,
    body: submissionBody,
  });

  if (Result.isFailure(result) && result.failure.recovery !== ExternalRequestRecovery.Retry) {
    return Result.fail(result.failure);
  }

  const status = Result.getOrElse(result, ({ reason: failureReason }): ExternalRequestStatus => ({
    id: saved.requestId,
    kind: ExternalRequestKind.Access,
    status: ExternalRequestState.Pending,
    approval: Option.none(),
    error: Option.some(failureReason),
  }));

  if (status.status === ExternalRequestState.Ready) {
    const notice = {
      taskId,
      threadId,
      capability: Option.some(capability),
      authorization: Option.fromUndefinedOr(status.authorization),
      now: DateTime.nowUnsafe(),
    };

    await store.atomic({ run: (tables) => notifyAutomaticAccess({ store: tables, ...notice }) });
    signal.wake();
    recorded.mark();
  }

  return await registerRequestWait({
    ...owner,
    taskId,
    threadId,
    kind: ExternalRequestKind.Access,
    requestId: saved.requestId,
    serviceIdentity: loaded.success.identity,
    status,
  });
}

type AccessBodyInput = Pick<AccessRequestInput, 'capability' | 'reason' | 'minutes'> & {
  readonly requestId: ExternalRequestId;
  /** None means the work has no unambiguous verified requester origin. */
  readonly task: Option.Option<TaskContext>;
};

function accessBody({ requestId, capability, reason, minutes, task }: AccessBodyInput): string {
  const duration = Option.match(minutes, { onNone: () => ({}), onSome: (value) => ({ minutes: value }) });

  const context = Option.match(task, {
    onNone: () => ({}),
    onSome: ({ slack, ...fields }) => ({
      task: { ...fields, ...Option.match(slack, { onNone: () => ({}), onSome: (value) => ({ slack: value }) }) },
    }),
  });

  return JSON.stringify({ id: requestId, capability, reason, ...duration, ...context });
}
