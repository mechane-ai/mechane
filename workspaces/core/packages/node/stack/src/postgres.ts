import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runCommand } from './process.ts';
import type { StackState } from './state.ts';
import type { Environment } from './types.ts';

const POSTGRES_IMAGE = 'postgres:18.6';
const DATABASE_READY_MS = 30_000;
const DATABASE_CHECK_MS = 100;
const RESOURCE_REVIEW_MS = 3_600_000;
type PostgresOptions = { readonly state: StackState; readonly environment: Environment };

export type LocalPostgres = {
  readonly url: string;
  readonly migrationUrl: string;
  readonly container: string;
  readonly dump: () => Promise<string>;
  readonly stop: () => Promise<void>;
};

export async function startPostgres({ state, environment }: PostgresOptions): Promise<LocalPostgres> {
  const container = `mechane-node-${randomUUID()}`;
  const dataDirectory = join(state.directory, 'postgres');

  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });

  const dockerEnvironment = { ...environment, POSTGRES_PASSWORD: state.secrets.postgresPassword };

  async function docker(args: ReadonlyArray<string>): Promise<string> {
    return await runCommand({ command: 'docker', args, environment: dockerEnvironment });
  }

  await docker([
    'run',
    '--rm',
    '--detach',
    '--name',
    container,
    '--label',
    'io.mechane.owner=local-stack',
    '--label',
    `io.mechane.state=${state.directory}`,
    '--label',
    `io.mechane.review-after=${new Date(Date.now() + RESOURCE_REVIEW_MS).toISOString()}`,
    '--publish',
    '127.0.0.1::5432',
    '--mount',
    `type=bind,source=${dataDirectory},target=/var/lib/postgresql`,
    '--env',
    'POSTGRES_PASSWORD',
    '--env',
    'POSTGRES_USER=mechane',
    '--env',
    'POSTGRES_DB=mechane',
    POSTGRES_IMAGE,
  ]);
  await state.writeOwner({ phase: 'database', container });

  try {
    const published = await docker(['port', container, '5432/tcp']);
    const port = Number(published.trim().split(':').at(-1));

    if (!Number.isSafeInteger(port) || port <= 0) {
      throw new Error('Postgres did not publish a loopback port');
    }

    const deadlineMs = Date.now() + DATABASE_READY_MS;

    const readiness = { isReady: false };

    do {
      const ready = await docker([
        'exec',
        container,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'mechane',
        '-d',
        'mechane',
      ]).then(
        () => true,
        () => false,
      );

      if (ready) {
        readiness.isReady = true;
        break;
      }

      if (Date.now() >= deadlineMs) {
        throw new Error('Postgres did not become ready');
      }

      await delay(DATABASE_CHECK_MS);
    } while (Date.now() < deadlineMs);

    if (!readiness.isReady) {
      throw new Error('Postgres did not become ready');
    }

    await runCommand({
      command: 'docker',
      args: [
        'exec',
        '-i',
        container,
        'psql',
        '-U',
        'mechane',
        '-d',
        'mechane',
        '--set',
        'ON_ERROR_STOP=1',
        '--set',
        `runtime_password=${state.secrets.runtimePassword}`,
      ],
      environment: dockerEnvironment,
      input:
        "SELECT 'CREATE ROLE mechane_runtime LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mechane_runtime')\\gexec\nALTER ROLE mechane_runtime PASSWORD :'runtime_password';\n",
    });

    return {
      url: `postgresql://mechane_runtime:${state.secrets.runtimePassword}@127.0.0.1:${port}/mechane`,
      migrationUrl: `postgresql://mechane:${state.secrets.postgresPassword}@127.0.0.1:${port}/mechane`,
      container,
      dump: async () =>
        await docker(['exec', container, 'pg_dump', '-U', 'mechane', '-d', 'mechane', '--data-only', '--no-owner']),
      stop: async () => {
        await docker(['stop', '--time', '5', container]);
      },
    };
  } catch (error) {
    await docker(['stop', '--time', '5', container]);

    throw error;
  }
}
