import { runStackProgram } from '@mechane/stack';
import type { DevelopmentScenarioInput, StackOptions } from '@mechane/stack';
import { CATALOG } from '../catalog.ts';
import { runScenarios } from '../run-scenarios.ts';

const TEST_SCOPE_DESCRIPTIONS = Object.freeze({
  retained: 'retained development fixture stack (workspace-scoped scenario)',
  isolated: 'isolated source fixture stack',
});

type DevTestScope = keyof typeof TEST_SCOPE_DESCRIPTIONS;

class DevelopmentScenarioError extends Error {
  readonly _tag = 'DevelopmentScenarioError';
  override readonly name = 'DevelopmentScenarioError';
}

export async function runDevelopmentScenario({
  stack,
  name,
  environment,
  nodeExecutable,
  celldBinary,
  write,
}: DevelopmentScenarioInput): Promise<void> {
  const scenario = CATALOG.find((candidate) => candidate.run.name === name);

  if (scenario === undefined) {
    const names = CATALOG.map((candidate) => candidate.run.name);

    throw new DevelopmentScenarioError(`Unknown smoke scenario ${name}; choose one of ${names.join(', ')}`);
  }

  const canUseRetainedStack = 'canUseRetainedStack' in scenario && scenario.canUseRetainedStack;
  const hasFixtureProviders = stack.providers.model === 'fixture' && stack.providers.github === 'fixture';

  const scope: DevTestScope = (() => {
    if (canUseRetainedStack && hasFixtureProviders) {
      return 'retained';
    }

    return 'isolated';
  })();

  const description = TEST_SCOPE_DESCRIPTIONS[scope];

  const binaryOptions: Pick<StackOptions, 'celldBinary'> = (() => {
    if (celldBinary === undefined) {
      return {};
    }

    return { celldBinary };
  })();

  await write({ channel: 'stdout', text: `Running ${name} on the ${description}\n` });

  switch (scope) {
    case 'retained':
      try {
        await runScenarios({ stack, catalog: [scenario], match: name });
      } catch (cause) {
        const evidence = await stack.captureFailure('dev-scenario-failure').catch((captureCause: unknown) => {
          throw new AggregateError(
            [cause, captureCause],
            'The dev scenario failed and its evidence could not be saved',
            { cause },
          );
        });

        await write({
          channel: 'stderr',
          text: `Private failure evidence: ${evidence}\nRemove that folder after review.\n`,
        });

        throw cause;
      }

      break;
    case 'isolated':
      await runStackProgram({
        options: {
          mode: 'ephemeral',
          isSource: true,
          isConsoleDevelopment: scenario.family === 'console',
          sandbox: 'container',
          providers: { model: 'fixture', github: 'fixture' },
          nodeExecutable,
          environment,
          ...binaryOptions,
        },
        run: async ({ stack: isolatedStack }) => {
          await runScenarios({ stack: isolatedStack, catalog: [scenario], match: name });
        },
      });

      break;
  }

  await write({ channel: 'stdout', text: `PASS ${scenario.guarantee} (${description})\n` });
}
