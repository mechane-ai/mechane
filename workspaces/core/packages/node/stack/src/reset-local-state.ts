import { Result, Schema } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import { access, lstat, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { runCommand } from './process.ts';
import type { Environment } from './types.ts';

const PRIVATE_FILE_MODE = 0o600;
const NODE_ID_CHARACTERS = 12;
const INSPECTION_TIMEOUT_MS = 10_000;

const StackMarker = Schema.fromJsonString(
  Schema.Struct({
    postgresPassword: Schema.NonEmptyString,
    runtimePassword: Schema.NonEmptyString,
    workspaceId: Schema.NonEmptyString,
    credentialKeyring: Schema.NonEmptyString,
    sandboxKey: Schema.NonEmptyString,
  }),
);

type ResetInput = { readonly directory: string; readonly environment: Environment };

export async function resetLocalState(input: ResetInput): Promise<void> {
  const directory = resolve(input.directory);
  const marker = await readFile(join(directory, 'secrets.json'), 'utf8').catch(() => '');
  const decoded = Schema.decodeUnknownResult(StackMarker)(marker);
  const details = await lstat(directory);

  if (details.isSymbolicLink() || !Result.isSuccess(decoded)) {
    throw new Error(`Refusing to reset an unrecognized local state directory: ${directory}`);
  }

  const ownerFile = join(directory, 'owner.json');

  const lock = await open(ownerFile, 'wx', PRIVATE_FILE_MODE).catch(() => {
    throw new Error(`Stop and inspect the existing local stack owner before resetting ${directory}`);
  });

  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, directory, phase: 'resetting' }));

    const actualDirectory = await realpath(directory);

    await assertNoContainers({ ...input, directory, selector: `label=io.mechane.state=${directory}` });

    if (actualDirectory !== directory) {
      await assertNoContainers({ ...input, directory, selector: `label=io.mechane.state=${actualDirectory}` });
    }

    for (const name of ['application', 'sandbox']) {
      const project = join(directory, name);

      const hasLock = await access(join(project, '.celld', 'supervisor.lock')).then(
        () => true,
        () => false,
      );

      if (hasLock) {
        throw new Error(`Inspect the existing Worker supervisor before resetting ${directory}`);
      }

      const actualProject = await realpath(project).catch(() => undefined);

      if (actualProject !== undefined) {
        const projectHash = createHash('sha256').update(actualProject).digest('hex');
        const nodeLabel = `dev-${projectHash.slice(0, NODE_ID_CHARACTERS)}`;

        await assertNoContainers({ ...input, directory, selector: `label=celld.node=${nodeLabel}` });
      }
    }
  } catch (cause) {
    await lock.close();
    await rm(ownerFile, { force: true });

    throw cause;
  }

  const retiredDirectory = join(dirname(directory), `.mechane-reset-${randomUUID()}`);

  await lock.close();
  await rename(directory, retiredDirectory).catch(async (cause: unknown) => {
    await rm(ownerFile, { force: true });

    throw cause;
  });
  await rm(retiredDirectory, { recursive: true }).catch((cause: unknown) => {
    throw new Error(
      `The inactive installation moved to ${retiredDirectory}; remove that owned directory after review`,
      { cause },
    );
  });
}

async function assertNoContainers(input: ResetInput & { readonly selector: string }): Promise<void> {
  const containers = await runCommand({
    command: 'docker',
    args: ['ps', '--all', '--quiet', '--filter', input.selector],
    environment: input.environment,
    timeoutMs: INSPECTION_TIMEOUT_MS,
  });

  if (containers.trim() !== '') {
    throw new Error(`Stop the owned Docker resources before resetting ${input.directory}`);
  }
}
