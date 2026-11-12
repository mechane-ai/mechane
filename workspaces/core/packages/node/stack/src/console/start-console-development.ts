import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { InlineConfig } from 'vite';
import { startProcess } from '../process.ts';
import type { Environment } from '../types.ts';

const CONSOLE_DIRECTORY = fileURLToPath(new URL('../../../../browser/console', import.meta.url));
const WATCH_INTERVAL_MS = 150;
const READY_INTERVAL_MS = 100;
const READY_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 1000;
const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;
const APPLICATION_ROUTE = '^(?!/(?:console(?:/|$)|virtual:stylex(?:[.:/]|$)))';
const OWNER_INDENT_SPACES = 2;
const RESOURCE_REVIEW_MS = 3_600_000;

type ConsoleInput = {
  readonly origin: URL;
  readonly applicationOrigin: URL;
  readonly directory: string;
  readonly logFile: string;
  readonly nodeExecutable: string;
  readonly environment: Environment;
};

export type ConsoleDevelopment = {
  readonly pid: number | undefined;
  readonly close: (deadlineMs?: number) => Promise<void>;
};

export async function startConsoleDevelopment(input: ConsoleInput): Promise<ConsoleDevelopment> {
  const require = createRequire(join(CONSOLE_DIRECTORY, 'package.json'));
  const packageFile = require.resolve('vite/package.json');
  const executable = join(dirname(packageFile), 'bin', 'vite.js');
  const configuration = join(input.directory, 'vite.config.mjs');
  const ownerFile = join(input.directory, 'supervisor.json');
  const consoleConfiguration = join(CONSOLE_DIRECTORY, 'vite.config.ts');
  const existingLog = await readFile(input.logFile, 'utf8').catch(() => '');
  const source = consoleConfigurationSource({ ...input, consoleConfiguration });

  await mkdir(input.directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await writeFile(configuration, source, { mode: PRIVATE_FILE_MODE });

  const managed = await startProcess({
    command: input.nodeExecutable,
    args: [executable, '--config', configuration, '--clearScreen', 'false'],
    directory: CONSOLE_DIRECTORY,
    environment: { ...input.environment, NO_COLOR: '1' },
    logFile: input.logFile,
    shouldOwnProcessGroup: true,
    shouldOwnChildGroups: true,
  });

  async function record(phase: string): Promise<void> {
    const childGroups = await managed.readChildGroups();

    await writeFile(
      ownerFile,
      JSON.stringify(
        {
          ownerPid: process.pid,
          workerPid: managed.child.pid,
          childGroups,
          phase,
          origin: input.origin.origin,
          applicationOrigin: input.applicationOrigin.origin,
          configuration,
          logFile: input.logFile,
          executable,
          nodeExecutable: input.nodeExecutable,
          reviewAfter: new Date(Date.now() + RESOURCE_REVIEW_MS).toISOString(),
          teardown: { signal: 'SIGTERM', processGroup: managed.child.pid },
        },
        null,
        OWNER_INDENT_SPACES,
      ),
      { mode: PRIVATE_FILE_MODE },
    );
  }

  try {
    await record('starting');

    const deadlineMs = Date.now() + READY_TIMEOUT_MS;
    const url = new URL('/console/@vite/client', input.origin);

    do {
      if (managed.child.exitCode !== null || managed.child.signalCode !== null) {
        throw new Error(`The Console development server exited; inspect ${input.logFile}`);
      }

      const log = await readFile(input.logFile, 'utf8');

      if (log.slice(existingLog.length).includes(input.origin.origin)) {
        const isReady = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then(
          async (response) => {
            await response.body?.cancel();

            return response.status === HttpStatusCode.Ok;
          },
          () => false,
        );

        if (isReady) {
          await record('serving');

          return {
            pid: managed.child.pid,
            close: async (shutdownDeadlineMs) => {
              if (shutdownDeadlineMs === undefined) {
                await managed.stop();
                await record('stopped');

                return;
              }

              const remainingMs = Math.max(1, shutdownDeadlineMs - Date.now());

              await managed.stop('SIGTERM', remainingMs);
              await record('stopped');
            },
          };
        }
      }

      await delay(READY_INTERVAL_MS);
    } while (Date.now() < deadlineMs);

    throw new Error(`The Console development server did not become ready; inspect ${input.logFile}`);
  } catch (cause) {
    await managed.stop();
    await record('stopped');

    throw cause;
  }
}

type ConfigurationInput = ConsoleInput & { readonly consoleConfiguration: string };

function consoleConfigurationSource(input: ConfigurationInput): string {
  const configuration: InlineConfig = {
    root: CONSOLE_DIRECTORY,
    server: {
      host: input.origin.hostname,
      port: Number(input.origin.port),
      strictPort: true,
      headers: {
        [HttpHeader.CrossOriginOpenerPolicy]: 'same-origin',
        [HttpHeader.CrossOriginEmbedderPolicy]: 'require-corp',
      },
      proxy: { [APPLICATION_ROUTE]: { target: input.applicationOrigin.origin, changeOrigin: false, ws: true } },
      watch: { usePolling: true, interval: WATCH_INTERVAL_MS },
    },
  };

  return `import consoleConfiguration from ${JSON.stringify(input.consoleConfiguration)};\nconst local = ${JSON.stringify(configuration)};\nexport default { ...consoleConfiguration, ...local, server: { ...consoleConfiguration.server, ...local.server } };\n`;
}
