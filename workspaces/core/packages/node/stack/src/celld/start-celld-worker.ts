import { HttpStatusCode } from '@mechane/records';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { StackCleanupUnconfirmedError } from '../errors.ts';
import { runCommand, startProcess } from '../process.ts';
import type { LocalSourceUpdate, ManagedProcess } from '../types.ts';
import type { CelldCloseOptions, CelldReadiness, CelldWorkerOptions, LocalCelldWorker } from './types.ts';
import { startWorkerBuild } from './worker-build.ts';

const CELLD_VERSION = 'celld 0.6.3-mechane.3';
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const OWNER_INDENT_SPACES = 2;
const RESOURCE_REVIEW_MS = 3_600_000;
const LOCAL_WAKER_TICK_MS = 100;
const READY_TIMEOUT_MS = 60_000;
const PROBE_TIMEOUT_MS = 1000;
const PROBE_INTERVAL_MS = 100;
const NODE_LISTENING_MESSAGE = 'celld internal listening on ';
const DEFAULT_READINESS: Readonly<CelldReadiness> = { path: '/ready', status: HttpStatusCode.Ok };

const LOOPBACK_HOSTS: ReadonlyMap<string, string> = new Map([
  ['127.0.0.1', '127.0.0.1'],
  ['localhost', '127.0.0.1'],
  ['[::1]', '::1'],
]);

