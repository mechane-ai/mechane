import { randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { preparePostgresTls } from './postgres-tls.ts';
import type { PostgresTls } from './postgres-tls.ts';
import { runCommand } from './process.ts';
import type { StackState } from './state.ts';
import type { DiagnosticOptions, Environment } from './types.ts';

const POSTGRES_IMAGE = 'postgres:18.6';
const DATABASE_READY_MS = 30_000;
const DATABASE_CHECK_MS = 100;
const RESOURCE_REVIEW_MS = 3_600_000;
const POSTGRES_PARENT_MODE = 0o711;
const POSTGRES_LOG_LINES = 200;
const POSTGRES_LOG_CHARACTERS = 32_768;
type PostgresOptions = { readonly state: StackState; readonly environment: Environment };

export type LocalPostgres = {
  readonly url: string;
  readonly migrationUrl: string;
  readonly container: string;
  readonly clientEnvironment: Environment;
  readonly tls: PostgresTls;
  readonly dump: (options?: DiagnosticOptions) => Promise<string>;
  readonly stop: (deadlineMs?: number) => Promise<void>;
};

export async function startPostgres({ state, environment }: PostgresOptions): Promise<LocalPostgres> {
  const container = `mechane-node-${randomUUID()}`;
  const dataDirectory = join(state.directory, 'postgres');
  const user = userInfo();
  const tls = await preparePostgresTls({ directory: state.directory, environment });

  const clientEnvironment = {
    NODE_EXTRA_CA_CERTS: tls.certificateAuthority,
    CELLD_EXTRA_CA_CERTS: tls.certificateAuthority,
  };

  // Postgres 18 owns its nested PGDATA; its user must also traverse this mount inside the private stack directory.
  await mkdir(dataDirectory, { recursive: true, mode: POSTGRES_PARENT_MODE });
  await chmod(dataDirectory, POSTGRES_PARENT_MODE);

  const dockerEnvironment = { ...environment, POSTGRES_PASSWORD: state.secrets.postgresPassword };

  async function docker(args: ReadonlyArray<string>, options: DiagnosticOptions = {}): Promise<string> {
    return await runCommand({ command: 'docker', args, environment: dockerEnvironment, ...options });
  }

  await state.writeOwner({ phase: 'database', container });

  try {
    await docker([
      'run',
      '--detach',
      '--name',
      container,
      '--user',
      `${user.uid}:${user.gid}`,
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
      '--mount',
      `type=bind,source=${tls.certificate},target=/etc/mechane-postgres/server.crt,readonly`,
      '--mount',
      `type=bind,source=${tls.key},target=/etc/mechane-postgres/server.key,readonly`,
      '--env',
      'POSTGRES_PASSWORD',
      '--env',
      'POSTGRES_USER=mechane',
      '--env',
      'POSTGRES_DB=mechane',
      '--env',
      'POSTGRES_HOST_AUTH_METHOD=scram-sha-256',
      POSTGRES_IMAGE,
      'postgres',
      '-c',
      'ssl=on',
      '-c',
      'ssl_cert_file=/etc/mechane-postgres/server.crt',
      '-c',
      'ssl_key_file=/etc/mechane-postgres/server.key',
      '-c',
      'password_encryption=scram-sha-256',
    ]);

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

      const isRunning = await docker(['inspect', '--format', '{{.State.Running}}', container]);

      if (isRunning.trim() !== 'true') {
        throw new Error('Postgres exited before becoming ready');
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
      url: postgresConnectionUrl({ username: 'mechane_runtime', password: state.secrets.runtimePassword, port }),
      migrationUrl: postgresConnectionUrl({ username: 'mechane', password: state.secrets.postgresPassword, port }),
      container,
      clientEnvironment,
      tls,
      dump: async (options) =>
        await docker(
          ['exec', container, 'pg_dump', '-U', 'mechane', '-d', 'mechane', '--data-only', '--no-owner'],
          options,
        ),
      stop: async (shutdownDeadlineMs) => {
        const options = { container, environment: dockerEnvironment };

        if (shutdownDeadlineMs === undefined) {
          await stopPostgresContainer(options);

          return;
        }

        await stopPostgresContainer({ ...options, deadlineMs: shutdownDeadlineMs });
      },
    };
  } catch (error) {
    const failures: Array<unknown> = [error];

    await retainPostgresDiagnostics({ container, state, environment: dockerEnvironment }).catch((failure: unknown) =>
      failures.push(failure),
    );

    const resourcesStopped = await stopPostgresContainer({ container, environment: dockerEnvironment }).then(
      () => true,
      (failure: unknown) => {
        failures.push(failure);

        return false;
      },
    );

    await state
      .writeOwner({ phase: 'startup-failed', container, resourcesStopped })
      .catch((failure: unknown) => failures.push(failure));

    if (failures.length > 1) {
      throw new AggregateError(failures, 'Postgres startup failed; diagnostics or cleanup also failed', {
        cause: error,
      });
    }

    throw error;
  }
}

type ContainerOptions = { readonly container: string; readonly environment: Environment; readonly deadlineMs?: number };
type ConnectionInput = { readonly username: string; readonly password: string; readonly port: number };

function postgresConnectionUrl({ username, password, port }: ConnectionInput): string {
  const url = new URL('postgresql://127.0.0.1/mechane');

  url.username = username;
  url.password = password;
  url.port = String(port);

  url.searchParams.set('sslmode', 'verify-full');

  return url.href;
}

function commandDeadline(deadlineMs: number | undefined): { readonly timeoutMs?: number } {
  if (deadlineMs === undefined) {
    return {};
  }

  return { timeoutMs: Math.max(1, deadlineMs - Date.now()) };
}

async function containerExists(input: ContainerOptions): Promise<boolean> {
  const deadline = commandDeadline(input.deadlineMs);

  const id = await runCommand({
    command: 'docker',
    args: ['ps', '--all', '--filter', `name=^/${input.container}$`, '--format', '{{.ID}}'],
    environment: input.environment,
    ...deadline,
  });

  return id.trim().length > 0;
}

async function retainPostgresDiagnostics(input: ContainerOptions & { readonly state: StackState }): Promise<void> {
  if (!(await containerExists(input))) {
    return;
  }

  const state = await runCommand({
    command: 'docker',
    args: ['inspect', '--format', '{{json .State}}', input.container],
    environment: input.environment,
  });

  const logs = await runCommand({
    command: 'docker',
    args: ['logs', '--tail', String(POSTGRES_LOG_LINES), input.container],
    environment: input.environment,
    output: 'combined',
  });

  const diagnostics = `${state}\n${logs}`
    .replaceAll(input.state.secrets.postgresPassword, '[redacted]')
    .replaceAll(input.state.secrets.runtimePassword, '[redacted]');

  await writeFile(join(input.state.directory, 'postgres.log'), diagnostics.slice(-POSTGRES_LOG_CHARACTERS), {
    mode: 0o600,
  });
}

async function stopPostgresContainer(input: ContainerOptions): Promise<void> {
  if (!(await containerExists(input))) {
    return;
  }

  const failures: Array<unknown> = [];
  const deadline = commandDeadline(input.deadlineMs);

  await runCommand({
    command: 'docker',
    args: ['stop', '--time', '5', input.container],
    environment: input.environment,
    ...deadline,
  }).catch((error: unknown) => failures.push(error));

  const removalDeadline = commandDeadline(input.deadlineMs);

  await runCommand({
    command: 'docker',
    args: ['rm', '--force', input.container],
    environment: input.environment,
    ...removalDeadline,
  }).catch((error: unknown) => failures.push(error));

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Could not stop and remove the local Postgres container');
  }
}
