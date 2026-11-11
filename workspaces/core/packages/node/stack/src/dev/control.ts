import { once } from 'node:events';
import { chmod, lstat, mkdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import type { Socket } from 'node:net';
import type { LocalStack } from '../types.ts';
import { runDevCli } from './cli.ts';
import { readDevRequest, sendDevOutput } from './connection.ts';
import { writeDevOutput } from './output.ts';
import { devFailureMessage, DevSessionError } from './protocol.ts';
import type { DevRequest, DevSessionRecord } from './protocol.ts';
import type { DevSettings } from './settings.ts';
import type { DevelopmentScenario } from './types.ts';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const CONTROL_MAX_CONNECTIONS = 16;

type RunDevControlInput = {
  readonly settings: DevSettings;
  readonly stack: LocalStack;
  readonly signal: AbortSignal;
  readonly runScenario: DevelopmentScenario | undefined;
};

type SessionRecordInput = { readonly settings: DevSettings; readonly stack: LocalStack };

export async function runDevControl({ settings, stack, signal, runScenario }: RunDevControlInput): Promise<void> {
  await mkdir(settings.socketDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

  const directory = await lstat(settings.socketDirectory);

  if (!directory.isDirectory() || directory.isSymbolicLink()) {
    throw new DevSessionError('The dev socket directory is not a private directory');
  }

  await chmod(settings.socketDirectory, PRIVATE_DIRECTORY_MODE);
  await rm(settings.socketPath, { force: true });

  const state: { activeCommand: DevRequest['command'] | undefined; isClosing: boolean } = {
    activeCommand: undefined,
    isClosing: false,
  };

  const clients = new Set<Socket>();
  const commands = new Set<Promise<void>>();
  const finished = Promise.withResolvers<void>();

  async function execute(request: DevRequest, socket: Socket): Promise<number> {
    if (request.command === 'status') {
      const status = await stack.inspect();

      const report = {
        ...status,
        status: 'running',
        worktreeDirectory: settings.worktreeDirectory,
        socketPath: settings.socketPath,
        activeCommand: state.activeCommand,
      };

      await sendDevOutput({ socket, output: { channel: 'stdout', text: `${JSON.stringify(report)}\n` } });

      return 0;
    }

    if (state.isClosing || state.activeCommand !== undefined) {
      throw new DevSessionError('The dev session is running another command; inspect dev status before retrying');
    }

    state.activeCommand = request.command;

    try {
      switch (request.command) {
        case 'cli':
          return await runDevCli({ settings, stack, socket, args: request.args });
        case 'test':
          if (runScenario === undefined) {
            throw new DevSessionError('This development composition has no scenario runner');
          }

          await runScenario({
            stack,
            name: request.name,
            environment: settings.environment,
            nodeExecutable: settings.nodeExecutable,
            celldBinary: settings.celldBinary,
            write: async (output) => {
              await sendDevOutput({ socket, output });
            },
          });

          return 0;
        case 'apply':
          switch (request.target) {
            case 'sandbox':
              await stack.applySandbox();

              break;
            case 'guest':
              await stack.applyGuest();

              break;
          }

          await sendDevOutput({
            socket,
            output: { channel: 'stdout', text: `Applied ${request.target} source to the retained development stack\n` },
          });

          return 0;
        case 'stop':
          await stack.stop();

          state.isClosing = true;

          await sendDevOutput({
            socket,
            output: { channel: 'stdout', text: 'Stopped the retained development stack\n' },
          });

          return 0;
      }
    } finally {
      state.activeCommand = undefined;
    }
  }

  async function serve(socket: Socket): Promise<void> {
    try {
      const request = await readDevRequest({ socket });

      if (request === undefined) {
        if (!socket.destroyed) {
          socket.end();
        }

        return;
      }

      const exitCode = await execute(request, socket);

      await sendDevOutput({ socket, output: { channel: 'done', exitCode } });

      const ended = Promise.race([once(socket, 'finish'), once(socket, 'close')]);

      socket.end();
      await ended;

      if (request.command === 'stop') {
        finished.resolve();
      }
    } catch (cause) {
      if (!socket.destroyed) {
        const message = devFailureMessage({ cause });

        await sendDevOutput({ socket, output: { channel: 'error', message } });
        await sendDevOutput({ socket, output: { channel: 'done', exitCode: 1 } });
        socket.end();
      }
    } finally {
      if (state.isClosing) {
        finished.resolve();
      }
    }
  }

  const server = createServer({ allowHalfOpen: true }, (socket) => {
    if (state.isClosing || clients.size >= CONTROL_MAX_CONNECTIONS) {
      socket.destroy();

      return;
    }

    clients.add(socket);
    socket.once('close', () => clients.delete(socket));
    socket.on('error', () => socket.destroy());

    const command = serve(socket).catch((cause: unknown) => {
      const message = devFailureMessage({ cause });

      writeDevOutput({ channel: 'stderr', text: `Dev control connection failed: ${message}\n` });
      socket.destroy();
    });

    commands.add(command);
    void command.finally(() => commands.delete(command));
  });

  function interrupt(): void {
    finished.resolve();
  }

  server.on('error', (cause) => finished.reject(cause));
  signal.addEventListener('abort', interrupt, { once: true });

  try {
    const listening = once(server, 'listening');

    server.listen(settings.socketPath);
    await Promise.race([listening, finished.promise]);

    if (signal.aborted) {
      return;
    }

    await listening;
    await chmod(settings.socketPath, PRIVATE_FILE_MODE);

    const record = sessionRecord({ settings, stack });

    await writeFile(settings.nextRecordPath, JSON.stringify(record), { mode: PRIVATE_FILE_MODE });
    await chmod(settings.nextRecordPath, PRIVATE_FILE_MODE);
    await rename(settings.nextRecordPath, settings.recordPath);

    const status = await stack.inspect();

    writeDevOutput({ text: `${JSON.stringify({ ...status, status: 'running', socketPath: settings.socketPath })}\n` });

    await finished.promise;
  } finally {
    state.isClosing = true;

    signal.removeEventListener('abort', interrupt);

    const closed = Promise.withResolvers<void>();

    server.close((cause) => {
      if (cause !== undefined && (!('code' in cause) || cause.code !== 'ERR_SERVER_NOT_RUNNING')) {
        closed.reject(cause);

        return;
      }

      closed.resolve();
    });

    for (const socket of clients) {
      socket.destroy();
    }

    await closed.promise;
    await Promise.allSettled(commands);
    await rm(settings.socketPath, { force: true });
    await rmdir(settings.socketDirectory);
  }
}

function sessionRecord({ settings, stack }: SessionRecordInput): DevSessionRecord {
  return {
    version: 1,
    worktreeDirectory: settings.worktreeDirectory,
    stateDirectory: settings.stateDirectory,
    socketPath: settings.socketPath,
    origin: stack.origin.origin,
    providers: stack.providers,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
}
