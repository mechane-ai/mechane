import { runStackProgram } from '@mechane/stack';
import type { StackOptions } from '@mechane/stack';
import type { Scenario } from '@mechane/testing';
import { runScenarios, writeStackStarted } from './run-scenarios.ts';
import type { ScenarioResult, StackScenarioResults } from './run-scenarios.ts';

type RunScenarioStacksInput = {
  readonly options: StackOptions;
  readonly catalog: ReadonlyArray<Scenario>;
  readonly stackCount: number;
};

type RunStackInput = { readonly index: number };

export async function runScenarioStacks({
  options,
  catalog,
  stackCount,
}: RunScenarioStacksInput): Promise<ReadonlyArray<StackScenarioResults>> {
  const inspections = catalog.filter((scenario) => scenario.isStackInspection === true);

  const pending = catalog
    .filter((scenario) => scenario.isStackInspection !== true)
    .toSorted((left, right) => (right.timeoutMs ?? 0) - (left.timeoutMs ?? 0));

  const count = Math.min(stackCount, Math.max(1, pending.length));
  const admission = { next: 0, hasFailed: false };

  async function runStack({ index }: RunStackInput): Promise<StackScenarioResults> {
    const scenarios: Array<ScenarioResult> = [];

    try {
      await runStackProgram({
        options,
        run: async ({ stack, signal }) => {
          writeStackStarted({ stack: index + 1, stateDirectory: stack.stateDirectory });

          try {
            while (!admission.hasFailed && !signal.aborted) {
              const scenario = pending[admission.next];

              if (scenario === undefined) {
                break;
              }

              admission.next += 1;

              const results = await runScenarios({ stack, catalog: [scenario] });

              scenarios.push(...results);
            }

            if (signal.aborted) {
              throw new Error('The smoke stack was interrupted');
            }

            if (inspections.length > 0) {
              const results = await runScenarios({ stack, catalog: inspections });

              scenarios.push(...results);
            }
          } catch (cause) {
            admission.hasFailed = true;

            throw cause;
          }
        },
      });

      return { stack: index + 1, scenarios };
    } catch (cause) {
      admission.hasFailed = true;

      throw cause;
    }
  }

  const workers = Array.from({ length: count }, (_value, index) => runStack({ index }));
  const outcomes = await Promise.allSettled(workers);
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected');

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure): unknown => failure.reason),
      'The smoke failed after joining every owned stack cleanup',
    );
  }

  return outcomes.filter((outcome) => outcome.status === 'fulfilled').map((outcome) => outcome.value);
}
