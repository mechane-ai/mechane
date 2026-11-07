import { spawn } from 'node:child_process';
import { open } from 'node:fs/promises';
import type { Environment, ManagedProcess } from './types.ts';

const PROCESS_STOP_MS = 25_000;
const PRIVATE_LOG_MODE = 0o600;

type ProcessOptions = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Environment;
  readonly logFile: string;
};

type CommandOptions = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Environment;
  readonly input?: string;
  readonly output?: 'stdout' | 'combined';
};

export async function runCommand(input: CommandOptions): Promise<string> {
  const child = spawn(input.command, [...input.args], { env: input.environment, stdio: ['pipe', 'pipe', 'pipe'] });

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
  const child = spawn(input.command, [...input.args], { env: input.environment, stdio: ['ignore', log.fd, log.fd] });

  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });

  await log.close();

  async function stop(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      await exited;

      return;
    }

    child.kill(signal);

    const timeout = setTimeout(() => child.kill('SIGKILL'), PROCESS_STOP_MS);

    timeout.unref();

    try {
      await exited;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { child, exited, stop };
}
