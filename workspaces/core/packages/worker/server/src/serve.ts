import type { CaptureControlChanges, ControlStore } from '@mechane/control-store';
import { Readiness, RELEASE, SandboxReport, SERVICE } from '@mechane/protocol';
import { createOperationExecutor, manageSandboxWorkspace, requireWorkspaceMember } from '@mechane/runtime';
import type { ActorNamespace, AuthCaller, MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createApplication } from './application.ts';
import { authenticateRequest } from './auth/authenticate.ts';
import { createAuthHandler } from './auth/handler.ts';
import { limitPublicRequest } from './auth/limit-public-request.ts';
import { confirmControlChanges } from './control/deliver-changes.ts';
import { createMechImportHandler } from './http/import-mech.ts';
import { createMechMaintenanceHandler } from './http/mech-maintenance.ts';
import { createProtocolHandler } from './http/protocol.ts';
import { createManagedGitHandler } from './managed/git.ts';
import { createManagedHandler } from './managed/handler.ts';
import type { ManagedRequest } from './managed/types.ts';
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
  readonly actorNamespace: ActorNamespace;
  readonly wakeInstalledCapacity: () => void;
  readonly wakeInstalledSession: ManagedRequest['wakeInstalledSession'];
  readonly scheduleSessionOpen: ManagedRequest['scheduleSessionOpen'];
  readonly configuration: RuntimeConfiguration;
  readonly settings: ServerSettings;
  readonly runtimeRevision: string;
};

export function createServer({
  store,
  captureControlChanges,
  actors,
  actorNamespace,
  wakeInstalledCapacity,
  wakeInstalledSession,
  scheduleSessionOpen,
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

  const git = createManagedGitHandler({ store, configuration });

  const managed = createManagedHandler({
    store,
    configuration,
    authentication,
    managedIdentity: settings.managedIdentity,
    actors: actorNamespace,
    wakeInstalledSession,
    scheduleSessionOpen,
  });

  const protocol = createProtocolHandler({
    execute: async (request) => {
      const captured = await captureControlChanges({ run: async (scoped) => await operations(scoped)(request) });

      if (request.name === 'setWorkspacePolicy') {
        wakeInstalledCapacity();
      }

      await confirmControlChanges({
        store,
        actors,
        changes: captured.changes,
        maxMs: CONFIGURATION_CONFIRMATION_MAX_MILLISECONDS,
      });

      return captured.value;
    },
    authenticate,
    authorizeMembership: async (input) => await requireWorkspaceMember({ store, ...input }),
    limitPublicRequest: async (name, peerAddress = null) =>
      await limitPublicRequest({ name, peerAddress, store, configuration: authentication }),
  });

  const capacity = createSandboxCapacityHandler({
    bearer: configuration.sandbox.bearer,
    maximumMachines: configuration.maxMachines,
    acquire: async (input) => await store.acquireSandboxCapacity(input),
    release: async (input) => await store.releaseSandboxCapacity(input),
  });

  const owners = createSandboxOwnersHandler({ store, configuration });
  const maintenance = createMechMaintenanceHandler({ store, actors, configuration });
  const imports = createMechImportHandler({ store, actors, configuration });
  const completion = createSandboxCompletionHandler({ configuration, actors });
  const auth = createAuthHandler({ store, configuration: authentication });
  const releases = createReleaseHandler({ origin: authentication.origin });

  const application = createApplication({
    isTrustedProxy: settings.isTrustedProxy,
    handlers: [git, managed, capacity, owners, completion, maintenance, imports, auth, protocol, releases],
    checkHealth: async () => await store.checkHealth(),
  });

  return async function serveRequest(request: Request, peerAddress: string | null = null): Promise<Response> {
    return await application(request, peerAddress);
  };
}
