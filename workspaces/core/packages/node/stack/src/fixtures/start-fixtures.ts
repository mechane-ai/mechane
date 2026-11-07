import type { LocalFixtures } from '../types.ts';
import { startGitHubFixture } from './github.ts';
import { startModelFixture } from './model.ts';
import { startNexusFixture } from './nexus.ts';
import { startSlackFixture } from './slack.ts';

export async function startFixtures(origin: URL): Promise<LocalFixtures> {
  const cleanup: Array<() => Promise<void>> = [];

  try {
    const github = await startGitHubFixture(origin);

    cleanup.push(github.close);

    const model = await startModelFixture();

    cleanup.push(model.close);

    const slack = await startSlackFixture();

    cleanup.push(slack.close);

    const nexus = await startNexusFixture();

    cleanup.push(nexus.close);

    return {
      github: github.fixture,
      model: model.fixture,
      slack: slack.fixture,
      nexus: nexus.fixture,
      close: async () => {
        await closeFixtures(cleanup);
      },
    };
  } catch (error) {
    await closeFixtures(cleanup);

    throw error;
  }
}

async function closeFixtures(cleanup: ReadonlyArray<() => Promise<void>>): Promise<void> {
  const outcomes = await Promise.allSettled(cleanup.map((close) => close()));
  const failures = outcomes.filter((outcome) => outcome.status === 'rejected');

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure): unknown => failure.reason),
      'Could not close the local provider fixtures',
    );
  }
}
