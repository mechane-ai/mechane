import { catalog, RELEASE, SERVICE } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import {
  createMechActorClient,
  createMechObject,
  loadRuntimeConfiguration,
  managedIdentityDiscovery,
  resolveRuntimeEnvironment,
} from '@mechane/runtime';
import type { ActorNamespace, MechActorResolver } from '@mechane/runtime';
import { serveSandbox } from '@mechane/sandbox';
import { SANDBOX_COMPLETION_PATH, SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import { expireSignOutCookies } from './auth/sign-out.ts';
import { createConsoleHandler } from './console/handler.ts';
import { deliverControlChanges } from './control/deliver-changes.ts';
import { finishRecovery } from './control/finish-recovery.ts';
import {
  installedCapacityWake,
  installedSessionWake,
  openServerStore,
  recoverInstalledSessions,
  sessionOpenScheduler,
} from './control/managed-recovery.ts';
import { respondFailure } from './http/failure.ts';
import { READ_METHODS } from './http/methods.ts';
import { managedFailure } from './managed/failure.ts';
import { resumePendingSessions } from './managed/session-runtime.ts';
import { createServer } from './serve.ts';
import { loadServerSettings } from './settings/server.ts';
import { loadWorkerBindings } from './settings/worker.ts';
import type { WorkerEnvironment } from './settings/worker.ts';

/**
 * Cloudflare loads the agent class by its deployment binding name.
 *
 * @public
 */
export const MechObject = createMechObject(installedSessionWake);
/**
 * Cloudflare loads the environment and egress classes by their deployment binding names.
 *
 * @public
 */
export { SandboxObject, MachineObject, EgressGateway } from '@mechane/sandbox';

const SCHEDULED_DELIVERY_MAX_ROWS = 50;
const SCHEDULED_DELIVERY_MAX_MILLISECONDS = 20_000;

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- ImportMeta requires runtime interface merging.
  interface ImportMeta {
    readonly mechaneRevision: string | undefined;
  }
}

function actorResolver(namespace: ActorNamespace): MechActorResolver {
  return (scope) => createMechActorClient({ namespace, ...scope });
}

function requestFailure(request: Request, url: URL, failure: unknown): Response {
  if (
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/console-api/') ||
    url.pathname.startsWith('/internal/managed/')
  ) {
    const requestId = `req_${crypto.randomUUID().replaceAll('-', '')}`;

    return managedFailure(failure, request, requestId);
  }

  return respondFailure({ failure, request });
}

const worker: Readonly<ExportedHandler<WorkerEnvironment>> = {
  async fetch(request, environment, execution): Promise<Response> {
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
      const discovery = managedIdentityDiscovery({ request, configuration: configuration.managedMcp.agentIdentity });

      if (discovery !== null) {
        return discovery;
      }

      const settings = loadServerSettings({ runtime: configuration, environment: resolved });

      try {
        const store = await openServerStore({ configuration });

        try {
          const serve = createServer({
            store,
            captureControlChanges: store.captureControlChanges,
            actors: actorResolver(bindings.actors),
            actorNamespace: bindings.actors,
            wakeInstalledCapacity: installedCapacityWake({ configuration, actors: bindings.actors, execution }),
            wakeInstalledSession: installedSessionWake({ configuration, actors: bindings.actors, execution }),
            scheduleSessionOpen: sessionOpenScheduler({ configuration, actors: bindings.actors, execution }),
            configuration,
            settings,
            runtimeRevision: import.meta.mechaneRevision ?? 'source',
          });

          return await serve(request, request.headers.get(HttpHeader.ConnectingIp));
        } finally {
          await store.close();
        }
      } catch (failure) {
        const response = requestFailure(request, url, failure);

        return expireSignOutCookies({ request, origin: configuration.publicOrigin, response });
      }
    } catch (failure) {
      return requestFailure(request, url, failure);
    }
  },
  async scheduled(_controller, environment, execution): Promise<void> {
    const bindings = loadWorkerBindings({ environment });
    const resolved = await resolveRuntimeEnvironment({ environment });
    const configuration = loadRuntimeConfiguration({ environment: resolved });
    const store = await openServerStore({ configuration });

    try {
      await finishRecovery([
        {
          step: 'control-changes',
          work: deliverControlChanges({
            store,
            actors: actorResolver(bindings.actors),
            maxRows: SCHEDULED_DELIVERY_MAX_ROWS,
            maxMs: SCHEDULED_DELIVERY_MAX_MILLISECONDS,
          }),
        },
        {
          step: 'pending-sessions',
          work: resumePendingSessions({
            store,
            actors: bindings.actors,
            configuration,
            maxRows: SCHEDULED_DELIVERY_MAX_ROWS,
            wakeInstalledSession: installedSessionWake({ configuration, actors: bindings.actors, execution }),
          }),
        },
        {
          step: 'installed-workers',
          work: recoverInstalledSessions({ store, configuration, actors: bindings.actors }),
        },
        { step: 'memory-retention', work: store.managed.memory.pruneVersions() },
      ]);
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
