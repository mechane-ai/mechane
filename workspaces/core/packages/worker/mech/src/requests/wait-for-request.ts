import type { RequestWaitInput } from '@mechane/harness-tools';
import {
  ExternalRequestRecovery,
  ExternalRequestState,
  ExternalRequestUnavailable,
  ThreadState,
} from '@mechane/protocol';
import type { ExternalRequestStatus } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import { DateTime, Duration, Option, Result } from 'effect';
import type { MechRequestsInput } from './types.ts';

const MAXIMUM_WAIT = Duration.days(1);

type RegisterWaitInput = MechRequestsInput &
  RequestWaitInput & { readonly status: ExternalRequestStatus; readonly serviceIdentity: string };

/** The tool returns immediately; the host alarm observes the external decision and resumes this same work. */
export async function registerRequestWait({
  store,
  signal,
  recorded,
  status,
  ...input
}: RegisterWaitInput): Promise<Result.Result<ExternalRequestStatus, ExternalRequestUnavailable>> {
  if (status.status !== ExternalRequestState.Pending) {
    return Result.succeed(status);
  }

  const now = DateTime.nowUnsafe();

  const registered = await store.atomic({
    run: (tables) => {
      const prior = tables.requestWait(input);

      if (Option.isSome(prior)) {
        if (Option.isNone(prior.value.nextPollAt) && Option.isNone(prior.value.result)) {
          const failure = new ExternalRequestUnavailable({
            reason: 'This request wait was replaced or canceled',
            recovery: ExternalRequestRecovery.Stop,
          });

          return Result.fail(failure);
        }

        const previousResult = Option.getOrElse(prior.value.result, () => status);

        return Result.succeed(previousResult);
      }

      const thread = tables.thread(input);

      if (Option.isNone(thread) || thread.value.state === ThreadState.Resolved) {
        const failure = new ExternalRequestUnavailable({
          reason: 'This work is no longer open; no request wait was started',
          recovery: ExternalRequestRecovery.Stop,
        });

        return Result.fail(failure);
      }

      const inboxItemId = InboxItemId.make(crypto.randomUUID());
      const expiresAt = DateTime.addDuration(now, MAXIMUM_WAIT);
      const note = Option.none<string>();

      tables.beginRequestWait({ ...input, inboxItemId, now, expiresAt });
      tables.updateThread({ threadId: input.threadId, state: ThreadState.Waiting, note, now });

      return Result.succeed(status);
    },
  });

  signal.wake();
  recorded.mark();

  return registered;
}
