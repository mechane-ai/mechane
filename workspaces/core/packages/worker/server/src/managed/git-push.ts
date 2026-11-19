import { invalidGitPush, oversizedGitPush, validatePushCommand } from './git-push-policy.ts';

const LENGTH_PREFIX = 4;
const PACKET_MAX_BYTES = 65_520;
const COMMAND_MAX_BYTES = 1_048_576;
const HEXADECIMAL_BASE = 16;
const PACKET_LENGTH = /^[0-9a-f]{4}$/u;

type GitPush = {
  readonly body: ReadableStream<Uint8Array>;
  readonly allowedRefs: ReadonlyArray<string>;
  readonly maxBytes: number;
};

type PacketInput = { readonly bytes: Uint8Array; readonly offset: number; readonly available: number };

function packetSize({ bytes, offset, available }: PacketInput): number | undefined {
  if (available - offset < LENGTH_PREFIX) {
    return undefined;
  }

  // The header is ASCII. Decode the four bytes independently of later binary pack data.
  const header = String.fromCodePoint(...bytes.subarray(offset, offset + LENGTH_PREFIX));

  if (!PACKET_LENGTH.test(header)) {
    throw invalidGitPush();
  }

  const length = Number.parseInt(header, HEXADECIMAL_BASE);

  if (length === 0) {
    return length;
  }

  if (length <= LENGTH_PREFIX || length > PACKET_MAX_BYTES) {
    throw invalidGitPush();
  }

  if (available - offset < length) {
    return undefined;
  }

  return length;
}

type PackRemainder = {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly prefix: Uint8Array;
  readonly remainder: Uint8Array;
  readonly received: number;
  readonly maxBytes: number;
};

function streamPack({ reader, prefix, remainder, received, maxBytes }: PackRemainder): ReadableStream<Uint8Array> {
  const transfer = { received };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(prefix);

      if (remainder.byteLength > 0) {
        controller.enqueue(remainder);
      }
    },
    async pull(controller) {
      try {
        const next = await reader.read();

        if (next.done) {
          reader.releaseLock();
          controller.close();

          return;
        }

        transfer.received += next.value.byteLength;

        if (transfer.received > maxBytes) {
          throw oversizedGitPush();
        }

        controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
        await reader.cancel().finally(() => reader.releaseLock());
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).finally(() => reader.releaseLock());
    },
  });
}

type CommandScan = { readonly offset: number; readonly isFirst: boolean };

type BufferedCommands = CommandScan & {
  readonly bytes: Uint8Array;
  readonly available: number;
  readonly allowedRefs: ReadonlyArray<string>;
};

function scanCommands({ bytes, available, offset, isFirst, allowedRefs }: BufferedCommands) {
  const cursor = { offset, isFirst, isComplete: false };

  while (cursor.offset < available) {
    const length = packetSize({ bytes, offset: cursor.offset, available });

    if (length === undefined) {
      return cursor;
    }

    if (length === 0) {
      if (cursor.isFirst) {
        throw invalidGitPush();
      }

      cursor.isComplete = true;

      return cursor;
    }

    const end = cursor.offset + length;
    const payload = bytes.subarray(cursor.offset + LENGTH_PREFIX, end);

    if (validatePushCommand({ payload, allowedRefs, isFirst: cursor.isFirst })) {
      cursor.isFirst = false;
    }

    cursor.offset = end;
  }

  return cursor;
}

/** Git may send several ref updates in one POST. Check every command before releasing the binary pack. */
export async function authorizeGitPush({ body, allowedRefs, maxBytes }: GitPush): Promise<ReadableStream<Uint8Array>> {
  const reader = body.getReader();
  const commandBytes = new Uint8Array(Math.min(maxBytes, COMMAND_MAX_BYTES));
  const state = { available: 0, received: 0, scan: { offset: 0, isFirst: true } };

  try {
    while (state.available < commandBytes.length) {
      const next = await reader.read();

      if (next.done) {
        throw invalidGitPush();
      }

      state.received += next.value.byteLength;

      if (state.received > maxBytes) {
        throw oversizedGitPush();
      }

      const count = Math.min(commandBytes.length - state.available, next.value.length);

      commandBytes.set(next.value.subarray(0, count), state.available);

      state.available += count;

      const scan = scanCommands({ ...state.scan, bytes: commandBytes, available: state.available, allowedRefs });

      if (scan.isComplete) {
        const prefix = commandBytes.subarray(0, state.available);
        const remainder = next.value.subarray(count);

        return streamPack({ reader, prefix, remainder, received: state.received, maxBytes });
      }

      state.scan = scan;
    }

    throw oversizedGitPush();
  } catch (error) {
    await reader.cancel().finally(() => reader.releaseLock());

    throw error;
  }
}
