import type { LocalStack } from '@mechane/stack';
import type { Scenario } from '@mechane/testing';
import type { ScenarioFamily } from './catalog.ts';

type ScenarioSelection = {
  readonly catalog: ReadonlyArray<Scenario>;
  readonly match?: string | undefined;
  readonly family?: ScenarioFamily | undefined;
};

type RunScenariosInput = Pick<ScenarioSelection, 'catalog'> & { readonly stack: LocalStack };

const SCENARIO_DEADLINE_MS = 180_000;

export function writeCatalogSummary({ catalog }: Pick<RunScenariosInput, 'catalog'>): void {
  const summary = {
    count: catalog.length,
    guarantees: catalog.map(({ guarantee }) => guarantee),
    families: [...new Set(catalog.map(({ family }) => family))],
  };

  process.stdout.write(`SMOKE_CATALOG_SUMMARY ${JSON.stringify(summary)}\n`);
}

export function selectScenarios({ catalog, match, family }: ScenarioSelection): ReadonlyArray<Scenario> {
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

export async function runScenarios({ stack, catalog }: RunScenariosInput): Promise<void> {
  for (const scenario of catalog) {
    const name = scenario.run.name;
    const replay = `mise -C workspaces/core exec -- node packages/node/smoke/src/main.ts ${name}`;

    process.stdout.write(`START ${name}\n`);

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
    } catch (cause) {
      const elapsedMs = Math.round(performance.now() - startedAt);

      throw new Error(`Smoke ${name} failed after ${elapsedMs} ms. Run locally with ${replay}`, { cause });
    } finally {
      clearTimeout(timer);
    }
  }
}
