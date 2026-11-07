import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { record, text } from './fixtures/http.ts';
import type { StackOptions } from './types.ts';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const OWNER_RECORD_INDENT_SPACES = 2;
const ENCRYPTION_KEY_BYTES = 32;

export type LocalSecrets = {
  readonly postgresPassword: string;
  readonly runtimePassword: string;
  readonly workspaceId: string;
  readonly credentialKeyring: string;
  readonly sandboxKey: string;
};

export type StackState = {
  readonly directory: string;
  readonly secrets: LocalSecrets;
  readonly writeOwner: (details: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly close: (options?: { readonly shouldPreserveFiles?: boolean }) => Promise<void>;
};

export async function openStackState(options: StackOptions): Promise<StackState> {
  const directory = await stateDirectory(options);

  await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await chmod(directory, PRIVATE_DIRECTORY_MODE);

  const lockFile = join(directory, 'owner.json');

  const lock = await open(lockFile, 'wx', PRIVATE_FILE_MODE).catch((cause: unknown) => {
    throw new Error(
      `The local stack already has an ownership record at ${lockFile}; stop its recorded processes before retrying`,
      { cause },
    );
  });

  await lock.close();

  async function writeOwner(details: Readonly<Record<string, unknown>>): Promise<void> {
    await writeFile(
      lockFile,
      JSON.stringify({ pid: process.pid, directory, ...details }, null, OWNER_RECORD_INDENT_SPACES),
      { mode: 0o600 },
    );
  }

  await writeOwner({ phase: 'starting' });

  try {
    const secretFile = join(directory, 'secrets.json');

    const existing = await readFile(secretFile, 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }

      throw error;
    });

    const secrets = stateSecrets(existing);

    if (existing === null) {
      await writeFile(secretFile, JSON.stringify(secrets), { mode: 0o600, flag: 'wx' });
    }

    return {
      directory,
      secrets,
      writeOwner,
      close: async (input) => {
        if (input?.shouldPreserveFiles === true) {
          await writeOwner({ phase: 'stopped', resourcesStopped: true });

          return;
        }

        await rm(lockFile);

        if (options.mode === 'ephemeral') {
          await rm(directory, { recursive: true });
        }
      },
    };
  } catch (error) {
    await rm(lockFile);

    throw error;
  }
}

async function stateDirectory(options: StackOptions): Promise<string> {
  if (options.stateDirectory !== undefined) {
    const directory = resolve(options.stateDirectory);

    if (options.mode === 'ephemeral') {
      await mkdir(directory, { mode: PRIVATE_DIRECTORY_MODE });
    }

    return directory;
  }

  if (options.mode === 'persistent') {
    throw new Error('Persistent mode requires an explicit state directory');
  }

  return await mkdtemp(join(tmpdir(), 'mechane-node-stack-'));
}

function generateSecrets(): LocalSecrets {
  return {
    postgresPassword: randomBytes(ENCRYPTION_KEY_BYTES).toString('hex'),
    runtimePassword: randomBytes(ENCRYPTION_KEY_BYTES).toString('hex'),
    workspaceId: randomUUID(),
    credentialKeyring: JSON.stringify({
      current: 'local',
      keys: { local: randomBytes(ENCRYPTION_KEY_BYTES).toString('hex') },
    }),
    sandboxKey: randomBytes(ENCRYPTION_KEY_BYTES).toString('hex'),
  };
}

function stateSecrets(serialized: string | null): LocalSecrets {
  if (serialized === null) {
    return generateSecrets();
  }

  return decodeSecrets(serialized);
}

function decodeSecrets(serialized: string): LocalSecrets {
  const value = record(JSON.parse(serialized));

  return {
    postgresPassword: text(value['postgresPassword']),
    runtimePassword: text(value['runtimePassword']),
    workspaceId: text(value['workspaceId']),
    credentialKeyring: text(value['credentialKeyring']),
    sandboxKey: text(value['sandboxKey']),
  };
}
