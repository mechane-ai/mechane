import type { openStore } from '@mechane/runtime';
import type { Server } from 'node:http';
import type { Readiness } from './readiness.ts';
import type { WorkflowWorld } from './workflow-world.ts';

const SHUTDOWN_TIMEOUT_MS = 25_000;
const HTTP_DRAIN_TIMEOUT_MS = 5000;

type ShutdownResources = {
  readonly server: Server;
  readonly world: WorkflowWorld;
  readonly store: Awaited<ReturnType<typeof openStore>>;
  readonly readiness: Readiness;
  readonly unregisterHooks: () => void;
  readonly stopReconciliation: () => Promise<void>;
};

export async function closeHttpServer({ server }: Pick<ShutdownResources, 'server'>): Promise<void> {
  const deadline = setTimeout(() => server.closeAllConnections(), HTTP_DRAIN_TIMEOUT_MS);

  deadline.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error !== undefined) {
          reject(error);

          return;
        }

        resolve();
      });
      server.closeIdleConnections();
    });
  } finally {
    clearTimeout(deadline);
  }
}

export function registerShutdown({
  server,
  world,
  store,
  readiness,
  unregisterHooks,
  stopReconciliation,
}: ShutdownResources): void {
  const state = { isClosing: false };

  async function shutdown(): Promise<void> {
    if (state.isClosing) {
      return;
    }

    state.isClosing = true;

    readiness.beginDrain();

    const deadline = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);

    deadline.unref();

    try {
      const failures: Array<unknown> = [];

      try {
        await closeHttpServer({ server });
      } catch (error) {
        failures.push(error);
      }

      try {
        await stopReconciliation();
        await world.close?.();
      } catch (error) {
        failures.push(error);
      }

      try {
        unregisterHooks();
      } catch (error) {
        failures.push(error);
      }

      try {
        await store.close();
      } catch (error) {
        failures.push(error);
      }

      if (failures.length > 0) {
        throw new AggregateError(failures, 'Server cleanup failed');
      }

      clearTimeout(deadline);
      // SDK globals can retain handles after their public close operations complete.
      process.exit(0);
    } catch {
      console.error('Server shutdown did not complete');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
}
