import { Mech } from '@mechane/protocol';
import { check, signedInMech } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { chargedTurn } from './charged-turn.ts';
import { ScenarioText } from './constants.ts';

/** The requests the upstream receives for the scenario's two items: one each, and none for the resend. */
const ANSWERED_REQUESTS = 2;

/**
 * Sends an inbox item to a mech of the echo offer and follows its turn to the reply, which one dispatch charges once. A
 * rename changes the definition while keeping identity. A resend under the item's id must start no turn, so the second
 * item's turn is the next to end, and the upstream receives two requests in all.
 */
export const inboxItemIsAnsweredAndChargedOnce = Effect.fn('inboxItemIsAnsweredAndChargedOnce')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const before = stack.modelUpstream.requests().length;
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const first = yield* chargedTurn({ stack, mech, text: ScenarioText.First });

  const renamed = yield* mech.command({
    words: ['mech', 'rename'],
    ids: ['--expected-revision', '1', '--name', 'renamed'],
    result: Mech,
  });

  const resent = yield* mech.resend({ text: ScenarioText.First, inboxItemId: first.sent.id });
  const second = yield* chargedTurn({ stack, mech, text: ScenarioText.Second });
  const requests = stack.modelUpstream.requests().length - before;

  yield* check({
    name: guarantee,
    conditions: [
      first.isAnswered,
      first.isCharged,
      renamed.id === mech.id,
      first.definitionRevision === 1 && second.definitionRevision === renamed.revision,
      resent.id === first.sent.id,
      second.isAnswered,
      second.isCharged,
      requests === ANSWERED_REQUESTS,
    ],
    detail: `${first.detail}; renamed ${mech.id} to ${renamed.id} at revision ${renamed.revision}; the resend answered ${resent.id}; ${second.detail}; the upstream received ${requests} requests`,
  });
}, Effect.scoped);
