import { access, cp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { serverEnvironment } from './environment.ts';
import { StackStartupFailedError } from './errors.ts';
import { startFixtures } from './fixtures/start-fixtures.ts';
import { startPostgres } from './postgres.ts';
import type { LocalPostgres } from './postgres.ts';
import { runCommand, startProcess } from './process.ts';
import { startSandbox } from './sandbox/start-sandbox.ts';
import type { LocalSandbox } from './sandbox/start-sandbox.ts';
import { DEFAULT_SERVER_ENTRY, inheritedEnvironment, nodeExecutablePath } from './settings.ts';
import { openStackState } from './state.ts';
import type { Environment, LocalFixtures, LocalStack, ManagedProcess, RestartOptions, StackOptions } from './types.ts';

const READY_TIMEOUT_MS = 45_000;
const PROBE_TIMEOUT_MS = 500;
const PROBE_INTERVAL_MS = 100;
const MIGRATION_TIMEOUT_MS = 60_000;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function startLocalStack(options: StackOptions): Promise<LocalStack> {
  const builtEntry = resolvePath(options.serverEntry ?? DEFAULT_SERVER_ENTRY);

  await access(builtEntry);

  const environment = options.environment ?? inheritedEnvironment();
  const nodeExecutable = options.nodeExecutable ?? nodeExecutablePath();
  const versionOutput = await runCommand({ command: nodeExecutable, args: ['--version'], environment });
  const nodeVersion = versionOutput.trim();

  if (!nodeVersion.startsWith('v24.')) {
    throw new Error('The local stack requires the repository-pinned Node 24 executable');
  }

  const origin = options.origin ?? (await freeOrigin());

  assertLoopback(origin);

  const state = await openStackState(options);
  const entry = join(state.directory, 'server', 'server.mjs');

  const resources: {
    postgres?: LocalPostgres;
    fixtures?: LocalFixtures;
    sandbox?: LocalSandbox;
    server?: ManagedProcess;
    stopping?: Promise<void>;
    shouldPreserveFiles?: boolean;
  } = {};

  const serverLog = join(state.directory, 'server.log');
  const configuration: { environment: Environment } = { environment };

  async function stop(): Promise<void> {
    if (resources.stopping !== undefined) {
      return await resources.stopping;
    }

    resources.stopping = closeResources();

    await resources.stopping;
  }

  async function closeResources(): Promise<void> {
    const failures: Array<unknown> = [];

    if (resources.server !== undefined) {
      await resources.server.stop().catch((error: unknown) => failures.push(error));
    }

    if (resources.fixtures !== undefined) {
      await resources.fixtures.close().catch((error: unknown) => failures.push(error));
    }

    if (resources.sandbox !== undefined) {
      await resources.sandbox.close().catch((error: unknown) => failures.push(error));
    }

    if (resources.postgres !== undefined) {
      await resources.postgres.stop().catch((error: unknown) => failures.push(error));
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `Could not stop every resource recorded in ${state.directory}`);
    }

    await state.close({ shouldPreserveFiles: resources.shouldPreserveFiles === true });
  }

  async function launch(): Promise<void> {
    resources.server = await startProcess({
      command: nodeExecutable,
      args: [entry],
      environment: configuration.environment,
      logFile: serverLog,
    });

    await state.writeOwner({
      phase: 'serving',
      container: resources.postgres?.container,
      serverPid: resources.server.child.pid,
      serverLog,
    });
    await awaitReady(origin, resources.server, serverLog);
  }

  async function restart(input: RestartOptions = {}): Promise<void> {
    if (resources.stopping !== undefined || resources.server === undefined) {
      throw new Error('The local stack is stopped');
    }

    await resources.server.stop(input.signal);

    configuration.environment = { ...configuration.environment, ...input.environment };

    await launch();
  }

  try {
    await rm(dirname(entry), { recursive: true, force: true });
    await cp(dirname(builtEntry), dirname(entry), { recursive: true, dereference: true });

    resources.postgres = await startPostgres({ state, environment });

    if (options.useFixtures !== false) {
      resources.fixtures = await startFixtures(origin);
    }

    configuration.environment = serverEnvironment({
      inherited: environment,
      origin,
      databaseUrl: resources.postgres.url,
      migrationUrl: resources.postgres.migrationUrl,
      state,
      fixtures: resources.fixtures,
    });

    const useHostSandbox =
      options.sandbox === 'host-fixture' || (options.sandbox === undefined && resources.fixtures !== undefined);

    if (useHostSandbox) {
      if (resources.fixtures === undefined) {
        throw new Error('The process sandbox is available only with local provider fixtures');
      }

      resources.sandbox = await startSandbox({
        directory: join(state.directory, 'sandbox'),
        environment,
        nodeExecutable,
        runtimeOrigin: origin,
      });

      configuration.environment = {
        ...configuration.environment,
        MECHANE_SANDBOX_ORIGIN: resources.sandbox.origin.origin,
        MECHANE_SANDBOX_KEY: resources.sandbox.bearer,
      };
    } else if (
      environment['MECHANE_SANDBOX_ORIGIN'] === undefined ||
      environment['MECHANE_SANDBOX_KEY'] === undefined
    ) {
      throw new Error('Configured mode requires a sandbox service origin and credential');
    }

    const setupEnvironment = { ...configuration.environment, WORKFLOW_POSTGRES_URL: resources.postgres.migrationUrl };

    for (const file of ['migrate.mjs', 'workflow/bootstrap/dist/cli.mjs', 'grant.mjs']) {
      const migration = await startProcess({
        command: nodeExecutable,
        args: [join(dirname(entry), file)],
        environment: setupEnvironment,
        logFile: serverLog,
      });

      const migrationTimeout = setTimeout(() => migration.child.kill('SIGKILL'), MIGRATION_TIMEOUT_MS);
      const migrated = await migration.exited.finally(() => clearTimeout(migrationTimeout));

      if (migrated !== 0) {
        throw new Error(`The local database setup failed at ${file}; inspect ${serverLog}`);
      }
    }

    await launch();

    const postgres = resources.postgres;

    return {
      origin,
      databaseUrl: postgres.url,
      stateDirectory: state.directory,
      fixtures: resources.fixtures,
      serverLog,
      postgresContainer: postgres.container,
      nodeVersion,
      dumpStorage: postgres.dump,
      restart,
      stop,
    };
  } catch (error) {
    resources.shouldPreserveFiles = true;

    await stop();

    throw new StackStartupFailedError(state.directory, error);
  }
}

