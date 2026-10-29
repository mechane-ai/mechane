import type { ClientFailure, OperationCall } from '@mechane/client';
import { ErrorFamily, PollStatus } from '@mechane/protocol';
import type { ApprovedPoll, DeviceApprovalPoll } from '@mechane/protocol';
import { Effect, Match, Option, Schedule } from 'effect';
import type { Duration, Redacted } from 'effect';
import type { ApprovalOperation } from './types.ts';

/** A device approval's poll, and how long to wait before each poll. */
type AwaitApprovalInput = {
  readonly call: OperationCall<ApprovalOperation>;
  readonly pollToken: Redacted.Redacted;
  readonly interval: Duration.Duration;
};

type PollAfterIntervalInput = AwaitApprovalInput;

/** The families of a poll's failure that the CLI polls again after: the deployment was unavailable or rate limited. */
const RETRIED_FAMILIES: ReadonlySet<ErrorFamily> = new Set([ErrorFamily.Unavailable, ErrorFamily.RateLimited]);

/** Whether a poll that failed so is polled again, under each tag of a call's failure. */
type RetriedFailures = {
  readonly [T in ClientFailure['_tag']]: (failure: Extract<ClientFailure, Readonly<Record<'_tag', T>>>) => boolean;
};

/** Whether a poll that failed so is polled again: one no server answered, or one a rate limit refused. */
const IS_RETRIED: Readonly<RetriedFailures> = {
  OriginUnreachable: () => true,
  RequestTimedOut: () => true,
  OperationFailed: ({ family }) => RETRIED_FAMILIES.has(family),
  ResponseUnreadable: () => false,
};

/**
 * Polls once each interval until the deployment answers that a browser approved, with the claimed key. A poll that no
 * server answered, or that a rate limit refused, is polled again, since the directory delivers a key at most once.
 */
export const awaitApproval = Effect.fn('awaitApproval')(function* ({
  call,
  pollToken,
  interval,
}: AwaitApprovalInput): Effect.fn.Return<ApprovedPoll, ClientFailure> {
  let answer = yield* pollAfterInterval({ call, pollToken, interval });

  while (answer.status === PollStatus.Pending) {
    answer = yield* pollAfterInterval({ call, pollToken, interval });
  }

  return answer;
});

/** The approval's answer to a poll after one interval, polled again after each failure that `IS_RETRIED` names. */
const pollAfterInterval = Effect.fn('pollAfterInterval')(function* ({
  call,
  pollToken,
  interval,
}: PollAfterIntervalInput): Effect.fn.Return<DeviceApprovalPoll, ClientFailure> {
  yield* Effect.sleep(interval);

  return yield* call({ name: 'pollDeviceApproval', input: { pollToken }, credential: Option.none() }).pipe(
    Effect.retry({ schedule: Schedule.spaced(interval), while: (failure) => Match.valueTags(failure, IS_RETRIED) }),
  );
});
