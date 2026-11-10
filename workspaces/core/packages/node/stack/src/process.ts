import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import type { Environment, ManagedProcess, ManagedProcessIdentity } from './types.ts';

const PROCESS_STOP_MS = 25_000;
const PRIVATE_LOG_MODE = 0o600;

type ProcessOptions = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Environment;
  readonly logFile: string;
  readonly directory?: string;
  readonly shouldOwnProcessGroup?: boolean;
  readonly shouldOwnChildGroups?: boolean;
};

type CommandOptions = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Environment;
  readonly input?: string;
  readonly output?: 'stdout' | 'combined';
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};

export async function runCommand(input: CommandOptions): Promise<string> {
  const child = spawn(input.command, [...input.args], {
    env: input.environment,
    timeout: input.timeoutMs,
    signal: input.signal,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdin.end(input.input);

  const stdout: Array<Buffer> = [];
  const stderr: Array<Buffer> = [];

  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });

  if (code !== 0) {
    const reason = Buffer.concat(stderr).toString('utf8').trim();

    throw new Error(`${input.command} failed (${code}): ${reason}`);
  }

  if (input.output === 'combined') {
    return Buffer.concat([...stdout, ...stderr]).toString('utf8');
  }

  return Buffer.concat(stdout).toString('utf8');
}

export async function startProcess(input: ProcessOptions): Promise<ManagedProcess> {
  const log = await open(input.logFile, 'a', PRIVATE_LOG_MODE);

  const child = spawn(input.command, [...input.args], {
    cwd: input.directory,
    env: input.environment,
    detached: input.shouldOwnProcessGroup === true,
    stdio: ['ignore', log.fd, log.fd],
  });

  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  await log.close();

  const owned: { groups: ReadonlyArray<ManagedProcessIdentity> } = { groups: [] };

  async function readChildGroups(): Promise<ReadonlyArray<ManagedProcessIdentity>> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return owned.groups;
    }

    const groups = await ownedChildGroups({ pid: child.pid, input });

    if (groups.length > 0) {
      owned.groups = groups;
    }

    return owned.groups;
  }

  async function stop(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM', timeoutMs = PROCESS_STOP_MS): Promise<void> {
    const childGroups = await readChildGroups();

    if (child.exitCode !== null || child.signalCode !== null) {
      await exited;
      await stopChildGroups({ groups: childGroups, environment: input.environment });

      return;
    }

    signalProcess(signal);

    const timeout = setTimeout(() => signalProcess('SIGKILL'), timeoutMs);

    timeout.unref();

    try {
      await exited;
    } finally {
      clearTimeout(timeout);
      await stopChildGroups({ groups: childGroups, environment: input.environment });
    }
  }

  function signalProcess(signal: 'SIGTERM' | 'SIGKILL'): void {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    if (input.shouldOwnProcessGroup === true && child.pid !== undefined) {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
          throw error;
        }
      }

      return;
    }

    child.kill(signal);
  }

  return { child, exited, readChildGroups, stop };
}

type OwnedGroupsInput = { readonly pid: number | undefined; readonly input: ProcessOptions };
type StopGroupsInput = { readonly groups: ReadonlyArray<ManagedProcessIdentity>; readonly environment: Environment };

async function ownedChildGroups({ pid, input }: OwnedGroupsInput): Promise<ReadonlyArray<ManagedProcessIdentity>> {
  if (input.shouldOwnChildGroups !== true || pid === undefined) {
    return [];
  }

  const processes = await processIdentities(input.environment);

  return processes.filter(
    (candidate) => candidate.pid !== pid && (candidate.parentPid === pid || candidate.group === pid),
  );
}

async function processIdentities(environment: Environment): Promise<ReadonlyArray<ManagedProcessIdentity>> {
  const output = await runCommand({ command: 'ps', args: ['-axo', 'pid=,ppid=,pgid=,lstart='], environment });
  const processes: Array<ManagedProcessIdentity> = [];

  for (const line of output.split('\n')) {
    const match = /^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line.trim());
    const [, pid, parentPid, group, started] = match ?? [];
    const hasProcessIds = pid !== undefined && parentPid !== undefined && group !== undefined;

    if (hasProcessIds && started !== undefined) {
      processes.push({ pid: Number(pid), parentPid: Number(parentPid), group: Number(group), started });
    }
  }

  return processes;
}

async function stopChildGroups({ groups, environment }: StopGroupsInput): Promise<void> {
  if (groups.length === 0) {
    return;
  }

  const current = await processIdentities(environment);
  const remainingGroups = new Set<number>();

  for (const original of groups) {
    const stillOwned = current.some(
      (candidate) =>
        candidate.pid === original.pid && candidate.started === original.started && candidate.group === original.group,
    );

    if (stillOwned) {
      remainingGroups.add(original.group);
    }
  }

  for (const group of remainingGroups) {
    try {
      process.kill(-group, 'SIGKILL');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
        throw error;
      }
    }
  }
}
