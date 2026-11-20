import { catalog, SERVICE } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { RELEASE } from '@mechane/releases';
import {
  createSessionObject,
  loadRuntimeConfiguration,
  managedIdentityDiscovery,
  resolveRuntimeEnvironment,
} from '@mechane/runtime';
import { serveSandbox } from '@mechane/sandbox';
import { SANDBOX_COMPLETION_PATH, SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import { DurableObject } from 'cloudflare:workers';
import { expireSignOutCookies } from './auth/sign-out.ts';
import { createConsoleHandler } from './console/handler.ts';
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
 * Inert Durable Object stub retained to preserve Cloudflare namespace compatibility on upgrades.
 *
 * @public
 */
export class MechObject extends DurableObject {
  override fetch(): Response {
    return new Response(`Retired mech namespace ${this.ctx.id.toString()}`, { status: HttpStatusCode.NotFound });
  }
}

/**
 * Cloudflare loads the per-agent execution slot class by its deployment binding name.
 *
 * @public
 */
export { AgentSlotObject } from '@mechane/agent-slot';
/**
 * Cloudflare loads the per-session runtime class by its deployment binding name.
 *
 * @public
 */
export const SessionObject = createSessionObject(installedSessionWake);
/**
 * Cloudflare loads the environment and egress classes by their deployment binding names.
 *
 * @public
 */
export { SandboxObject, MachineObject, EgressGateway } from '@mechane/sandbox';

const SCHEDULED_DELIVERY_MAX_ROWS = 50;

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- ImportMeta requires runtime interface merging.
  interface ImportMeta {
    readonly mechaneRevision: string | undefined;
  }
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
            sessions: bindings.sessions,
            slots: bindings.slots,
            wakeInstalledCapacity: installedCapacityWake({ configuration, sessions: bindings.sessions, execution }),
            wakeInstalledSession: installedSessionWake({ configuration, sessions: bindings.sessions, execution }),
            scheduleSessionOpen: sessionOpenScheduler({ configuration, sessions: bindings.sessions, execution }),
            workspaceFiles: bindings.workspaceFiles,
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
          step: 'pending-sessions',
          work: resumePendingSessions({
            store,
            sessions: bindings.sessions,
            configuration,
            maxRows: SCHEDULED_DELIVERY_MAX_ROWS,
            wakeInstalledSession: installedSessionWake({ configuration, sessions: bindings.sessions, execution }),
          }),
        },
        {
          step: 'installed-workers',
          work: recoverInstalledSessions({ store, configuration, sessions: bindings.sessions }),
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
