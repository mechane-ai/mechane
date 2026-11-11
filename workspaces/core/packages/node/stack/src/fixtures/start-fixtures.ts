import { randomBytes, randomUUID } from 'node:crypto';
import type { LocalFixtures, LocalProviders } from '../types.ts';
import { startGitHubFixture } from './github.ts';
import { startModelFixture } from './model.ts';

const SIGNING_KEY_BYTES = 32;

type StartFixturesInput = { readonly origin: URL; readonly providers?: LocalProviders };

type StartSelectedFixtureInput<StartedFixture> = {
  readonly provider: LocalProviders['model'];
  readonly start: () => Promise<StartedFixture>;
};

export async function startFixtures({
  origin,
  providers = { model: 'fixture', github: 'fixture' },
}: StartFixturesInput): Promise<LocalFixtures> {
  const cleanup: Array<() => Promise<void>> = [];

  try {
    const github = await startSelectedFixture({ provider: providers.github, start: () => startGitHubFixture(origin) });

    if (github !== undefined) {
      cleanup.push(github.close);
    }

    const model = await startSelectedFixture({ provider: providers.model, start: () => startModelFixture() });

    if (model !== undefined) {
      cleanup.push(model.close);
    }

    return {
      github: github?.fixture,
      model: model?.fixture,
      notifications: { id: randomUUID(), signingSecret: randomBytes(SIGNING_KEY_BYTES).toString('hex') },
      close: async () => {
        await closeFixtures(cleanup);
      },
    };
  } catch (error) {
    await closeFixtures(cleanup);

    throw error;
  }
}

async function startSelectedFixture<StartedFixture>({
  provider,
  start,
}: StartSelectedFixtureInput<StartedFixture>): Promise<StartedFixture | undefined> {
  switch (provider) {
    case 'fixture':
      return await start();
    case 'live':
      return undefined;
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
