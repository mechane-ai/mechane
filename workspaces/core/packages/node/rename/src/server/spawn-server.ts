import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Array, Cause, Option, Queue, Result, Schema } from 'effect';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ServerExited } from '../errors.ts';
import { ServerMessage } from '../schemas.ts';
import type { ServerChild } from '../types.ts';
import { splitFrames } from './split-frames.ts';

/** The TypeScript compiler, whose language server finds every reference of an identifier the map renames. */
const COMPILER_PATH = fileURLToPath(new URL('bin/tsc', import.meta.resolve('typescript/package.json')));

/** The queue the server's messages arrive on. */
type SpawnServerInput = { readonly messages: Queue.Queue<ServerMessage, ServerExited> };

/** The server's process, and the kill that stops it. */
type SpawnedServer = { readonly child: ServerChild; readonly kill: () => boolean };

/** Starts the server on standard input and output, and queues each message it writes as it arrives. */
export function spawnServer({ messages }: SpawnServerInput): SpawnedServer {
  const child = spawn(COMPILER_PATH, ['--lsp', '--stdio'], {
    cwd: WORKSPACE_FOLDER,
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  const unread: Array<Buffer> = [];

  const messageJson = Schema.fromJsonString(ServerMessage);
  const decodeMessage = Schema.decodeUnknownResult(messageJson);

  /** Queues each whole message the chunk completes, and keeps the bytes of the next one. */
  const onData: (chunk: Buffer) => void = (chunk) => {
    const bytes = Buffer.concat([...unread, chunk]);
    const { frames, rest } = splitFrames({ bytes });

    unread.splice(0, unread.length, rest);

    const decoded = frames.map((frame) => decodeMessage(frame));
    const failed = Array.findFirst(decoded, Result.isFailure);

    if (Option.isSome(failed)) {
      const status = String(failed.value.failure);
      const exited = new ServerExited({ status });
      const cause = Cause.fail(exited);

      Queue.failCauseUnsafe(messages, cause);

      return;
    }

    const parsed = decoded.filter(Result.isSuccess).map((entry) => entry.success);

    Queue.offerAllUnsafe(messages, parsed);
  };

  /** Fails the request that waits, once the server exits with its status. */
  const onExit: (status: unknown) => void = (status) => {
    Queue.failCauseUnsafe(messages, Cause.fail(new ServerExited({ status: String(status) })));
  };

  child.stdout.on('data', onData);
  child.on('exit', onExit);

  return { child, kill: () => child.kill() };
}
