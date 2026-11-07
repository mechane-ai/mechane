import { Schema } from 'effect';
import { createSandboxRuntime } from './miniflare-runtime.ts';
import { SandboxProcessDispose, SandboxProcessReady, SandboxProcessStart } from './process-messages.ts';

const STOP_TIMEOUT_MS = 5000;

async function startupMessage(): Promise<typeof SandboxProcessStart.Type> {
  if (!process.connected) {
    throw new Error('The sandbox owner disconnected before startup');
  }

  return await new Promise((resolve, reject) => {
    process.once('message', (message: unknown) => {
      try {
        resolve(Schema.decodeUnknownSync(SandboxProcessStart)(message));
      } catch {
        reject(new Error('The sandbox process startup message is invalid'));
      }
    });
    process.once('disconnect', () => reject(new Error('The sandbox owner disconnected before startup')));
  });
}

async function main(): Promise<void> {
  const input = await startupMessage();
  const starting = createSandboxRuntime(input);
  const state = { isClosing: false };

  async function dispose(status = 0): Promise<void> {
    if (state.isClosing) {
      return;
    }

    state.isClosing = true;

    const deadline = setTimeout(() => process.exit(1), STOP_TIMEOUT_MS);

    deadline.unref();

    try {
      const runtime = await starting;

      await runtime.dispose();
      process.exit(status);
    } catch {
      console.error('The sandbox runtime could not close');
      process.exit(1);
    }
  }

  process.on('message', (message: unknown) => {
    if (Schema.is(SandboxProcessDispose)(message)) {
      void dispose();
    }
  });
  process.once('disconnect', () => {
    void dispose();
  });

  try {
    const runtime = await starting;
    const origin = await runtime.ready;

    if (!state.isClosing && process.connected) {
      process.send?.(Schema.encodeSync(SandboxProcessReady)({ kind: 'ready', origin: origin.origin }), (error) => {
        if (error !== null) {
          void dispose(1);
        }
      });
    }
  } catch {
    console.error('The sandbox runtime could not start');
    await dispose(1);
  }
}

await main();
