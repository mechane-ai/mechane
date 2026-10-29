import { EventType } from '@mechane/protocol';
import { Option } from 'effect';
import type { RecordCancelInput } from './types.ts';

/**
 * Records a cancel on a running turn not canceled yet, with its event, in the caller's transaction. From then on the
 * turn ends unanswered, canceled, whatever pi reports, and the alarm stops its work.
 */
export function recordTurnCancel({ store, turnId, cancelerId, now }: RecordCancelInput): void {
  if (Option.isSome(store.cancelTurn({ turnId, cancelerId, now }))) {
    store.appendEvent({ event: { type: EventType.TurnCanceled, turnId, cancelerId }, now });
  }
}
