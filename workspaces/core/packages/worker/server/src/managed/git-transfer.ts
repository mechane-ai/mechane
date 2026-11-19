import { openGitTransfer } from '@mechane/control-store';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { Option, Redacted } from 'effect';

type GitTransferInput = {
  readonly configuration: RuntimeConfiguration;
  readonly workspaceId: string;
  readonly workId: string;
  readonly token: string;
  readonly maxConcurrentRequests: number;
  readonly maxSessionBytes: number;
};

type TransferDirection = 'upload' | 'download';

export async function openManagedGitTransfer({ configuration, ...scope }: GitTransferInput) {
  const databaseUrl = Redacted.value(configuration.databaseUrl);
  const transfer = await openGitTransfer({ databaseUrl, ...scope });
  const lifetime = { closing: Option.none<Promise<void>>() };

  async function close(): Promise<void> {
    if (Option.isSome(lifetime.closing)) {
      await lifetime.closing.value;

      return;
    }

    const pending = transfer.close();
    lifetime.closing = Option.some(pending);

    await pending;
  }

  function stream(body: ReadableStream<unknown>, direction: TransferDirection): ReadableStream<Uint8Array> {
    const reader = body.getReader();

    return new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          try {
            const chunk = await reader.read();

            if (chunk.done) {
              if (direction === 'download') {
                await close();
              }

              controller.close();

              return;
            }

            if (!(chunk.value instanceof Uint8Array)) {
              throw new TypeError('Git transfer data must be bytes');
            }

            await transfer.consume(chunk.value.byteLength);
            controller.enqueue(chunk.value);
          } catch (error) {
            try {
              await reader.cancel(error);
            } finally {
              await close();
            }

            throw error;
          }
        },
        async cancel(reason) {
          try {
            await reader.cancel(reason);
          } finally {
            await close();
          }
        },
      },
      { highWaterMark: 0 },
    );
  }

  return { stream, close };
}
