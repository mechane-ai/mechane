import { chmod, copyFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LocalStack } from './types.ts';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export async function retainFailureLogs(stack: LocalStack): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mechane-node-failure-'));

  await chmod(directory, PRIVATE_DIRECTORY_MODE);
  await copyPrivateLog({ source: stack.serverLog, target: join(directory, 'server.log') });
  await copyPrivateLog({
    source: join(stack.stateDirectory, 'sandbox', 'miniflare.log'),
    target: join(directory, 'sandbox.log'),
  });
  await writeFile(
    join(directory, 'README.md'),
    [
      '# Local stack failure evidence',
      '',
      `Owner: local stack runner PID ${process.pid}.`,
      `Source: ${stack.stateDirectory}.`,
      'The owning runner stops its services and container before exiting. Only diagnostic logs are retained here.',
      'Remove this directory after reviewing or saving the needed evidence.',
      '',
    ].join('\n'),
    { mode: PRIVATE_FILE_MODE },
  );

  return directory;
}

async function copyPrivateLog({ source, target }: { readonly source: string; readonly target: string }): Promise<void> {
  try {
    await copyFile(source, target);
    await chmod(target, PRIVATE_FILE_MODE);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}
