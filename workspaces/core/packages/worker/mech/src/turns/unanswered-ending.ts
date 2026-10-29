import { EventType, TurnStatus } from '@mechane/protocol';
import type { UnansweredReason } from '@mechane/protocol';
import type { TurnId } from '@mechane/records';
import type { TurnEnding } from './types.ts';

/** The turn that ends without an answer, and why. */
type UnansweredEndingInput = { readonly turnId: TurnId; readonly reason: UnansweredReason };

/** The unanswered end of a turn for its reason, and its `turn.unanswered` event. */
export function unansweredEnding({ turnId, reason }: UnansweredEndingInput): TurnEnding {
  return { end: { status: TurnStatus.Unanswered, reason }, event: { type: EventType.TurnUnanswered, turnId, reason } };
}
