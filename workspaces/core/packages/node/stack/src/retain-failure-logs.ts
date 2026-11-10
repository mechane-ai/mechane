import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DiagnosticOptions, LocalStack } from './types.ts';

type RetainOptions = DiagnosticOptions & { readonly directory?: string };
type CopyLogInput = { readonly source: string; readonly target: string; readonly signal: AbortSignal | undefined };

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export async function retainFailureLogs(stack: LocalStack, options: RetainOptions = {}): Promise<string> {
  const directory = options.directory ?? (await mkdtemp(join(tmpdir(), 'mechane-node-failure-')));
  const signal = options.signal;

  await chmod(directory, PRIVATE_DIRECTORY_MODE);
  await copyPrivateLog({ source: stack.serverLog, target: join(directory, 'server.log'), signal });
  await copyPrivateLog({
    source: join(stack.stateDirectory, 'database-setup.log'),
    target: join(directory, 'database-setup.log'),
    signal,
  });
  await copyPrivateLog({
    source: join(stack.stateDirectory, 'application', '.celld', 'build.log'),
    target: join(directory, 'build.log'),
    signal,
  });
  await copyPrivateLog({
    source: stack.sandbox?.logFile ?? join(stack.stateDirectory, 'sandbox', '.celld', 'celld.log'),
    target: join(directory, 'sandbox.log'),
    signal,
  });
  await copyPrivateLog({
    source: join(stack.stateDirectory, 'console.log'),
    target: join(directory, 'console.log'),
    signal,
  });
  await copyPrivateLog({
    source: join(stack.stateDirectory, 'failure-captures.jsonl'),
    target: join(directory, 'earlier-captures.jsonl'),
    signal,
  });
  await writeFile(
    join(directory, 'README.md'),
    [
      '# Local stack failure evidence',
      '',
      `Owner: local stack runner PID ${process.pid}.`,
      `Source: ${stack.stateDirectory}.`,
      'Inspect the source ownership record for resource status and teardown. Only diagnostic logs are retained here.',
      'Remove this directory after reviewing or saving the needed evidence.',
      '',
    ].join('\n'),
    { mode: PRIVATE_FILE_MODE, signal },
  );

  return directory;
}

async function copyPrivateLog({ source, target, signal }: CopyLogInput): Promise<void> {
  try {
    const contents = await readFile(source, { signal });

    await writeFile(target, contents, { mode: PRIVATE_FILE_MODE, signal });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}
