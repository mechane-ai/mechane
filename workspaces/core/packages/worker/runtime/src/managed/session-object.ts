import { DurableObject } from 'cloudflare:workers';
import type { InstalledWorkerScheduler, RuntimeBindings } from '../actor/types.ts';
import { openManagedSessionHost } from './session-host.ts';

/** Per-session Durable Object running one unprefixed native `pi-durable` Harness. */
export function createSessionObject(scheduleInstalled: InstalledWorkerScheduler) {
  return class SessionObject extends DurableObject<RuntimeBindings> {
    readonly #host;

    constructor(state: DurableObjectState, environment: RuntimeBindings) {
      super(state, environment);

      this.#host = openManagedSessionHost(state, environment, scheduleInstalled);
    }

    override async fetch(request: Request): Promise<Response> {
      return await this.#host.fetch(request);
    }

    override async alarm(): Promise<void> {
      await this.#host.alarm();
    }
  };
}
