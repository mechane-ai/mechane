import type { LocalFixtures, LocalStack } from '@mechane/stack';

export function requireFixtures(stack: LocalStack): LocalFixtures {
  if (stack.fixtures === undefined) {
    throw new Error('The smoke requires its local HTTP provider fixtures');
  }

  return stack.fixtures;
}
