import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackInput } from './types.ts';

/** How long each alarm lets pi work once the crash restarts the deployment: one second, so each alarm hands pi on. */
const HAND_OFF_WORK_SECONDS = '1';

/**
 * Restarts the stack with alarms that hand pi on each second, until the scope closes and a last restart restores the
 * stack's own variables, however the scenario ends.
 */
export const handOffEachSecond = Effect.fn('handOffEachSecond')(function* ({
  stack,
}: StackInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const handOff = stack.restart({ variables: { alarmWorkSeconds: HAND_OFF_WORK_SECONDS } });
  const restoration = stack.restart({ variables: {} });

  // A release: a restart that fails leaves the scenarios after this one no stack, so the scenario dies.
  yield* Effect.acquireRelease(handOff, () => Effect.orDie(restoration));
});
