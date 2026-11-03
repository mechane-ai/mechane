import type { BoundedTurnSubmission } from '@mechane/protocol';
import { BoundedTurnLimitReason, Delivery, MechStatus, UnansweredReason } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import { BoundedTurnAnswer } from '@mechane/rpc';
import type { BoundedTurnInput, CancelBoundedTurnInput } from '@mechane/rpc';
import { DateTime, Option } from 'effect';
import { decideInboxItemReceipt } from '../inbox/decide-inbox-item-receipt.ts';
import { recordTurnCancel } from '../turns/record-turn-cancel.ts';
import type { AlarmDecision, NowInput, TablesInput } from '../types.ts';

type SubmitInput = TablesInput &
  NowInput &
  BoundedTurnInput & { readonly submission: BoundedTurnSubmission; readonly senderId: PrincipalId };

type BoundedDecision = AlarmDecision<Option.Option<BoundedTurnAnswer>>;
type RejectedInput = { readonly answer: BoundedTurnAnswer };

/** An accepted retry never changes its budget or creates another inbox item. */
export function decideBoundedTurn({ store, requestId, submission, senderId, now }: SubmitInput): BoundedDecision {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    const answer = BoundedTurnAnswer.cases.MechMissing.make({});

    return rejected({ answer });
  }

  const existing = store.boundedTurn({ requestId });

  if (Option.isSome(existing)) {
    const previous = existing.value;

    const hasSameLimits =
      previous.maxModelDispatches === submission.maxModelDispatches &&
      previous.maxOutputTokens === submission.maxOutputTokens;

    const hasSameDeadline =
      DateTime.toEpochMillis(previous.deadlineAt) === DateTime.toEpochMillis(submission.deadlineAt);

    const isSame = previous.text === submission.text && hasSameLimits && hasSameDeadline;

    if (!isSame) {
      const answer = BoundedTurnAnswer.cases.Conflicting.make({});

      return rejected({ answer });
    }

    return { answer: Option.none(), isAlarmDue: Option.isNone(previous.endedAt) };
  }

  const existingItem = store.inboxItem({ inboxItemId: requestId });

  if (Option.isSome(existingItem)) {
    const answer = BoundedTurnAnswer.cases.Conflicting.make({});

    return rejected({ answer });
  }

  if (mech.value.status === MechStatus.Archived) {
    const answer = BoundedTurnAnswer.cases.Archived.make({});

    return rejected({ answer });
  }

  decideInboxItemReceipt({
    store,
    inboxItemId: requestId,
    text: submission.text,
    delivery: Delivery.WhenIdle,
    senderId,
    now,
  });
  store.recordBoundedTurn({ requestId, ...submission });
  advanceBoundedTurns({ store, now });

  return { answer: Option.none(), isAlarmDue: true };
}

/** A queued cancel is terminal immediately; the alarm retires any Pi submission before further work. */
export function cancelBoundedTurn({
  store,
  requestId,
  cancelerId,
  now,
}: TablesInput & NowInput & CancelBoundedTurnInput): BoundedDecision {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    const answer = BoundedTurnAnswer.cases.MechMissing.make({});

    return rejected({ answer });
  }

  const request = store.boundedTurn({ requestId });

  if (Option.isNone(request)) {
    const answer = BoundedTurnAnswer.cases.RequestMissing.make({});

    return rejected({ answer });
  }

  if (Option.isSome(request.value.endedAt)) {
    return { answer: Option.none(), isAlarmDue: false };
  }

  store.stopBoundedTurn({ requestId, reason: UnansweredReason.Canceled, now });

  if (Option.isSome(request.value.turnId)) {
    recordTurnCancel({ store, turnId: request.value.turnId.value, cancelerId, now });
  }

  return { answer: Option.none(), isAlarmDue: true };
}

/** The host alarm owns expiry even when the sender disconnects or the mech pauses. */
export function advanceBoundedTurns({ store, now }: TablesInput & NowInput): void {
  for (const request of store.expiredBoundedTurns({ now })) {
    store.stopBoundedTurn({ requestId: request.requestId, reason: BoundedTurnLimitReason.DeadlineExceeded, now });

    if (Option.isSome(request.turnId)) {
      recordTurnCancel({ store, turnId: request.turnId.value, cancelerId: request.senderId, now });
    }
  }
}

function rejected({ answer }: RejectedInput): BoundedDecision {
  return { answer: Option.some(answer), isAlarmDue: false };
}
