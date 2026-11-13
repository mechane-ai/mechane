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

export function writeCatalogSummary({ catalog }: Pick<RunScenariosInput, 'catalog'>): void {
  const summary = {
    count: catalog.length,
    guarantees: catalog.map(({ guarantee }) => guarantee),
    families: [...new Set(catalog.map(({ family }) => family))],
  };

  process.stdout.write(`SMOKE_CATALOG_SUMMARY ${JSON.stringify(summary)}\n`);
}

export async function runScenarios({ stack, catalog, match, family }: RunScenariosInput): Promise<void> {
  const selected = catalog.filter((scenario) => {
    const isFamily = family === undefined || scenario.family === family;
    const isMatch = match === undefined || scenario.run.name === match || scenario.guarantee.includes(match);

    return isFamily && isMatch;
  });

  if (selected.length === 0) {
    throw new Error(`No smoke scenario matches ${String(match)} in family ${String(family)}`);
  }

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

      process.stdout.write(`PASS ${scenario.guarantee} (${elapsedMs} ms)\n`);
    } finally {
      clearTimeout(timer);
    }
  }
}
