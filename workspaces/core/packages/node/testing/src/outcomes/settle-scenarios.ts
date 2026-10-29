import { failureLine, writeDiagnostic } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import { Effect, Exit, Option } from 'effect';
import type { Cause } from 'effect';
import { ScenariosFailed } from '../errors.ts';
import type { ScenarioFailure } from '../types.ts';
import { SMOKE_PROGRAM } from './constants.ts';
import { smokeFailureMessage } from './smoke-failure-message.ts';

type SettleScenariosInput = { readonly stack: Stack; readonly exits: ReadonlyArray<Exit.Exit<void, ScenarioFailure>> };

/** Fails when any scenario failed, after writing each failure and where the stack's log stays. */
export const settleScenarios = Effect.fn('settleScenarios')(function* ({
  stack,
  exits,
}: SettleScenariosInput): Effect.fn.Return<void, ScenariosFailed> {
  const exitCause: (exit: Exit.Exit<void, ScenarioFailure>) => ReadonlyArray<Cause.Cause<ScenarioFailure>> = (exit) =>
    Option.toArray(Exit.getCause(exit));

  const causes = exits.flatMap(exitCause);

  if (causes.length === 0) {
    return;
  }

  for (const cause of causes) {
    const line = failureLine({ cause, operation: 'run a scenario', describe: smokeFailureMessage });

    writeDiagnostic({ program: SMOKE_PROGRAM, line });
  }

  writeDiagnostic({ program: SMOKE_PROGRAM, line: `the stack's celld log stays at ${stack.logFile}` });

  return yield* new ScenariosFailed({ failedScenarios: causes.length });
});
