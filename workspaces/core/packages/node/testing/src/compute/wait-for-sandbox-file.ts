import type { LocalStack } from '@mechane/stack';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { waitFor } from '../wait-for.ts';

type SandboxFileInput = { readonly stack: LocalStack; readonly path: string; readonly contents: string };

export async function waitForSandboxFile(input: SandboxFileInput): Promise<string> {
  const found = await waitFor({
    name: 'the guest command to publish its side effect',
    read: () => findSandboxFile(input),
    accept: (file) => file !== undefined,
  });

  if (found === undefined) {
    throw new Error('The guest effect file disappeared');
  }

  return found;
}

async function findSandboxFile({ stack, path, contents }: SandboxFileInput): Promise<string | undefined> {
  const root = join(stack.stateDirectory, 'sandbox', 'machines');

  const machines = await readdir(root, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissing(error)) {
      return [];
    }

    throw error;
  });

  for (const machine of machines.filter((entry) => entry.isDirectory())) {
    const file = join(root, machine.name, 'home', path);

    const current = await readFile(file, 'utf8').catch((error: unknown) => {
      if (isMissing(error)) {
        return;
      }

      throw error;
    });

    if (current === contents) {
      return file;
    }
  }

  return undefined;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
