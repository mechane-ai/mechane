import type { LocalStack } from '@mechane/stack';
import type { Scenario } from '@mechane/testing';
import type { ScenarioFamily } from './catalog.ts';

type RunScenariosInput = {
  readonly stack: LocalStack;
  readonly catalog: ReadonlyArray<Scenario>;
  readonly match?: string | undefined;
  readonly family?: ScenarioFamily | undefined;
};

const SCENARIO_DEADLINE_MS = 180_000;

export type ScenarioResult = { readonly guarantee: string; readonly elapsedMs: number };
export type StackScenarioResults = { readonly stack: number; readonly scenarios: ReadonlyArray<ScenarioResult> };

type WriteCatalogSummaryInput = {
  readonly catalog: ReadonlyArray<Scenario>;
  readonly results: ReadonlyArray<StackScenarioResults>;
};

type WriteStackStartedInput = { readonly stack: number; readonly stateDirectory: string };

export function writeStackStarted({ stack, stateDirectory }: WriteStackStartedInput): void {
  process.stdout.write(`SMOKE_STACK_STARTED ${JSON.stringify({ stack, stateDirectory })}\n`);
}

export function writeCatalogSummary({ catalog, results }: WriteCatalogSummaryInput): void {
  if (results.length === 0) {
    throw new Error('The smoke did not complete any owned stack');
  }

  const executions = results.flatMap(({ stack, scenarios }) => scenarios.map((scenario) => ({ stack, ...scenario })));
  const guarantees = new Set(catalog.map((scenario) => scenario.guarantee));

  if (guarantees.size !== catalog.length || executions.some((execution) => !guarantees.has(execution.guarantee))) {
    throw new Error('The smoke catalog contains duplicate or unexpected guarantees');
  }

  for (const scenario of catalog) {
    const completed = results.filter((result) =>
      result.scenarios.some((execution) => execution.guarantee === scenario.guarantee),
    );

    const count = executions.filter((execution) => execution.guarantee === scenario.guarantee).length;

    const expected: number = (() => {
      if (scenario.isStackInspection === true) {
        return results.length;
      }

      return 1;
    })();

    if (count !== expected || completed.length !== expected) {
      throw new Error(`The smoke did not complete the required stack coverage: ${scenario.guarantee}`);
    }
  }

  const summary = {
    count: catalog.length,
    guarantees: [...guarantees],
    families: [...new Set(catalog.map(({ family }) => family))],
    stackCount: results.length,
    stackInspections: catalog
      .filter((scenario) => scenario.isStackInspection === true)
      .map(({ guarantee }) => guarantee),
    executions,
  };

  process.stdout.write(`SMOKE_CATALOG_SUMMARY ${JSON.stringify(summary)}\n`);
}

type SelectScenariosInput = Omit<RunScenariosInput, 'stack'>;

export function selectScenarios({ catalog, match, family }: SelectScenariosInput): ReadonlyArray<Scenario> {
  const selected = catalog.filter((scenario) => {
    const isFamily = family === undefined || scenario.family === family;
    const isMatch = match === undefined || scenario.run.name === match || scenario.guarantee.includes(match);

    return isFamily && isMatch;
  });

  if (selected.length === 0) {
    throw new Error(`No smoke scenario matches ${String(match)} in family ${String(family)}`);
  }

  return selected;
}

export async function runScenarios({
  stack,
  catalog,
  match,
  family,
}: RunScenariosInput): Promise<ReadonlyArray<ScenarioResult>> {
  const selected = selectScenarios({ catalog, match, family });
  const results: Array<ScenarioResult> = [];

  for (const scenario of selected) {
    const deadline = Promise.withResolvers<never>();
    const startedAt = performance.now();

    const timer = setTimeout(
      () => deadline.reject(new Error(`The smoke timed out: ${scenario.guarantee}`)),
      scenario.timeoutMs ?? SCENARIO_DEADLINE_MS,
    );

    try {
      await Promise.race([scenario.run({ stack, guarantee: scenario.guarantee }), deadline.promise]);

      const elapsedMs = Math.round(performance.now() - startedAt);

      results.push({ guarantee: scenario.guarantee, elapsedMs });

      process.stdout.write(`PASS ${scenario.guarantee} (${elapsedMs} ms)\n`);
    } finally {
      clearTimeout(timer);
    }
  }

  return results;
}
