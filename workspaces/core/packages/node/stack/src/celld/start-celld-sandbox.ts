import { MachineId } from '@mechane/records';
import { GUEST_VARIABLES } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { realpath, writeFile as writeOwnerFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StackCleanupUnconfirmedError } from '../errors.ts';
import { runCommand } from '../process.ts';
import type {
  DiagnosticOptions,
  LocalSandbox,
  SandboxFixtureFile,
  SandboxFixtureMachine,
  SandboxFixtureWrite,
  SandboxRestartOptions,
} from '../types.ts';
import { persistedFiles } from './dump-durable-storage.ts';
import { startCelldWorker } from './start-celld-worker.ts';
import type { CelldCloseOptions, CelldWorkerOptions, LocalCelldWorker } from './types.ts';

const PRIVATE_FILE_MODE = 0o600;
const OWNER_INDENT_SPACES = 2;
const NODE_ID_CHARACTERS = 12;
const GuestEnvironment = Schema.fromJsonString(Schema.Array(Schema.String));

const FileResult = Schema.fromJsonString(
  Schema.Union([
    Schema.Struct({ found: Schema.Literal(true), contents: Schema.String }),
    Schema.Struct({ found: Schema.Literal(false) }),
  ]),
);

const READ_FILE_SCRIPT = `const fs = require('node:fs');
try { process.stdout.write(JSON.stringify({ found: true, contents: fs.readFileSync(process.argv[1], 'utf8') })); }
catch (error) { if (error.code !== 'ENOENT') throw error; process.stdout.write(JSON.stringify({ found: false })); }`;

const WRITE_FILE_SCRIPT = `const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync(path.dirname(process.argv[1]), { recursive: true });
fs.writeFileSync(process.argv[1], fs.readFileSync(0));`;

type SandboxOptions = { readonly worker: CelldWorkerOptions; readonly bearer: string };

export async function startCelldSandbox(input: SandboxOptions): Promise<LocalSandbox> {
  const worker = await startCelldWorker({ ...input.worker, isWatched: false });

  try {
    return await createSandboxDriver(input, worker);
  } catch (cause) {
    if (cause instanceof StackCleanupUnconfirmedError) {
      throw cause;
    }

    try {
      await worker.close();
    } catch (cleanupError) {
      throw new StackCleanupUnconfirmedError(
        worker.directory,
        new AggregateError([cause, cleanupError], 'The sandbox setup and its native cleanup failed'),
        worker.close,
      );
    }

    throw cause;
  }
}

