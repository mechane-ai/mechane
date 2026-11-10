import type { LocalStack } from '@mechane/stack';
import type { Scenario } from '@mechane/testing';

type RunScenariosInput = {
  readonly stack: LocalStack;
  readonly catalog: ReadonlyArray<Scenario>;
  readonly match?: string | undefined;
};

const SCENARIO_DEADLINE_MS = 180_000;

export async function runScenarios({ stack, catalog, match }: RunScenariosInput): Promise<void> {
  const selected = catalog.filter(
    (scenario) => match === undefined || scenario.run.name === match || scenario.guarantee.includes(match),
  );

  if (selected.length === 0) {
    throw new Error(`No smoke scenario matches ${match}`);
  }

  for (const scenario of selected) {
    const deadline = Promise.withResolvers<never>();

    const timer = setTimeout(
      () => deadline.reject(new Error(`The smoke timed out: ${scenario.guarantee}`)),
      SCENARIO_DEADLINE_MS,
    );

    try {
      await Promise.race([scenario.run({ stack, guarantee: scenario.guarantee }), deadline.promise]);
      process.stdout.write(`PASS ${scenario.guarantee}\n`);
    } finally {
      clearTimeout(timer);
    }
  }
}