async function awaitReady(origin: URL, server: ManagedProcess, logFile: string): Promise<void> {
  const deadlineMs = Date.now() + READY_TIMEOUT_MS;

  const exited = server.exited.then(() => {
    throw new Error(`The Node server exited before readiness; inspect ${logFile}`);
  });

  do {
    const probe = fetch(new URL('/ready', origin), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }).then(
      (response) => response.ok,
      () => false,
    );

    const ready = await Promise.race([probe, exited]);

    if (ready) {
      return;
    }

    if (Date.now() >= deadlineMs) {
      throw new Error(`The Node server did not become ready; inspect ${logFile}`);
    }

    await Promise.race([delay(PROBE_INTERVAL_MS), exited]);
  } while (Date.now() < deadlineMs);

  throw new Error(`The Node server did not become ready; inspect ${logFile}`);
}

async function freeOrigin(): Promise<URL> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Could not reserve a local service port');
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);

        return;
      }

      resolve();
    });
  });

  return new URL(loopbackOriginUrl({ port: address.port }));
}

function assertLoopback(origin: URL): void {
  const hasResourcePath = origin.pathname !== '/' || origin.search !== '' || origin.hash !== '';

  if (origin.protocol !== 'http:' || !LOOPBACK_HOSTS.has(origin.hostname) || hasResourcePath) {
    throw new Error('The local stack origin must be a loopback HTTP origin');
  }
}

function loopbackOriginUrl({ port }: { readonly port: number }): string {
  return `http://127.0.0.1:${port}`;
}
