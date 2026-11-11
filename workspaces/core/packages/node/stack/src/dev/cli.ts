import { Duration } from 'effect';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import type { Socket } from 'node:net';
import type { Readable } from 'node:stream';
import type { LocalStack } from '../types.ts';
import { sendDevOutput } from './connection.ts';
import { DevSessionError } from './protocol.ts';
import type { DevSettings } from './settings.ts';

const PRIVATE_DIRECTORY_MODE = 0o700;
const CLI_DEADLINE = Duration.minutes(15);
const CLI_STOP_DEADLINE = Duration.seconds(10);

type RunDevCliInput = {
  readonly settings: DevSettings;
  readonly stack: LocalStack;
  readonly socket: Socket;
  readonly args: ReadonlyArray<string>;
};

type ForwardCliOutputInput = {
  readonly stream: Readable;
  readonly socket: Socket;
  readonly channel: 'stdout' | 'stderr';
};

export async function runDevCli({ settings, stack, socket, args }: RunDevCliInput): Promise<number> {
  await mkdir(settings.cliConfigurationDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

  const child = spawn(stack.cli.command, [...stack.cli.args, ...args], {
    cwd: settings.worktreeDirectory,
    env: {
      ...settings.cliEnvironment,
      MECHANE_ORIGIN: stack.origin.origin,
      XDG_CONFIG_HOME: settings.cliConfigurationDirectory,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const exited = once(child, 'close');
  const started = once(child, 'spawn');
  const lifecycle: { killTimer?: ReturnType<typeof setTimeout> } = {};

  function stop(): void {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill('SIGTERM');

    lifecycle.killTimer ??= setTimeout(() => child.kill('SIGKILL'), Duration.toMillis(CLI_STOP_DEADLINE));
  }

  socket.once('close', stop);
  child.stdin.on('error', stop);

  const timer = setTimeout(() => stop(), Duration.toMillis(CLI_DEADLINE));

  try {
    await started;
    socket.pipe(child.stdin);
    await sendDevOutput({ socket, output: { channel: 'ready' } });

    const outputs = [
      forwardCliOutput({ stream: child.stdout, socket, channel: 'stdout' }),
      forwardCliOutput({ stream: child.stderr, socket, channel: 'stderr' }),
    ];

    const settled = await Promise.allSettled(outputs);
    const result: ReadonlyArray<unknown> = await exited;
    const [exitCode] = result;
    const failed = settled.find((output) => output.status === 'rejected');

    if (failed?.status === 'rejected') {
      throw new DevSessionError('The dev CLI output could not be forwarded', { cause: failed.reason });
    }

    if (typeof exitCode !== 'number') {
      return 1;
    }

    return exitCode;
  } finally {
    clearTimeout(timer);
    socket.off('close', stop);
    child.stdin.off('error', stop);
    socket.unpipe(child.stdin);
    stop();

    try {
      await exited;
    } finally {
      clearTimeout(lifecycle.killTimer);
    }
  }
}

async function forwardCliOutput({ stream, socket, channel }: ForwardCliOutputInput): Promise<void> {
  stream.setEncoding('utf8');

  for await (const chunk of stream) {
    if (typeof chunk !== 'string') {
      throw new DevSessionError('The dev CLI returned a non-text output chunk');
    }

    await sendDevOutput({ socket, output: { channel, text: chunk } });
  }
}
