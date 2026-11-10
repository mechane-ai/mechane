import type { LocalStack } from '@mechane/stack';

export async function readSandboxMachines(stack: LocalStack): Promise<ReadonlyArray<string>> {
  if (stack.sandbox === undefined) {
    throw new Error('The smoke requires the owned container inventory');
  }

  const machines = await stack.sandbox.readMachines();

  return machines.toSorted();
}
