import { DispatchStatus, EventType, UnansweredReason } from '@mechane/protocol';
import { check, signedInMech, turnOutcome } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { ScenarioText } from './constants.ts';

/**
 * Sends an inbox item to a mech of the costly offer, whose bound no day's allowance covers. Its turn must end
 * allowance_exhausted, the upstream must receive no request, and the trace must hold the one refused dispatch.
 */
export const uncoverableDispatchIsRefusedUnsent = Effect.fn('uncoverableDispatchIsRefusedUnsent')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'costly' });
  const { ended, requests, trace } = yield* mech.turn({ text: ScenarioText.Costly });
  const statuses = trace.dispatches.map((dispatch) => dispatch.status);

  yield* check({
    name: guarantee,
    conditions: [
      ended.type === EventType.TurnUnanswered && ended.reason === UnansweredReason.AllowanceExhausted,
      requests.length === 0,
      statuses.length === 1,
      statuses[0] === DispatchStatus.Refused,
    ],
    detail: `the turn ended ${turnOutcome({ ended })}; the upstream received ${requests.length} requests; the trace holds dispatches ${statuses.join(', ')}`,
  });
}, Effect.scoped);
