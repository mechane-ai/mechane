import type { SlotNamespace } from '@mechane/agent-slot';
import type { ControlStore } from '@mechane/control-store';
import { Readiness, SERVICE } from '@mechane/protocol';
import { RELEASE } from '@mechane/releases';
import { createOperationExecutor, requireWorkspaceMember } from '@mechane/runtime';
import type { AuthCaller, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createApplication } from './application.ts';
import { authenticateRequest } from './auth/authenticate.ts';
import { createAuthHandler } from './auth/handler.ts';
import { limitPublicRequest } from './auth/limit-public-request.ts';
import { createProtocolHandler } from './http/protocol.ts';
import { createManagedGitHandler } from './managed/git.ts';
import { createManagedHandler } from './managed/handler.ts';
import type { ManagedRequest } from './managed/types.ts';
import { createReleaseHandler } from './releases/handler.ts';
import { createSandboxCapacityHandler } from './sandboxes/capacity.ts';
import { createSandboxCompletionHandler } from './sandboxes/completion.ts';
import { createSandboxOwnersHandler } from './sandboxes/owners.ts';
import { destroyExternalSandboxSession } from './sandboxes/reconcile-installed.ts';
import type { ServerSettings } from './settings/server.ts';

type ServerInput = {
  readonly store: ControlStore;
  readonly sessions: Pick<SlotNamespace, 'getByName'>;
  readonly slots: Pick<SlotNamespace, 'getByName'>;
  readonly wakeInstalledCapacity: () => void;
  readonly wakeInstalledSession: ManagedRequest['wakeInstalledSession'];
  readonly scheduleSessionOpen: ManagedRequest['scheduleSessionOpen'];
  readonly workspaceFiles?: R2Bucket | undefined;
  readonly configuration: RuntimeConfiguration;
  readonly settings: ServerSettings;
  readonly runtimeRevision: string;
};

export function createServer({
  store,
  sessions,
  slots,
  wakeInstalledCapacity,
  wakeInstalledSession,
  scheduleSessionOpen,
  workspaceFiles,
  configuration,
  settings,
  runtimeRevision,
}: ServerInput) {
  const authentication = settings.authentication;

  async function authenticate(request: Request, peerAddress: string | null = null): Promise<AuthCaller> {
    return await authenticateRequest({ request, peerAddress, store, configuration: authentication });
  }

  const executeOperation = createOperationExecutor({
    store,
    configuration,
    authentication,
    health: () => ({ service: SERVICE, release: RELEASE }),
    readiness: async () =>
      Schema.encodeSync(Readiness)({
        release: RELEASE,
        runtimeRevision,
        storageRevision: await store.schemaRevision(),
      }),
  });

  const git = createManagedGitHandler({ store, configuration });

  const managed = createManagedHandler({
    store,
    configuration,
    authentication,
    managedIdentity: settings.managedIdentity,
    sessions,
    slots,
    wakeInstalledSession,
    destroyInstalledSession: async (target) => {
      await destroyExternalSandboxSession({ store, configuration, ...target });

      const removedKeys = await store.managed.evidence.deleteBySession({
        workspaceId: target.workspaceId,
        sessionId: target.sessionId,
      });

      const bucket = workspaceFiles;

      if (bucket !== undefined && removedKeys.length > 0) {
        await bucket.delete([...removedKeys]);
      }
    },
    workspaceFiles,
    scheduleSessionOpen,
  });

  const protocol = createProtocolHandler({
    execute: async (request) => {
      const value = await executeOperation(request);

      if (request.name === 'setWorkspacePolicy') {
        wakeInstalledCapacity();
      }

      return value;
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
  const completion = createSandboxCompletionHandler({ configuration });
  const auth = createAuthHandler({ store, configuration: authentication });
  const releases = createReleaseHandler({ origin: authentication.origin });

  const application = createApplication({
    isTrustedProxy: settings.isTrustedProxy,
    handlers: [git, managed, capacity, owners, completion, auth, protocol, releases],
    checkHealth: async () => await store.checkHealth(),
  });

  return async function serveRequest(request: Request, peerAddress: string | null = null): Promise<Response> {
    return await application(request, peerAddress);
  };
}