async function createSandboxDriver(input: SandboxOptions, worker: LocalCelldWorker): Promise<LocalSandbox> {
  const directory = await realpath(worker.directory);
  const projectHash = createHash('sha256').update(directory).digest('hex');
  const nodeLabel = `dev-${projectHash.slice(0, NODE_ID_CHARACTERS)}`;
  const ownerFile = join(directory, '.celld', 'containers.json');
  const lifecycle: { closing?: Promise<void>; deadlineMs?: number } = {};

  async function docker(args: ReadonlyArray<string>, options: DiagnosticOptions = {}): Promise<string> {
    const command = { command: 'docker', args, environment: input.worker.environment, ...options };

    if (lifecycle.deadlineMs !== undefined) {
      return await runCommand({ ...command, timeoutMs: Math.max(1, lifecycle.deadlineMs - Date.now()) });
    }

    return await runCommand(command);
  }

  async function containers(options: DiagnosticOptions = {}): Promise<ReadonlyArray<string>> {
    const output = await docker(
      ['ps', '--all', '--quiet', '--no-trunc', '--filter', `label=celld.node=${nodeLabel}`],
      options,
    );

    return output.trim().split('\n').filter(Boolean);
  }

  async function record(phase: string, identities: ReadonlyArray<string>): Promise<void> {
    await writeOwnerFile(
      ownerFile,
      JSON.stringify(
        { ownerPid: process.pid, supervisorPid: worker.pid, phase, directory, nodeLabel, containers: identities },
        null,
        OWNER_INDENT_SPACES,
      ),
      { mode: PRIVATE_FILE_MODE },
    );
  }

  async function machines(): Promise<ReadonlyArray<SandboxFixtureMachine>> {
    const identities = await containers();
    const found: Array<SandboxFixtureMachine> = [];

    for (const containerId of identities) {
      const serialized = await docker(['inspect', '--format', '{{json .Config.Env}}', containerId]);
      const environment = Schema.decodeUnknownSync(GuestEnvironment)(serialized);
      const variable = environment.find((value) => value.startsWith(`${GUEST_VARIABLES.machineId}=`));

      if (variable !== undefined) {
        const machineId = Schema.decodeUnknownSync(MachineId)(variable.slice(GUEST_VARIABLES.machineId.length + 1));

        found.push({ machineId, containerId });
      }
    }

    return found;
  }

  async function readMachines(): Promise<ReadonlyArray<string>> {
    const found = await machines();

    return found.map((machine) => machine.machineId);
  }

  async function inspectMachine(machineId: string): Promise<SandboxFixtureMachine | undefined> {
    const decoded = Schema.decodeUnknownSync(MachineId)(machineId);
    const found = await machines();

    return found.find((machine) => machine.machineId === decoded);
  }

  async function dumpStatus(options: DiagnosticOptions = {}): Promise<string> {
    const identities = await containers(options);

    const status = await Promise.all(
      identities.map(async (containerId) => {
        const state = await docker(['inspect', '--format', '{{json .State}}', containerId], options);

        const processes = await docker(['top', containerId, '-eo', 'pid,ppid,pgid,stat,etime,comm'], options).catch(
          (cause: unknown) => diagnosticFailure(cause),
        );

        return { containerId, state, processes };
      }),
    );

    return JSON.stringify({
      capturedAt: new Date().toISOString(),
      supervisorPid: worker.pid,
      nodeLabel,
      containers: status,
    });
  }

  async function readFile(inputFile: SandboxFixtureFile): Promise<string | undefined> {
    const machine = await inspectMachine(inputFile.machineId);

    if (machine === undefined) {
      return undefined;
    }

    const serialized = await docker(['exec', machine.containerId, 'node', '-e', READ_FILE_SCRIPT, inputFile.path]);
    const result = Schema.decodeUnknownSync(FileResult)(serialized);

    if (result.found) {
      return result.contents;
    }

    return undefined;
  }

  async function writeFile(inputFile: SandboxFixtureWrite): Promise<void> {
    const machine = await inspectMachine(inputFile.machineId);

    if (machine === undefined) {
      throw new Error(`The local sandbox has no owned container for machine ${inputFile.machineId}`);
    }

    await runCommand({
      command: 'docker',
      args: ['exec', '--interactive', machine.containerId, 'node', '-e', WRITE_FILE_SCRIPT, inputFile.path],
      environment: input.worker.environment,
      input: inputFile.contents,
    });
  }

  async function restart(inputRestart: SandboxRestartOptions = {}): Promise<void> {
    await worker.restart(inputRestart.signal, inputRestart.whileStopped);

    const identities = await containers();

    await record('serving', identities);
  }

  async function loseMachine(id: string): Promise<void> {
    const machine = await inspectMachine(id);
    const identities = await containers();

    await record('machine-loss-requested', identities);

    if (machine !== undefined) {
      await docker(['rm', '--force', machine.containerId]);

      return;
    }

    throw new Error(`The local sandbox has no owned container for machine ${id}`);
  }

  async function close(deadlineMs?: number): Promise<void> {
    if (deadlineMs !== undefined) {
      lifecycle.deadlineMs = deadlineMs;
    }

    lifecycle.closing ??= closeResources();

    try {
      await lifecycle.closing;
    } catch (cause) {
      delete lifecycle.closing;

      throw cause;
    }
  }

  async function closeResources(): Promise<void> {
    const failures: Array<unknown> = [];

    const closing = closeOptions(lifecycle.deadlineMs);

    await worker.close(closing).catch((error: unknown) => failures.push(error));

    const identities = await containers();

    await record('stopping', identities);

    if (identities.length > 0) {
      await docker(['rm', '--force', ...identities]).catch((error: unknown) => failures.push(error));
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `The local sandbox cleanup failed; inspect ${ownerFile}`);
    }

    await record('stopped', []);
  }

  try {
    await record('serving', []);

    return {
      origin: worker.origin,
      bearer: input.bearer,
      get pid() {
        return worker.pid;
      },
      logFile: worker.logFile,
      readMachines,
      inspectMachine,
      dumpStatus,
      persistedFiles: (options = {}) => persistedFiles({ directory, ...options }),
      readFile,
      writeFile,
      restart,
      applySource: async (update = {}) => {
        await worker.applySource(update);

        const identities = await containers();

        await record('serving', identities);
      },
      inspect: worker.inspect,
      loseMachine,
      close,
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new StackCleanupUnconfirmedError(
        worker.directory,
        new AggregateError([error, cleanupError], 'The sandbox setup and its owned cleanup failed'),
        async (options) => await close(options?.deadlineMs),
      );
    }

    throw error;
  }
}

function diagnosticFailure(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return 'The container process status could not be captured';
}

function closeOptions(deadlineMs: number | undefined): CelldCloseOptions {
  if (deadlineMs === undefined) {
    return {};
  }

  return { deadlineMs };
}