export async function startCelldWorker(input: CelldWorkerOptions): Promise<LocalCelldWorker> {
  const host = localListenHost(input.origin);

  if (input.isArtifact === true && input.isWatched === true) {
    throw new Error('An immutable Worker artifact cannot be watched');
  }

  const executable = input.celldBinary?.executable ?? 'celld';
  const expectedVersion = input.celldBinary?.version ?? CELLD_VERSION;

  const environment = {
    ...input.environment,
    NO_COLOR: '1',
    RUST_LOG: consoleLogFilter(input.environment['RUST_LOG']),
    CELLD_WAKER_TICK_MS: input.environment['CELLD_WAKER_TICK_MS'] ?? String(LOCAL_WAKER_TICK_MS),
  };

  const shouldConfirmCleanup = input.environment['CELLD_CONTAINER_HOST_SERVICES'] !== undefined;

  if (input.celldBinary !== undefined) {
    const digest = await fileDigest(executable);

    if (digest !== input.celldBinary.sha256) {
      throw new Error(`The local Worker binary checksum does not match ${executable}`);
    }
  }

  const versionOutput = await runCommand({ command: executable, args: ['--version'], environment, output: 'combined' });

  const version =
    versionOutput
      .split('\n')
      .find((line) => line.startsWith('celld '))
      ?.trim() ?? versionOutput.trim();

  if (version !== expectedVersion) {
    throw new Error(`The local Worker requires ${expectedVersion}; received ${version}`);
  }

  const directory = resolve(input.directory);
  const privateDirectory = join(directory, '.celld');
  const lockFile = join(privateDirectory, 'supervisor.lock');
  const ownerFile = join(privateDirectory, 'supervisor.json');
  const configurationFile = join(directory, 'wrangler.json');
  const logFile = join(privateDirectory, 'celld.log');
  const buildLogFile = join(privateDirectory, 'build.log');
  const bundleFile = join(directory, 'worker.mjs');

  await mkdir(privateDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await chmod(directory, PRIVATE_DIRECTORY_MODE);

  const lock = await open(lockFile, 'wx', PRIVATE_FILE_MODE);

  await lock.close();

  const resources: {
    process?: ManagedProcess;
    build?: Awaited<ReturnType<typeof startWorkerBuild>>;
    closing?: Promise<void>;
    restarting?: Promise<void>;
    artifactSha256?: string;
    isClosing?: boolean;
    closeOptions?: CelldCloseOptions;
    isLaunching?: boolean;
    shouldReload?: boolean;
    isApplying?: boolean;
    appliedSha256?: string;
    lastBuildDurationMs?: number;
    configuration: Readonly<Record<string, unknown>>;
  } = { configuration: input.configuration };

  async function record(phase: string): Promise<void> {
    const workerPid = resources.process?.child.pid;
    const childGroups = (await resources.process?.readChildGroups()) ?? [];

    await writeFile(
      ownerFile,
      JSON.stringify(
        {
          ownerPid: process.pid,
          workerPid,
          childGroups,
          phase,
          entry: resolve(input.entry),
          isArtifact: input.isArtifact === true,
          artifactSha256: resources.artifactSha256,
          configurationFile,
          directory,
          origin: input.origin.origin,
          logFile,
          buildLogFile,
          version,
          binary: input.celldBinary ?? { executable, version },
          wakerTickMs: environment.CELLD_WAKER_TICK_MS,
          rustLog: environment.RUST_LOG,
          reviewAfter: new Date(Date.now() + RESOURCE_REVIEW_MS).toISOString(),
          teardown: { signal: 'SIGTERM', processGroup: workerPid },
        },
        null,
        OWNER_INDENT_SPACES,
      ),
      { mode: PRIVATE_FILE_MODE },
    );
  }

  async function launch(deadlineMs?: number): Promise<void> {
    resources.isLaunching = true;
    resources.shouldReload = false;

    try {
      const appliedSha256 = await fileDigest(bundleFile);
      const args = ['dev', configurationFile, '--host', host, '--port', input.origin.port, '--logs', '--no-watch'];

      const logOffset = await stat(logFile).then(
        (details) => details.size,
        () => 0,
      );

      resources.process = await startProcess({
        command: executable,
        args,
        environment,
        logFile,
        directory,
        shouldOwnProcessGroup: true,
        // celld gives its node a separate process group, which survives supervisor SIGKILL on macOS.
        shouldOwnChildGroups: true,
      });

      await record('starting');
      await awaitReady({
        worker: resources.process,
        input,
        logFile,
        logOffset,
        deadlineMs,
        shouldStop: () => resources.isClosing === true,
      });

      resources.appliedSha256 = appliedSha256;

      await record('serving');
    } finally {
      resources.isLaunching = false;
    }
  }

  async function restart(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM', whileStopped?: () => Promise<void>): Promise<void> {
    const previous = resources.restarting ?? Promise.resolve();

    async function replace(): Promise<void> {
      await replaceProcess(signal, whileStopped);
    }

    const next = previous.then(replace, replace);

    resources.restarting = next;

    await next;
  }

  async function replaceProcess(signal: 'SIGTERM' | 'SIGKILL', whileStopped?: () => Promise<void>): Promise<void> {
    if (resources.closing !== undefined || resources.process === undefined) {
      throw new Error('The local Worker is stopped');
    }

    do {
      await stopProcess({ signal });

      if (resources.isClosing === true) {
        return;
      }

      try {
        await whileStopped?.();
      } finally {
        await launch();
      }
    } while (resources.shouldReload === true);
  }

  async function reload(): Promise<void> {
    if (resources.isApplying === true) {
      return;
    }

    if (resources.process === undefined || resources.closing !== undefined) {
      return;
    }

    if (resources.isLaunching === true) {
      resources.shouldReload = true;

      return;
    }

    await restart();
  }

  async function applySource(update: LocalSourceUpdate = {}): Promise<void> {
    if (resources.build === undefined || resources.isClosing === true) {
      throw new Error('Only a running source Worker can apply source changes');
    }

    resources.isApplying = true;

    try {
      await resources.build.rebuild();
    } finally {
      resources.isApplying = false;
    }

    if (update.configuration !== undefined) {
      resources.configuration = update.configuration;
    }

    await writeConfiguration();
    await restart();
  }

  async function inspect() {
    const compiledSha256 = await fileDigest(bundleFile);

    return {
      pid: resources.process?.child.pid,
      isSource: input.isArtifact !== true,
      compiledSha256,
      appliedSha256: resources.appliedSha256,
      lastBuildDurationMs: resources.lastBuildDurationMs,
    };
  }

  async function writeConfiguration(): Promise<void> {
    await writeFile(
      configurationFile,
      JSON.stringify({ ...resources.configuration, main: './worker.mjs', no_bundle: true }, null, OWNER_INDENT_SPACES),
      { mode: PRIVATE_FILE_MODE },
    );
  }

  async function close(options: CelldCloseOptions = {}): Promise<void> {
    const isExplicitRetry = resources.isClosing === true && resources.closing === undefined;

    resources.isClosing = true;

    if (isExplicitRetry) {
      resources.closeOptions = options;
    } else {
      resources.closeOptions = { ...resources.closeOptions, ...options };
    }

    if (isExplicitRetry && shouldConfirmCleanup && options.signal !== 'SIGKILL') {
      resources.closeOptions = { ...resources.closeOptions, signal: 'SIGTERM' };
    }

    resources.closing ??= closeResources(isExplicitRetry);

    try {
      await resources.closing;
    } catch (cause) {
      delete resources.closing;

      throw cause;
    }
  }

  async function stopProcess(options: CelldCloseOptions = {}): Promise<void> {
    const managed = resources.process;

    if (managed === undefined) {
      return;
    }

    const workerPid = managed.child.pid;
    const childGroups = await managed.readChildGroups();
    const requestedSignal = options.signal ?? 'SIGTERM';
    const remainingMs = shutdownTimeout(options.deadlineMs);

    await managed.stop(requestedSignal, remainingMs);
    await writeFile(
      join(privateDirectory, `exit-${workerPid}.json`),
      JSON.stringify(
        {
          ownerPid: process.pid,
          workerPid,
          childGroups,
          requestedSignal,
          actualSignal: managed.child.signalCode,
          exitCode: managed.child.exitCode,
          exitedAt: new Date().toISOString(),
          directory,
          version,
        },
        null,
        OWNER_INDENT_SPACES,
      ),
      { mode: PRIVATE_FILE_MODE },
    );
  }

  async function closeResources(isExplicitRetry: boolean): Promise<void> {
    const failures: Array<unknown> = [];

    await resources.build?.dispose().catch((error: unknown) => failures.push(error));
    await resources.restarting?.catch(() => undefined);

    const previous = resources.process?.child;
    const hasExited = previous === undefined || previous.exitCode !== null || previous.signalCode !== null;
    const shouldRetryCleanup = isExplicitRetry && shouldConfirmCleanup;

    if (shouldRetryCleanup && hasExited && previous?.exitCode !== 0) {
      resources.isClosing = false;

      try {
        await launch(resources.closeOptions?.deadlineMs);
      } catch (cause) {
        failures.push(cause);
      } finally {
        resources.isClosing = true;
      }
    }

    await stopProcess(resources.closeOptions).catch((error: unknown) => failures.push(error));

    if (shouldConfirmCleanup && resources.process !== undefined && resources.process.child.exitCode !== 0) {
      failures.push(new Error(`Native environment cleanup did not exit successfully; inspect ${ownerFile}`));
    }

    if (failures.length > 0) {
      await record('stop-failed');
      await copyFile(
        ownerFile,
        join(privateDirectory, `stop-failed-${resources.process?.child.pid ?? 'unstarted'}-${Date.now()}.json`),
      );

      throw new StackCleanupUnconfirmedError(
        directory,
        new AggregateError(failures, `The local Worker cleanup failed; inspect ${ownerFile}`),
        close,
      );
    }

    await record('stopped');
    await rm(lockFile, { force: true });
  }

  try {
    await record('building');
    await writeConfiguration();

    if (input.isArtifact === true) {
      await copyFile(input.entry, bundleFile);
      await chmod(bundleFile, PRIVATE_FILE_MODE);

      resources.artifactSha256 = await fileDigest(bundleFile);
    } else {
      resources.build = await startWorkerBuild({
        entry: input.entry,
        output: bundleFile,
        logFile: buildLogFile,
        isWatched: input.isWatched !== false,
        onBuild: async ({ durationMs }) => {
          resources.lastBuildDurationMs = durationMs;

          await reload();
        },
      });
    }

    await launch();

    if (resources.shouldReload === true) {
      await restart();
    }

    const pid = resources.process?.child.pid;

    if (pid === undefined) {
      throw new Error('The local Worker has no process identity');
    }

    return {
      origin: input.origin,
      directory,
      logFile,
      buildLogFile,
      version,
      get pid() {
        return resources.process?.child.pid ?? pid;
      },
      restart,
      applySource,
      inspect,
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new StackCleanupUnconfirmedError(
        directory,
        new AggregateError([error, cleanupError], `The local Worker failed; inspect ${logFile}`),
        close,
      );
    }

    throw new Error(`The local Worker failed; inspect ${logFile}`, { cause: error });
  }
}

type ReadyInput = {
  readonly worker: ManagedProcess;
  readonly input: CelldWorkerOptions;
  readonly logFile: string;
  readonly logOffset: number;
  readonly deadlineMs: number | undefined;
  readonly shouldStop: () => boolean;
};

async function awaitReady({
  worker,
  input,
  logFile,
  logOffset,
  deadlineMs: outerDeadline,
  shouldStop,
}: ReadyInput): Promise<void> {
  const readiness = input.readiness ?? DEFAULT_READINESS;
  const headers = readiness.headers ?? {};
  const url = new URL(readiness.path, input.origin);
  const readinessDeadlineMs = Date.now() + (readiness.timeoutMs ?? READY_TIMEOUT_MS);
  const deadlineMs = Math.min(readinessDeadlineMs, outerDeadline ?? readinessDeadlineMs);
  const observed: { status?: number; failure?: string } = {};

  const exited = worker.exited.then(() => {
    throw new Error(`The local Worker exited before readiness; inspect ${logFile}`);
  });

  async function probe(): Promise<boolean> {
    const log = await readFile(logFile);
    const currentLaunch = log.subarray(logOffset).toString('utf8');

    if (!currentLaunch.includes(NODE_LISTENING_MESSAGE)) {
      return false;
    }

    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });

      observed.status = response.status;

      await response.body?.cancel();

      return response.status === readiness.status;
    } catch (cause) {
      if (cause instanceof Error) {
        observed.failure = cause.name;
      }

      return false;
    }
  }

  do {
    if (shouldStop()) {
      throw new Error(`The local Worker startup was interrupted; inspect ${logFile}`);
    }

    if (await Promise.race([probe(), exited])) {
      return;
    }

    await Promise.race([delay(PROBE_INTERVAL_MS), exited]);
  } while (Date.now() < deadlineMs);

  throw new Error(
    `The local Worker did not become ready (${observed.status ?? observed.failure ?? 'no response'}); inspect ${logFile}`,
  );
}

