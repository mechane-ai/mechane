import { TurnCancelAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { AlarmDecision } from '../types.ts';
import { recordTurnCancel } from './record-turn-cancel.ts';
import type { RecordCancelInput } from './types.ts';

/**
 * Decides a member's cancel in one transaction: a running turn is canceled now, and a canceled one answers its first
 * cancel, so a retry finds it. An ended turn answers that it ended. Only the alarm stops a turn's work, so the decision
 * says whether the alarm has a turn to close.
 */
export function decideTurnCancel({
  store,
  turnId,
  cancelerId,
  now,
}: RecordCancelInput): AlarmDecision<TurnCancelAnswer> {
  const turn = store.turn({ turnId });

  if (Option.isNone(store.mech())) {
    return { answer: TurnCancelAnswer.cases.MechMissing.make({}), isAlarmDue: false };
  }

  if (Option.isNone(turn)) {
    return { answer: TurnCancelAnswer.cases.TurnMissing.make({}), isAlarmDue: false };
  }

  recordTurnCancel({ store, turnId, cancelerId, now });

  const cancel = store.turnCancel({ turnId });

  if (Option.isNone(cancel)) {
    return { answer: TurnCancelAnswer.cases.Ended.make({}), isAlarmDue: false };
  }

  return { answer: TurnCancelAnswer.cases.Canceled.make(cancel.value), isAlarmDue: true };
}
