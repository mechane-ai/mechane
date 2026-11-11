import type { LocalFixtures, LocalStack } from '@mechane/stack';

type CompleteLocalFixtures = LocalFixtures & {
  readonly github: NonNullable<LocalFixtures['github']>;
  readonly model: NonNullable<LocalFixtures['model']>;
};

export function requireFixtures(stack: LocalStack): CompleteLocalFixtures {
  const fixtures = stack.fixtures;

  if (fixtures === undefined || fixtures.github === undefined || fixtures.model === undefined) {
    throw new Error('The smoke requires its local HTTP provider fixtures');
  }

  return { ...fixtures, github: fixtures.github, model: fixtures.model };
}
