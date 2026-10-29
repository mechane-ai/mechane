import { SandboxProvider } from '@mechane/deployment';
import { loadStackSettings, startStack } from '@mechane/stack';
import type { StackFailed } from '@mechane/stack';
import { settleScenarios } from '@mechane/testing';
import type { ScenarioFailure, ScenariosFailed } from '@mechane/testing';
import { Effect } from 'effect';
import type { Exit, Scope } from 'effect';
import { CATALOG } from './catalog.ts';

/**
 * The variables the smoke's stack sets: a named key lives three seconds, so a scenario sees one expire, and a login key
 * keeps the deployment's lifetime. The CLI polls a device approval again at once, since the smoke's browser approves
 * within a fraction of a second. Each wait of the deployment's two seconds would hold a scenario that long.
 */
const STACK_VARIABLES = { namedKeyLifetimeSeconds: '3', approvalPollIntervalSeconds: '0' } as const;

/** One scenario of the catalog. */
type Scenario = (typeof CATALOG)[number];

/**
 * Starts a fresh local stack with host sandboxes, whose scenarios need no Docker. Runs every scenario of the catalog
 * against it, one after another, in the scope that stops the stack.
 */
export const runScenarios = Effect.fn('runScenarios')(function* (): Effect.fn.Return<
  void,
  StackFailed | ScenariosFailed,
  Scope.Scope
> {
  const stack = yield* startStack({
    settings: yield* loadStackSettings(),
    variables: STACK_VARIABLES,
    sandboxProvider: SandboxProvider.Host,
  });

  const runOne: (scenario: Scenario) => Effect.Effect<Exit.Exit<void, ScenarioFailure>> = ({ run, guarantee }) =>
    Effect.exit(run({ stack, guarantee }));

  const exits = yield* Effect.forEach(CATALOG, runOne, { concurrency: 1 });

  yield* settleScenarios({ stack, exits });
});
