import { DispatchStatus, EventType, SettlementBasis } from '@mechane/protocol';
import type { Dispatch, InboxItem } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { turnOutcome } from '@mechane/testing';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect } from 'effect';
import { pricedRequest } from './priced-request.ts';
import type { Charge } from './types.ts';

type DispatchesInput = { readonly dispatches: ReadonlyArray<Dispatch> };

type ChargedTurnInput = { readonly stack: Stack; readonly mech: TalkingMech; readonly text: string };

/** A turn a send started: its item, whether it answered with the text and was charged once, and what it saw. */
type ChargedTurn = {
  readonly sent: InboxItem;
  readonly isAnswered: boolean;
  readonly isCharged: boolean;
  readonly definitionRevision: number;
  readonly detail: string;
};

/**
 * Starts a turn with the text, which must answer with the text. Its trace must hold one dispatch, charged at the price
 * of the one request the upstream received meanwhile, from its usage at the staged rates.
 */
export const chargedTurn = Effect.fn('chargedTurn')(function* ({
  stack,
  mech,
  text,
}: ChargedTurnInput): Effect.fn.Return<ChargedTurn, ScenarioFailure> {
  const { sent, ended, requests, trace } = yield* mech.turn({ text });
  const priced = requests.map((request) => pricedRequest({ stack, request }));
  const charges = usageCharges({ dispatches: trace.dispatches });
  const dispatches = trace.dispatches.length;

  return {
    sent,
    isAnswered: ended.type === EventType.TurnAnswered && ended.reply === text,
    isCharged: priced.length === 1 && dispatches === 1 && JSON.stringify(charges) === JSON.stringify(priced),
    definitionRevision: trace.turn.definitionRevision,
    detail: `the turn of ${sent.id} used revision ${trace.turn.definitionRevision}, ended ${turnOutcome({ ended })}, and its trace charged ${JSON.stringify(charges)} of ${dispatches} dispatches for ${JSON.stringify(priced)}`,
  };
});

/** The charge of each dispatch the ledger settled from the usage the upstream reported. */
function usageCharges({ dispatches }: DispatchesInput): ReadonlyArray<Charge> {
  return dispatches
    .filter((dispatch) => dispatch.status === DispatchStatus.Settled)
    .filter((dispatch) => dispatch.basis === SettlementBasis.Usage)
    .map(({ inputTokens, outputTokens, settledMicros }) => ({ inputTokens, outputTokens, settledMicros }));
}
