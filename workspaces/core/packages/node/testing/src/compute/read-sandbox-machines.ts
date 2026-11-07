import type { LocalStack } from '@mechane/stack';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function readSandboxMachines(stack: LocalStack): Promise<ReadonlyArray<string>> {
  try {
    const machines = await readdir(join(stack.stateDirectory, 'sandbox', 'machines'), { withFileTypes: true });

    return machines.filter((machine) => machine.isDirectory()).map((machine) => machine.name);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}
