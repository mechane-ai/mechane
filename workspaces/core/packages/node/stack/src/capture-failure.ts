import { writeDiagnostic } from '@mechane/program';
import { appendFile, chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureEnvironmentReports } from './capture-environment-reports.ts';
import { captureProcessStatus } from './capture-process-status.ts';
import { dumpDurableStorage } from './celld/dump-durable-storage.ts';
import { retainFailureLogs } from './retain-failure-logs.ts';
import type { Environment, LocalStack } from './types.ts';

type CaptureFailureInput = { readonly stack: LocalStack; readonly label: string; readonly environment: Environment };

type CaptureFileInput = {
  readonly directory: string;
  readonly name: string;
  readonly read: () => Promise<string>;
  readonly signal: AbortSignal;
};

const CAPTURE_TIMEOUT_MS = 5000;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export async function captureStackFailure({ stack, label, environment }: CaptureFailureInput): Promise<string> {
  const startedAt = new Date().toISOString();
  const signal = AbortSignal.timeout(CAPTURE_TIMEOUT_MS);
  const directory = await mkdtemp(join(tmpdir(), 'mechane-node-failure-'));
  const durableDirectories = [join(stack.stateDirectory, 'application'), join(stack.stateDirectory, 'sandbox')];

  await chmod(directory, PRIVATE_DIRECTORY_MODE);

  const captures = await Promise.all([
    captureFile({
      directory,
      name: 'environment-startup.json',
      signal,
      read: () => captureEnvironmentReports({ stack, signal }),
    }),
    captureFile({
      directory,
      name: 'logs-location.txt',
      signal,
      read: async () => await retainFailureLogs(stack, { directory, signal }),
    }),
    captureFile({ directory, name: 'storage.txt', signal, read: async () => await stack.dumpStorage({ signal }) }),
    captureFile({
      directory,
      name: 'durable-storage.txt',
      signal,
      read: async () => await dumpDurableStorage({ directories: durableDirectories, signal }),
    }),
    captureFile({
      directory,
      name: 'host-status.json',
      signal,
      read: async () => await captureProcessStatus({ directory: stack.stateDirectory, environment, signal }),
    }),
    captureFile({
      directory,
      name: 'sandbox-status.json',
      signal,
      read: async () => (await stack.sandbox?.dumpStatus({ signal })) ?? JSON.stringify({ isConfigured: false }),
    }),
  ]);

  await writeFile(
    join(directory, 'capture.json'),
    JSON.stringify({
      kind: 'live-failure-capture-v1',
      label,
      startedAt,
      finishedAt: new Date().toISOString(),
      timeoutMs: CAPTURE_TIMEOUT_MS,
      source: stack.stateDirectory,
      captures,
      consistency: 'Live independent observations; not a transaction-consistent SQLite backup',
    }),
    { mode: PRIVATE_FILE_MODE },
  );

  await appendFile(
    join(stack.stateDirectory, 'failure-captures.jsonl'),
    `${JSON.stringify({ label, directory, startedAt })}\n`,
    { mode: PRIVATE_FILE_MODE },
  );

  writeDiagnostic({
    program: 'stack',
    line: `retained failure capture ${JSON.stringify(label)} in ${JSON.stringify(directory)}`,
  });

  return directory;
}

async function captureFile({
  directory,
  name,
  read,
  signal,
}: CaptureFileInput): Promise<Readonly<Record<string, unknown>>> {
  const startedAt = new Date().toISOString();
  const aborted = Promise.withResolvers<never>();

  function onAbort(): void {
    aborted.reject(signal.reason);
  }

  signal.addEventListener('abort', onAbort, { once: true });

  try {
    signal.throwIfAborted();

    const contents = await Promise.race([read(), aborted.promise]);

    await writeFile(join(directory, name), contents, { mode: PRIVATE_FILE_MODE, signal });

    return { name, startedAt, finishedAt: new Date().toISOString(), status: 'captured' };
  } catch (cause) {
    const error = diagnosticError(cause);

    return { name, startedAt, finishedAt: new Date().toISOString(), status: 'unavailable', error };
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function diagnosticError(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return 'The failure observation could not be captured';
}
