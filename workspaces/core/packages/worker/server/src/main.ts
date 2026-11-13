import { openControlStore } from '@mechane/control-store';
import { catalog, RELEASE, SERVICE } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { createMechActorClient, loadRuntimeConfiguration, resolveRuntimeEnvironment } from '@mechane/runtime';
import type { ActorNamespace, MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { serveSandbox } from '@mechane/sandbox';
import { SANDBOX_COMPLETION_PATH, SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import { Redacted } from 'effect';
import { expireSignOutCookies } from './auth/sign-out.ts';
import { createConsoleHandler } from './console/handler.ts';
import { deliverControlChanges } from './control/deliver-changes.ts';
import { respondFailure } from './http/failure.ts';
import { READ_METHODS } from './http/methods.ts';
import { createServer } from './serve.ts';
import { loadServerSettings } from './settings/server.ts';
import { loadWorkerBindings } from './settings/worker.ts';
import type { WorkerEnvironment } from './settings/worker.ts';

/**
 * Cloudflare loads the agent class by its deployment binding name.
 *
 * @public
 */
export { MechActor as MechObject } from '@mechane/runtime';
/**
 * Cloudflare loads the environment and egress classes by their deployment binding names.
 *
 * @public
 */
export { SandboxObject, MachineObject, EgressGateway } from '@mechane/sandbox';

const SCHEDULED_DELIVERY_MAX_ROWS = 50;
const SCHEDULED_DELIVERY_MAX_MILLISECONDS = 20_000;
type OpenServerStoreInput = { readonly configuration: RuntimeConfiguration };

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- ImportMeta requires runtime interface merging.
  interface ImportMeta {
    readonly mechaneRevision: string | undefined;
  }
}

async function openServerStore({ configuration }: OpenServerStoreInput) {
  return await openControlStore({
    databaseUrl: Redacted.value(configuration.databaseUrl),
    keyring: Redacted.value(configuration.credentialKeyring),
    maxConnections: configuration.maxConnections,
  });
}

function actorResolver(namespace: ActorNamespace): MechActorResolver {
  return (scope) => createMechActorClient({ namespace, ...scope });
}

const worker: Readonly<ExportedHandler<WorkerEnvironment>> = {
  async fetch(request, environment): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname !== SANDBOX_COMPLETION_PATH && url.pathname.startsWith(`${SANDBOX_SERVICE_PREFIX}/`)) {
        return await serveSandbox({ request, environment });
      }

      if (url.pathname === catalog.health.path && READ_METHODS.has(request.method)) {
        if (request.method === HttpMethod.Head) {
          return new Response(null);
        }

        return Response.json({ service: SERVICE, release: RELEASE });
      }

      const bindings = loadWorkerBindings({ environment });
      const console = createConsoleHandler({ assets: bindings.assets });
      const asset = await console(request);

      if (asset !== null) {
        return asset;
      }

      const resolved = await resolveRuntimeEnvironment({ environment });
      const configuration = loadRuntimeConfiguration({ environment: resolved });
      const settings = loadServerSettings({ runtime: configuration, environment: resolved });

      try {
        const store = await openServerStore({ configuration });

        try {
          const serve = createServer({
            store,
            captureControlChanges: store.captureControlChanges,
            actors: actorResolver(bindings.actors),
            configuration,
            settings,
            runtimeRevision: import.meta.mechaneRevision ?? 'source',
          });

          return await serve(request, request.headers.get(HttpHeader.ConnectingIp));
        } finally {
          await store.close();
        }
      } catch (failure) {
        const response = respondFailure({ failure, request });

        return expireSignOutCookies({ request, origin: configuration.publicOrigin, response });
      }
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  },
  async scheduled(_controller, environment): Promise<void> {
    const bindings = loadWorkerBindings({ environment });
    const resolved = await resolveRuntimeEnvironment({ environment });
    const configuration = loadRuntimeConfiguration({ environment: resolved });
    const store = await openServerStore({ configuration });

    try {
      await deliverControlChanges({
        store,
        actors: actorResolver(bindings.actors),
        maxRows: SCHEDULED_DELIVERY_MAX_ROWS,
        maxMs: SCHEDULED_DELIVERY_MAX_MILLISECONDS,
      });
    } finally {
      await store.close();
    }
  },
};

/**
 * Cloudflare calls the module handler for HTTP requests and scheduled delivery.
 *
 * @public
 */
export default worker;