function localListenHost(origin: URL): string {
  const hasResourcePath = origin.pathname !== '/' || origin.search !== '' || origin.hash !== '';
  const host = LOOPBACK_HOSTS.get(origin.hostname);
  const hasHttpPort = origin.protocol === 'http:' && origin.port !== '';

  if (host === undefined || hasResourcePath || !hasHttpPort) {
    throw new Error('The local Worker origin must be a loopback HTTP origin with an explicit port');
  }

  return host;
}

async function fileDigest(file: string): Promise<string> {
  const digest = createHash('sha256');

  for await (const chunk of createReadStream(file)) {
    if (!(chunk instanceof Uint8Array)) {
      throw new TypeError(`The local Worker input did not yield bytes from ${file}`);
    }

    digest.update(chunk);
  }

  return digest.digest('hex');
}

function shutdownTimeout(deadlineMs: number | undefined): number | undefined {
  if (deadlineMs === undefined) {
    return undefined;
  }

  return Math.max(1, deadlineMs - Date.now());
}

function consoleLogFilter(inherited = 'warn'): string {
  const parts = inherited.split('/');
  const directives = parts[0] ?? '';
  const hasConsoleDirective = /(?:^|,)\s*cell_console\s*(?::|=|\[|,|$)/.test(directives);

  if (hasConsoleDirective) {
    return inherited;
  }

  if (directives.trim() === '') {
    return ['cell_console=info', ...parts.slice(1)].join('/');
  }

  return [`${directives},cell_console=info`, ...parts.slice(1)].join('/');
}
