import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import { createInterface } from 'node:readline';
import { writeDevOutput } from './output.ts';
import { DevOutput, DevRequest, DevSessionError, DevSessionUnavailableError } from './protocol.ts';

const CONNECT_DEADLINE = Duration.seconds(3);
const REQUEST_DEADLINE = Duration.minutes(20);
const REQUEST_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const MISSING_SESSION_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ECONNREFUSED']);

type SendDevOutputInput = { readonly socket: Socket; readonly output: DevOutput };
type ReadDevRequestInput = { readonly socket: Socket };

type ContactDevSessionInput = {
  readonly socketPath: string;
  readonly request: DevRequest;
  readonly onConnected?: () => void;
};

type ConnectDevSessionInput = { readonly socketPath: string };
type IsMissingDevSessionInput = { readonly cause: unknown };

export async function sendDevOutput({ socket, output }: SendDevOutputInput): Promise<void> {
  if (socket.destroyed) {
    throw new DevSessionError('The dev command connection closed');
  }

  const encoded = `${JSON.stringify(output)}\n`;
  const written = Promise.withResolvers<void>();

  socket.write(encoded, (cause) => {
    if (cause !== undefined && cause !== null) {
      written.reject(cause);

      return;
    }

    written.resolve();
  });

  await written.promise;
}

export async function readDevRequest({ socket }: ReadDevRequestInput): Promise<DevRequest | undefined> {
  const received = Promise.withResolvers<string | undefined>();
  const state = { bytes: 0 };
  const lines = createInterface({ input: socket });

  function receiveChunk(chunk: Buffer): void {
    state.bytes += chunk.byteLength;

    if (state.bytes > REQUEST_MAX_BYTES) {
      received.reject(new DevSessionError('The dev command exceeds its request limit'));
    }
  }

  function close(): void {
    received.resolve(undefined);
  }

  function fail(cause: Error): void {
    received.reject(cause);
  }

  socket.on('data', receiveChunk);
  socket.once('close', close);
  socket.once('end', close);
  socket.once('error', fail);
  lines.once('line', (line) => received.resolve(line));

  const timer = setTimeout(
    () => received.reject(new DevSessionError('The dev command did not send its request')),
    Duration.toMillis(CONNECT_DEADLINE),
  );

  try {
    const line = await received.promise;

    if (line === undefined) {
      return;
    }

    if (Buffer.byteLength(line) > REQUEST_MAX_BYTES) {
      throw new DevSessionError('The dev command exceeds its request limit');
    }

    return Schema.decodeUnknownSync(Schema.fromJsonString(DevRequest), { onExcessProperty: 'error' })(line);
  } finally {
    clearTimeout(timer);
    lines.close();
    socket.off('data', receiveChunk);
    socket.off('close', close);
    socket.off('end', close);
    socket.off('error', fail);
  }
}

export async function contactDevSession({ socketPath, request, onConnected }: ContactDevSessionInput): Promise<number> {
  const socket = await connectDevSession({ socketPath });
  const lines = createInterface({ input: socket });
  const outcome = { exitCode: 1, hasFinished: false };

  function endInput(): void {
    socket.end();
  }

  function fail(cause: Error): void {
    lines.close();

    if (!outcome.hasFinished) {
      writeDevOutput({ channel: 'stderr', text: `Dev connection failed: ${cause.message}\n` });
    }
  }

  socket.on('error', fail);
  socket.setTimeout(Duration.toMillis(REQUEST_DEADLINE), () => {
    socket.destroy(new DevSessionError('The dev command exceeded its response deadline'));
  });

  try {
    onConnected?.();
    socket.write(`${JSON.stringify(request)}\n`);

    for await (const line of lines) {
      const output = Schema.decodeUnknownSync(Schema.fromJsonString(DevOutput), { onExcessProperty: 'error' })(line);

      switch (output.channel) {
        case 'stdout':
        case 'stderr':
          writeDevOutput({ channel: output.channel, text: output.text });

          break;
        case 'ready':
          process.stdin.pipe(socket, { end: false });
          process.stdin.once('end', endInput);

          if (process.stdin.readableEnded) {
            socket.end();
          }

          break;
        case 'error':
          writeDevOutput({ channel: 'stderr', text: `Dev command failed: ${output.message}\n` });

          break;
        case 'done':
          outcome.exitCode = output.exitCode;
          outcome.hasFinished = true;

          break;
      }
    }

    if (!outcome.hasFinished) {
      throw new DevSessionError('The dev session closed without a command result');
    }

    return outcome.exitCode;
  } finally {
    process.stdin.off('end', endInput);
    process.stdin.unpipe(socket);
    process.stdin.pause();
    lines.close();
    socket.destroy();
    socket.off('error', fail);
  }
}

async function connectDevSession({ socketPath }: ConnectDevSessionInput): Promise<Socket> {
  const socket = createConnection({ path: socketPath });

  const timer = setTimeout(
    () => socket.destroy(new DevSessionError('The dev session did not accept its connection')),
    Duration.toMillis(CONNECT_DEADLINE),
  );

  try {
    await once(socket, 'connect');

    return socket;
  } catch (cause) {
    socket.destroy();

    if (isMissingDevSession({ cause })) {
      throw new DevSessionUnavailableError('Start this worktree with mise run dev before attaching', { cause });
    }

    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

export function isMissingDevSession({ cause }: IsMissingDevSessionInput): boolean {
  if (!(cause instanceof Error) || !('code' in cause)) {
    return false;
  }

  if (typeof cause.code !== 'string') {
    return false;
  }

  return MISSING_SESSION_CODES.has(cause.code);
}
