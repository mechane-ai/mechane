import { HttpStatusCode } from '@mechane/records';
import { serialCalls } from '@mechane/utilities';
import { DurableObject } from 'cloudflare:workers';
import { openManagedHost } from '../managed/host.ts';
import { managedActorUrl } from '../managed/identity.ts';
import { serveArchive } from './archive.ts';
import type { InstalledWorkerScheduler, RuntimeBindings } from './types.ts';

/** Entrypoint shared by managed agent owners and inspectable historical actors. */
export function createMechObject(scheduleInstalled: InstalledWorkerScheduler) {
  return class MechObject extends DurableObject<RuntimeBindings> {
    readonly #managed;
    readonly #archive = serialCalls();

    constructor(state: DurableObjectState, environment: RuntimeBindings) {
      super(state, environment);

      this.#managed = openManagedHost(state, environment, scheduleInstalled);
    }

    override async fetch(request: Request): Promise<Response> {
      if (request.url === managedActorUrl) {
        return await this.#managed.fetch(request);
      }

      if ((await this.#managed.savedScope()) !== undefined) {
        return new Response(null, { status: HttpStatusCode.NotFound });
      }

      return await this.#archive.run({ run: () => serveArchive(this.ctx, this.env, request) });
    }

    override async alarm(): Promise<void> {
      const scope = await this.#managed.savedScope();

      if (scope !== undefined) {
        await this.#managed.alarm(scope);
      }
    }
  };
}
