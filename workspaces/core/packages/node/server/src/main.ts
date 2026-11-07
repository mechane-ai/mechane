import { Readiness, RELEASE, SandboxReport, SERVICE } from '@mechane/protocol';
import {
  cancelWorkflow,
  createOperationExecutor,
  failRunAndWake,
  loadRuntimeConfiguration,
  manageSandboxWorkspace,
  openStore,
  readRunUIStream,
  reconcileRuns,
  requireWorkspaceMember,
  startAdmission,
} from '@mechane/runtime';
import type { AuthenticationConfiguration, RuntimeStore } from '@mechane/runtime';
import { Redacted, Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import { registerLifecycleHooks } from 'workflow/api';
import { createApplication } from './application.ts';
import { authenticateRequest } from './auth/authenticate.ts';
import { createAuthHandler } from './auth/handler.ts';
import { limitPublicRequest } from './auth/limit-public-request.ts';
import { slackWebhook } from './channels/slack-webhook.ts';
import { createConsoleHandler } from './console/handler.ts';
import { createProtocolHandler } from './http/protocol.ts';
import { listen } from './lifecycle/http-server.ts';
import { createReadiness } from './lifecycle/readiness.ts';
import { readArtifactRelease } from './lifecycle/release.ts';
import { closeHttpServer, registerShutdown } from './lifecycle/shutdown.ts';
import { createWorkflowHost, startWorkflowHost } from './lifecycle/workflow-world.ts';
import { createChatHandler } from './operations/chat.ts';
import { createReleaseHandler } from './releases/handler.ts';
import { nexusRequestEvents } from './requests/nexus-events.ts';
import { createSandboxCapacityHandler } from './sandboxes/capacity.ts';
import { loadServerSettings } from './settings/server.ts';

type AdmissionStarterInput = { readonly workflowDefinitionId: string };
type AuthenticatorInput = { readonly store: RuntimeStore; readonly configuration: AuthenticationConfiguration };

function createAdmissionStarter({ workflowDefinitionId }: AdmissionStarterInput) {
  return async function start({ runId }: { readonly runId: string }) {
    return await startAdmission({ runId, workflowDefinitionId });
  };
}

function createAuthenticator({ store, configuration }: AuthenticatorInput) {
  return async function authenticate(request: Request, peerAddress: string | null = null) {
    return await authenticateRequest({ request, peerAddress, store, configuration });
  };
}

async function runServer(): Promise<void> {
  const configuration = loadRuntimeConfiguration();
  const settings = loadServerSettings({ runtime: configuration });
  const artifactUrl = new URL(import.meta.url);
  const release = await readArtifactRelease({ artifactUrl });
  const consoleDirectory = fileURLToPath(new URL('public/console/', artifactUrl));
  const consoleHandler = createConsoleHandler({ directory: consoleDirectory });
  const releaseHandler = createReleaseHandler({ origin: settings.authentication.origin });

  const store = await openStore({
    databaseUrl: Redacted.value(configuration.databaseUrl),
    keyring: Redacted.value(configuration.credentialKeyring),
    maxConnections: configuration.maxConnections,
  });

  try {
    const { world, workflowDefinitionId } = await createWorkflowHost({ configuration, artifactUrl });

    const unregisterHooks = registerLifecycleHooks({
      onRunFailed: async ({ run }) => await failRunAndWake({ workflowId: run.runId }),
    });

    try {
      const readiness = createReadiness();
      const start = createAdmissionStarter({ workflowDefinitionId });
      const authenticate = createAuthenticator({ store, configuration: settings.authentication });

      const execute = createOperationExecutor({
        store,
        configuration,
        authentication: settings.authentication,
        startAdmission: start,
        cancelWorkflow,
        health: () => ({ service: SERVICE, release: RELEASE }),
        readiness: async () =>
          Schema.encodeSync(Readiness)({
            release: RELEASE,
            runtimeRevision: release.revision,
            storageRevision: await store.schemaRevision(),
          }),
        manageSandbox: async (input) => {
          const report = await manageSandboxWorkspace({ configuration, ...input });

          return Schema.encodeSync(SandboxReport)(report);
        },
      });

      const auth = createAuthHandler({ store, configuration: settings.authentication });
      const chat = createChatHandler({ store, authenticate, startAdmission: start, readRunUIStream });

      const capacity = createSandboxCapacityHandler({
        bearer: configuration.sandbox.bearer,
        acquire: async (input) => await store.acquireSandboxCapacity(input),
        release: async (input) => await store.releaseSandboxCapacity(input),
      });

      const protocol = createProtocolHandler({
        execute,
        authenticate,
        authorizeMembership: async (input) => await requireWorkspaceMember({ store, ...input }),
        limitPublicRequest: async (name, peerAddress = null) =>
          await limitPublicRequest({ name, peerAddress, store, configuration: settings.authentication }),
      });

      const application = createApplication({
        isTrustedProxy: settings.isTrustedProxy,
        handlers: [capacity, nexusRequestEvents, auth, chat, protocol, releaseHandler, consoleHandler],
        slack: async (input) => await slackWebhook({ ...input, startAdmission: start }),
        checkHealth: async () => await store.checkHealth(),
        isReady: readiness.isReady,
      });

      const server = await listen({ application, settings });

      try {
        await startWorkflowHost({ world });
        await reconcileRuns({ workflowDefinitionId });
        readiness.markReady();
        registerShutdown({ server, world, store, readiness, unregisterHooks });
      } catch (error) {
        readiness.beginDrain();
        await closeHttpServer({ server });

        throw error;
      }

      console.info('Mechane server is ready');
    } catch (error) {
      unregisterHooks();
      await world.close?.();

      throw error;
    }
  } catch (error) {
    await store.close();

    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await runServer();
  } catch {
    console.error('Mechane server could not start. Check deployment settings and database migrations.');

    process.exitCode = 1;
  }
}

await main();
