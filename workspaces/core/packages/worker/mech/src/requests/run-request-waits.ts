import type { MechStore, RequestWaitRow } from '@mechane/mech-store';
import { ExternalRequestRecovery, ExternalRequestState, MechStatus } from '@mechane/protocol';
import type { ExternalRequestStatus } from '@mechane/protocol';
import { MechId, WorkspaceId } from '@mechane/records';
import type { ObjectSettings } from '@mechane/rpc';
import { DateTime, Duration, Option, Result } from 'effect';
import { notifyAutomaticAccess } from './notify-automatic-access.ts';
import { readRequestStatus } from './request-service.ts';

type RequestWaitInput = { readonly store: MechStore; readonly settings: ObjectSettings };

type RequestPollInput = RequestWaitInput & {
  readonly workspaceId: WorkspaceId;
  readonly mechId: MechId;
  readonly wait: RequestWaitRow;
};

const REQUEST_POLL_INTERVAL = Duration.seconds(30);
const REQUEST_RETRY_INTERVAL = Duration.minutes(1);
const REQUEST_POLLS_PER_ROUND = 4;

/** Polls only persisted waits through the host credential; pending decisions consume no model turn. */
export async function runRequestWaits({ store, settings }: RequestWaitInput): Promise<void> {
  const now = DateTime.nowUnsafe();

  const current = await store.atomic({
    run: (tables) => ({ mech: tables.mech(), due: tables.dueRequestWaits({ now }) }),
  });

  if (Option.isNone(current.mech) || current.mech.value.status !== MechStatus.Active) {
    return;
  }

  const workspaceId = WorkspaceId.make(current.mech.value.workspaceId);
  const mechId = MechId.make(current.mech.value.id);

  for (const wait of current.due.slice(0, REQUEST_POLLS_PER_ROUND)) {
    await pollRequestWait({ store, settings, workspaceId, mechId, wait });
  }
}

async function pollRequestWait({ store, settings, workspaceId, mechId, wait }: RequestPollInput): Promise<void> {
  const now = DateTime.nowUnsafe();
  const isExpired = DateTime.isLessThanOrEqualTo(wait.expiresAt, now);

  if (isExpired) {
    return await settleLocalFailure({
      store,
      wait,
      status: ExternalRequestState.Expired,
      error: 'The external request wait expired.',
    });
  }

  const current = await store.atomic({
    run: (tables) => ({
      wait: tables.requestWait({ taskId: wait.taskId }),
      submission: tables.requestSubmission({ taskId: wait.taskId }),
    }),
  });

  if (Option.isNone(current.wait) || Option.isNone(current.wait.value.nextPollAt)) {
    return;
  }

  const submissionBody = Option.map(current.submission, (saved) => saved.body);

  async function isCurrent(): Promise<boolean> {
    const latest = await store.atomic({
      run: (tables) => ({ mech: tables.mech(), wait: tables.requestWait({ taskId: wait.taskId }) }),
    });

    if (Option.isNone(latest.mech) || latest.mech.value.status !== MechStatus.Active || Option.isNone(latest.wait)) {
      return false;
    }

    const checkedAt = DateTime.nowUnsafe();

    return Option.isSome(latest.wait.value.nextPollAt) && DateTime.isLessThan(checkedAt, latest.wait.value.expiresAt);
  }

  const response = await readRequestStatus({
    settings,
    workspaceId,
    mechId,
    kind: wait.kind,
    requestId: wait.requestId,
    expectedServiceIdentity: wait.serviceIdentity,
    submissionBody,
    isCurrent,
  });

  const receivedAt = DateTime.nowUnsafe();

  if (DateTime.isLessThanOrEqualTo(wait.expiresAt, receivedAt)) {
    return await settleLocalFailure({
      store,
      wait,
      status: ExternalRequestState.Expired,
      error: 'The external request wait expired.',
    });
  }

  if (Result.isFailure(response)) {
    if (response.failure.recovery !== ExternalRequestRecovery.Retry) {
      return await settleLocalFailure({
        store,
        wait,
        status: ExternalRequestState.Failed,
        error: response.failure.reason,
      });
    }

    return await deferRequestWait({ store, wait, interval: REQUEST_RETRY_INTERVAL });
  }

  if (response.success.status === ExternalRequestState.Pending) {
    return await deferRequestWait({ store, wait, interval: REQUEST_POLL_INTERVAL });
  }

  const finishedAt = DateTime.nowUnsafe();

  await store.atomic({
    run: (tables) => {
      tables.settleRequestWait({ taskId: wait.taskId, result: response.success, now: finishedAt });

      const saved = tables.requestWait({ taskId: wait.taskId });
      const result = Option.flatMap(saved, (record) => record.result);

      if (Option.isNone(result) || result.value.status !== ExternalRequestState.Ready) {
        return;
      }

      const capability = Option.none<string>();
      const authorization = Option.fromUndefinedOr(result.value.authorization);

      notifyAutomaticAccess({
        store: tables,
        taskId: wait.taskId,
        threadId: wait.threadId,
        capability,
        authorization,
        now: finishedAt,
      });
    },
  });
}

type LocalFailureInput = {
  readonly store: MechStore;
  readonly wait: RequestWaitRow;
  readonly status: typeof ExternalRequestState.Expired | typeof ExternalRequestState.Failed;
  readonly error: string;
};

async function settleLocalFailure({ store, wait, status, error }: LocalFailureInput): Promise<void> {
  const result: ExternalRequestStatus = {
    id: wait.requestId,
    kind: wait.kind,
    status,
    approval: Option.none(),
    error: Option.some(error),
  };

  const now = DateTime.nowUnsafe();

  await store.atomic({ run: (tables) => tables.settleRequestWait({ taskId: wait.taskId, result, now }) });
}

type DeferWaitInput = {
  readonly store: MechStore;
  readonly wait: RequestWaitRow;
  readonly interval: Duration.Duration;
};

async function deferRequestWait({ store, wait, interval }: DeferWaitInput): Promise<void> {
  const now = DateTime.nowUnsafe();
  const nextPollAt = DateTime.addDuration(now, interval);

  await store.atomic({ run: (tables) => tables.deferRequestWait({ taskId: wait.taskId, nextPollAt }) });
}
