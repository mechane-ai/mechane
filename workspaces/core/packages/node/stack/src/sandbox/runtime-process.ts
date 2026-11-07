import { Schema } from 'effect';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Environment } from '../types.ts';
import { signalProcessGroup } from './process-group.ts';
import { SandboxProcessDispose, SandboxProcessReady, SandboxProcessStart } from './process-messages.ts';

const STARTUP_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5000;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_LOG_MODE = 0o600;
const ENTRY = fileURLToPath(new URL('main.ts', import.meta.url));

type SandboxProcessInput = {
  readonly start: typeof SandboxProcessStart.Type;
  readonly environment: Environment;
  readonly nodeExecutable: string;
};

type SandboxProcess = { readonly origin: URL; readonly close: () => Promise<void> };
type OwnedProcess = { readonly child: ChildProcess; readonly exited: Promise<number | null> };

async function stopProcess({ child, exited }: OwnedProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    signalProcessGroup({ child, signal: 'SIGKILL' });
    await exited;

    return;
  }

  const deadline = setTimeout(() => signalProcessGroup({ child, signal: 'SIGKILL' }), STOP_TIMEOUT_MS);

  deadline.unref();

  try {
    if (child.connected) {
      child.send(Schema.encodeSync(SandboxProcessDispose)({ kind: 'dispose' }), (error) => {
        if (error !== null) {
          signalProcessGroup({ child, signal: 'SIGTERM' });
        }
      });
    } else {
      signalProcessGroup({ child, signal: 'SIGTERM' });
    }

    await exited;
  } finally {
    clearTimeout(deadline);
    signalProcessGroup({ child, signal: 'SIGKILL' });
  }
}

export async function startSandboxProcess(input: SandboxProcessInput): Promise<SandboxProcess> {
  await mkdir(input.start.directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

  const logFile = join(input.start.directory, 'miniflare.log');
  const log = await open(logFile, 'a', PRIVATE_LOG_MODE);

  try {
    return await launchSandboxProcess(input, log.fd, logFile);
  } finally {
    await log.close();
  }
}

async function launchSandboxProcess(
  input: SandboxProcessInput,
  logDescriptor: number,
  logFile: string,
): Promise<SandboxProcess> {
  const child = fork(ENTRY, [], {
    execPath: input.nodeExecutable,
    execArgv: [],
    env: input.environment,
    stdio: ['ignore', logDescriptor, logDescriptor, 'ipc'],
    serialization: 'advanced',
    detached: true,
  });

  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  const failure = exited.then(() => {
    throw new Error(`The sandbox process stopped before readiness; inspect ${logFile}`);
  });

  const ready = Promise.withResolvers<URL>();

  const deadline = setTimeout(
    () => ready.reject(new Error(`The sandbox process did not become ready; inspect ${logFile}`)),
    STARTUP_TIMEOUT_MS,
  );

  function receive(message: unknown): void {
    try {
      const response = Schema.decodeUnknownSync(SandboxProcessReady)(message);
      const origin = new URL(response.origin);

      if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1') {
        throw new Error('The sandbox process returned an invalid origin');
      }

      ready.resolve(origin);
    } catch (error) {
      ready.reject(error);
    }
  }

  child.on('message', receive);

  try {
    child.send(Schema.encodeSync(SandboxProcessStart)(input.start), (error) => {
      if (error !== null) {
        ready.reject(error);
      }
    });

    const origin = await Promise.race([ready.promise, failure]);
    const state: { closing?: Promise<void> } = {};

    return {
      origin,
      close: async () => {
        state.closing ??= stopProcess({ child, exited });

        await state.closing;
      },
    };
  } catch (error) {
    await stopProcess({ child, exited });

    throw error;
  } finally {
    clearTimeout(deadline);
    child.off('message', receive);
  }
}
