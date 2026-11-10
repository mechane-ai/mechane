import type { CaptureControlChanges, ControlStore } from '@mechane/control-store';
import { Readiness, RELEASE, SandboxReport, SERVICE } from '@mechane/protocol';
import { createOperationExecutor, manageSandboxWorkspace, requireWorkspaceMember } from '@mechane/runtime';
import type { AuthCaller, MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createApplication } from './application.ts';
import { authenticateRequest } from './auth/authenticate.ts';
import { createAuthHandler } from './auth/handler.ts';
import { limitPublicRequest } from './auth/limit-public-request.ts';
import { authenticateSelfRequest } from './auth/self.ts';
import { confirmControlChanges } from './control/deliver-changes.ts';
import { createMechImportHandler } from './http/import-mech.ts';
import { createMechMaintenanceHandler } from './http/mech-maintenance.ts';
import { createProtocolHandler } from './http/protocol.ts';
import { createNotificationProducerHandler } from './notifications/producer.ts';
import { createReleaseHandler } from './releases/handler.ts';
import { createSandboxCapacityHandler } from './sandboxes/capacity.ts';
import { createSandboxCompletionHandler } from './sandboxes/completion.ts';
import { createSandboxOwnersHandler } from './sandboxes/owners.ts';
import type { ServerSettings } from './settings/server.ts';

const CONFIGURATION_CONFIRMATION_MAX_MILLISECONDS = 20_000;

type ServerInput = {
  readonly store: ControlStore;
  readonly captureControlChanges: CaptureControlChanges;
  readonly actors: MechActorResolver;
  readonly configuration: RuntimeConfiguration;
  readonly settings: ServerSettings;
  readonly runtimeRevision: string;
};

export function createServer({
  store,
  captureControlChanges,
  actors,
  configuration,
  settings,
  runtimeRevision,
}: ServerInput) {
  const authentication = settings.authentication;

  async function authenticate(request: Request, peerAddress: string | null = null): Promise<AuthCaller> {
    return await authenticateRequest({ request, peerAddress, store, configuration: authentication });
  }

  function operations(scoped: ControlStore) {
    return createOperationExecutor({
      store: scoped,
      actors,
      configuration,
      authentication,
      health: () => ({ service: SERVICE, release: RELEASE }),
      readiness: async () =>
        Schema.encodeSync(Readiness)({
          release: RELEASE,
          runtimeRevision,
          storageRevision: await scoped.schemaRevision(),
        }),
      manageSandbox: async (input) => {
        const report = await manageSandboxWorkspace({ configuration, ...input });

        return Schema.encodeSync(SandboxReport)(report);
      },
    });
  }

  const protocol = createProtocolHandler({
    execute: async (request) => {
      const captured = await captureControlChanges({ run: async (scoped) => await operations(scoped)(request) });

      await confirmControlChanges({
        store,
        actors,
        changes: captured.changes,
        maxMs: CONFIGURATION_CONFIRMATION_MAX_MILLISECONDS,
      });

      return captured.value;
    },
    authenticate,
    authenticateSelf: async (request) => await authenticateSelfRequest({ request, configuration }),
    authorizeMembership: async (input) => await requireWorkspaceMember({ store, ...input }),
    limitPublicRequest: async (name, peerAddress = null) =>
      await limitPublicRequest({ name, peerAddress, store, configuration: authentication }),
  });

  const capacity = createSandboxCapacityHandler({
    bearer: configuration.sandbox.bearer,
    acquire: async (input) => await store.acquireSandboxCapacity(input),
    release: async (input) => await store.releaseSandboxCapacity(input),
  });

  const owners = createSandboxOwnersHandler({ store, bearer: configuration.sandbox.bearer });
  const maintenance = createMechMaintenanceHandler({ store, actors, configuration });
  const imports = createMechImportHandler({ store, actors, configuration });
  const completion = createSandboxCompletionHandler({ configuration, actors });
  const notifications = createNotificationProducerHandler({ actors, producers: configuration.notificationProducers });
  const auth = createAuthHandler({ store, configuration: authentication });
  const releases = createReleaseHandler({ origin: authentication.origin });

  const application = createApplication({
    isTrustedProxy: settings.isTrustedProxy,
    handlers: [capacity, owners, completion, maintenance, imports, notifications, auth, protocol, releases],
    checkHealth: async () => await store.checkHealth(),
  });

  return async function serveRequest(request: Request, peerAddress: string | null = null): Promise<Response> {
    return await application(request, peerAddress);
  };
}
