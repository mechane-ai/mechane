import { applicationWorkerDeployment, sandboxWorkerDeployment } from '@mechane/deployment';
import { HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { captureStackFailure } from './capture-failure.ts';
import { drainSandboxes } from './celld/drain-sandboxes.ts';
import { dumpDurableStorage } from './celld/dump-durable-storage.ts';
import { startCelldSandbox } from './celld/start-celld-sandbox.ts';
import { startCelldWorker } from './celld/start-celld-worker.ts';
import type { LocalCelldWorker } from './celld/types.ts';
import { startConsoleDevelopment } from './console/start-console-development.ts';
import type { ConsoleDevelopment } from './console/start-console-development.ts';
import { localSandboxVariables, serverEnvironment } from './environment.ts';
import { StackStartupFailedError } from './errors.ts';
import { startFixtures } from './fixtures/start-fixtures.ts';
import { applyConversationImport } from './fixtures/store/apply-conversation-import.ts';
import { seedConversationImport } from './fixtures/store/conversation-import.ts';
import { startGuestGateway } from './guest-gateway.ts';
import type { GuestGateway } from './guest-gateway.ts';
import { freeLocalOrigin } from './local-origin.ts';
import { startPostgres } from './postgres.ts';
import type { LocalPostgres } from './postgres.ts';
import { runCommand, startProcess } from './process.ts';
import { inheritedEnvironment, nodeExecutablePath } from './settings.ts';
import { openStackState } from './state.ts';
import type {
  ConversationImportScope,
  Environment,
  LocalFixtures,
  LocalSandbox,
  LocalStack,
  RestartOptions,
  StackOptions,
} from './types.ts';
import {
  databaseProgramPath,
  DEFAULT_GUEST_IMAGE,
  defaultWorkerEntry,
  workerBinaryOptions,
  workerLocations,
} from './worker-settings.ts';

const MIGRATION_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 60_000;
const SANDBOX_START_TIMEOUT_MS = 600_000;
const PRIVATE_DIRECTORY_MODE = 0o700;
type ResourceName = 'application' | 'console' | 'sandbox' | 'gateway' | 'fixtures' | 'postgres';

export async function startLocalStack(options: StackOptions): Promise<LocalStack> {
  const isSource = options.isSource === true;
  const isConsoleDevelopment = options.isConsoleDevelopment === true;

  if (isConsoleDevelopment && !isSource) {
    throw new Error('Console development requires a source Worker');
  }

  const defaultEntry = defaultWorkerEntry({ isSource });
  const suppliedEntry = resolve(options.serverEntry ?? defaultEntry);

  await access(suppliedEntry);

  const environment = options.environment ?? inheritedEnvironment();
  const nodeExecutable = options.nodeExecutable ?? nodeExecutablePath();
  const nodeVersionOutput = await runCommand({ command: nodeExecutable, args: ['--version'], environment });
  const nodeVersion = nodeVersionOutput.trim();
  const binaryOptions = workerBinaryOptions({ binary: options.celldBinary });

  if (!nodeVersion.startsWith('v24.')) {
    throw new Error('The local stack requires the repository-pinned Node 24 executable');
  }

  const origin = options.origin ?? (await freeLocalOrigin());
  const applicationOrigin = await applicationListenerOrigin({ origin, isConsoleDevelopment });
  const state = await openStackState(options);
  const artifactDirectory = join(state.directory, 'candidate');

  const resources: {
    application?: LocalCelldWorker;
    sandbox?: LocalSandbox;
    postgres?: LocalPostgres;
    fixtures?: LocalFixtures;
    closing?: Promise<void>;
    isServing?: boolean;
    shouldPreserveFiles?: boolean;
    gateway?: GuestGateway;
    console?: ConsoleDevelopment;
    hasDrained?: boolean;
  } = {};

  const configuration: { environment: Environment } = { environment };
  const released = new Set<ResourceName>();
  const migrationLog = join(state.directory, 'database-setup.log');
  const applicationDirectory = join(state.directory, 'application');
  const serverLog = join(applicationDirectory, '.celld', 'celld.log');
  const consoleLog = join(state.directory, 'console.log');
  const locations = workerLocations({ isSource, suppliedEntry, artifactDirectory });
  const entry = locations.entry;
  const assetsDirectory = resolve(options.assetsDirectory ?? locations.assets);

  async function record(details: Readonly<Record<string, unknown>>): Promise<void> {
    await state.writeOwner({
      origin: origin.origin,
      applicationOrigin: applicationOrigin.origin,
      postgresContainer: resources.postgres?.container,
      applicationPid: resources.application?.pid,
      sandboxPid: resources.sandbox?.pid,
      sandboxOrigin: resources.sandbox?.origin.origin,
      serverLog,
      migrationLog,
      consoleLog,
      consolePid: resources.console?.pid,
      guestGatewayOrigin: resources.gateway?.guestOrigin.origin,
      stoppedResources: [...released],
      ...details,
    });
  }

  async function launch(): Promise<void> {
    const assets = applicationAssetsOptions({ isConsoleDevelopment });

    const deployment = applicationWorkerDeployment({
      name: 'mechane-local',
      entry,
      variables: workerVariables(configuration.environment),
      ...assets,
    });

    resources.application = await startCelldWorker({
      entry,
      configuration: deployment,
      directory: applicationDirectory,
      origin: applicationOrigin,
      environment: { ...environment, ...resources.postgres?.clientEnvironment },
      ...binaryOptions,
      isArtifact: !isSource,
      isWatched: isSource,
    });

    resources.isServing = true;

    await record({ phase: 'serving' });
  }

  async function runDatabaseProgram(name: string): Promise<void> {
    const file = databaseProgramPath({ isSource, directory: dirname(entry), name });

    const program = await startProcess({
      command: nodeExecutable,
      args: [file],
      environment: configuration.environment,
      logFile: migrationLog,
    });

    const timeout = setTimeout(() => program.child.kill('SIGKILL'), MIGRATION_TIMEOUT_MS);
    const code = await program.exited.finally(() => clearTimeout(timeout));

    if (code !== 0) {
      throw new Error(`The local database setup failed at ${name}; inspect ${migrationLog}`);
    }
  }

  async function restart(input: RestartOptions = {}): Promise<void> {
    if (resources.closing !== undefined || resources.application === undefined) {
      throw new Error('The local stack is stopped');
    }

    if (input.environment === undefined) {
      await resources.application.restart(input.signal);

      return;
    }

    await resources.application.close({ signal: input.signal ?? 'SIGTERM' });

    configuration.environment = { ...configuration.environment, ...input.environment };

    await launch();
  }

  async function stop(): Promise<void> {
    resources.closing ??= closeResources();

    try {
      await resources.closing;
    } catch (cause) {
      delete resources.closing;

      throw cause;
    }
  }

  async function closeResources(): Promise<void> {
    const deadlineMs = Date.now() + SHUTDOWN_TIMEOUT_MS;
    const shouldDrain = options.mode === 'persistent' && resources.isServing === true && resources.hasDrained !== true;

    if (shouldDrain && resources.sandbox !== undefined) {
      try {
        await drainSandboxes({ origin: applicationOrigin, sandbox: resources.sandbox, deadlineMs, report: record });

        resources.hasDrained = true;
      } catch (cause) {
        await record({
          phase: 'shutdown-blocked',
          recovery: 'Inspect the recorded sandbox stop and retry after repair',
          deadlineMs,
        });

        throw new Error(`The local stack remains available to preserve environment files; inspect ${state.directory}`, {
          cause,
        });
      }
    }

    const failures: Array<unknown> = [];

    async function release(name: ResourceName, close: () => Promise<void | undefined>): Promise<void> {
      if (released.has(name)) {
        return;
      }

      try {
        await close();

        released.add(name);
      } catch (cause) {
        failures.push(cause);
      }
    }

    await release('application', async () => await resources.application?.close({ deadlineMs }));
    await release('console', async () => await resources.console?.close(deadlineMs));
    await release('sandbox', async () => await resources.sandbox?.close(deadlineMs));
    await release('gateway', async () => await resources.gateway?.close());
    await release('fixtures', async () => await resources.fixtures?.close());
    await release('postgres', async () => await resources.postgres?.stop(deadlineMs));

    if (failures.length > 0) {
      await record({ phase: 'shutdown-failed' });

      throw new AggregateError(failures, `Could not stop every resource recorded in ${state.directory}`);
    }

    await state.close({ shouldPreserveFiles: resources.shouldPreserveFiles === true });
  }

  async function prepareConversationImport(input: ConversationImportScope) {
    const hasDisposableFixtures = options.mode === 'ephemeral' && resources.fixtures !== undefined;

    if (!hasDisposableFixtures || resources.postgres === undefined || resources.application === undefined) {
      throw new Error('Historical conversation preparation requires an active disposable fixture stack');
    }

    const configuredBearer = configuration.environment['MECHANE_SANDBOX_SERVICE_KEY'];

    if (configuredBearer === undefined) {
      throw new Error('Historical conversation import requires the configured internal service credential');
    }

    const bearer = configuredBearer;

    const fixture = await seedConversationImport({
      ...input,
      container: resources.postgres.container,
      environment,
      migrationUrl: resources.postgres.migrationUrl,
    });

    async function applyMigration(): Promise<void> {
      await applyConversationImport({
        ...input,
        fixture,
        origin,
        bearer,
        directory: state.directory,
        runProgram: async ({ name, arguments: programArguments, environment: programEnvironment }) => {
          const file = databaseProgramPath({ isSource, directory: dirname(entry), name });

          return await runCommand({
            command: nodeExecutable,
            args: [file, ...programArguments],
            environment: { ...configuration.environment, ...programEnvironment },
            timeoutMs: MIGRATION_TIMEOUT_MS,
          });
        },
      });
    }

    return { runId: fixture.runId, publications: fixture.publications, applyMigration };
  }

  try {
    if (!isSource) {
      await rm(artifactDirectory, { recursive: true, force: true });
      await cp(dirname(suppliedEntry), artifactDirectory, { recursive: true, dereference: true });
    }

    await mkdir(applicationDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

    if (!isConsoleDevelopment) {
      await access(assetsDirectory);
      await rm(join(applicationDirectory, 'console'), { recursive: true, force: true });
      await cp(assetsDirectory, join(applicationDirectory, 'console'), { recursive: true });
    }

    resources.postgres = await startPostgres({ state, environment });

    if (options.useFixtures !== false) {
      resources.fixtures = await startFixtures(origin);
    }

    const configured = serverEnvironment({
      inherited: { ...environment, ...resources.postgres.clientEnvironment },
      origin,
      databaseUrl: resources.postgres.url,
      migrationUrl: resources.postgres.migrationUrl,
      state,
      fixtures: resources.fixtures,
    });

    configuration.environment = {
      ...configured,
      MECHANE_ORIGIN: origin.origin,
      MECHANE_SANDBOX_SERVICE_KEY: environment['MECHANE_SANDBOX_SERVICE_KEY'] ?? state.secrets.sandboxKey,
    };

    if (options.sandbox === 'configured') {
      if (
        environment['MECHANE_SANDBOX_ORIGIN'] === undefined ||
        environment['MECHANE_SANDBOX_SERVICE_KEY'] === undefined
      ) {
        throw new Error('Configured mode requires a sandbox service origin and credential');
      }
    } else {
      const sandboxOrigin = await freeLocalOrigin();
      resources.gateway = await startGuestGateway({ target: applicationOrigin, tls: resources.postgres.tls });

      await record({ phase: 'guest-transport' });

      const certificatesPem = await readFile(resources.postgres.tls.certificateAuthority, 'utf8');

      const sandboxVariables = localSandboxVariables({
        inherited: environment,
        origin: applicationOrigin,
        bearer: state.secrets.sandboxKey,
      });

      const variables = { ...sandboxVariables, MECHANE_SANDBOX_TRUSTED_CERTIFICATES_PEM: certificatesPem };

      const deployment = sandboxWorkerDeployment({
        name: 'mechane-local-environments',
        entry,
        variables,
        image: options.sandboxImage ?? DEFAULT_GUEST_IMAGE,
        bucketName: 'mechane-local-workspace-files',
      });

      resources.sandbox = await startCelldSandbox({
        bearer: state.secrets.sandboxKey,
        worker: {
          entry,
          configuration: deployment,
          directory: join(state.directory, 'sandbox'),
          origin: sandboxOrigin,
          environment,
          ...binaryOptions,
          isArtifact: !isSource,
          readiness: {
            path: '/internal/sandboxes/probe/probe/workspace',
            status: HttpStatusCode.Unauthorized,
            timeoutMs: SANDBOX_START_TIMEOUT_MS,
          },
        },
      });

      configuration.environment = {
        ...configuration.environment,
        MECHANE_SANDBOX_ORIGIN: resources.sandbox.origin.origin,
        MECHANE_SANDBOX_SERVICE_KEY: resources.sandbox.bearer,
        MECHANE_TOOL_ORIGIN: resources.gateway.guestOrigin.origin,
      };
    }

    await runDatabaseProgram('migrate');
    await runDatabaseProgram('grant');
    await launch();

    if (isConsoleDevelopment) {
      await record({ phase: 'console-starting' });

      resources.console = await startConsoleDevelopment({
        origin,
        applicationOrigin,
        directory: join(state.directory, 'console'),
        logFile: consoleLog,
        environment,
        nodeExecutable,
      });

      await record({ phase: 'serving' });
    }

    const postgres = resources.postgres;

    const stack: LocalStack = {
      origin,
      databaseUrl: postgres.url,
      stateDirectory: state.directory,
      fixtures: resources.fixtures,
      sandbox: resources.sandbox,
      serverLog,
      postgresContainer: postgres.container,
      nodeVersion,
      dumpStorage: async (input = {}) => {
        const [relational, durable] = await Promise.all([
          postgres.dump(input),
          dumpDurableStorage({ directories: [applicationDirectory, join(state.directory, 'sandbox')], ...input }),
        ]);

        return `${relational}\n${durable}`;
      },
      captureFailure: async (label) => await captureStackFailure({ stack, label, environment }),
      restart,
      prepareConversationImport,
      stop,
    };

    return stack;
  } catch (cause) {
    resources.shouldPreserveFiles = true;

    await stop();

    await record({ phase: 'startup-failed', resourcesStopped: true });

    throw new StackStartupFailedError(state.directory, cause);
  }
}

function workerVariables(environment: Environment): Readonly<Record<string, string>> {
  const variables: Record<string, string> = {};

  for (const [name, value] of Record.toEntries(environment)) {
    if (name.startsWith('MECHANE_') && !name.startsWith('MECHANE_LOCAL_') && !HOST_VARIABLES.has(name)) {
      variables[name] = value;
    }
  }

  return variables;
}

const HOST_VARIABLES: ReadonlySet<string> = new Set([
  'MECHANE_MIGRATION_DATABASE_URL',
  'MECHANE_RUNTIME_DATABASE_ROLE',
  'MECHANE_NODE_EXECUTABLE',
]);

type ConsoleMode = { readonly isConsoleDevelopment: boolean };

async function applicationListenerOrigin(input: ConsoleMode & { readonly origin: URL }): Promise<URL> {
  if (input.isConsoleDevelopment) {
    return await freeLocalOrigin();
  }

  return input.origin;
}

function applicationAssetsOptions(input: ConsoleMode): { readonly assetsDirectory?: string } {
  if (input.isConsoleDevelopment) {
    return {};
  }

  return { assetsDirectory: './console' };
}
