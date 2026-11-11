import { spawn } from 'node:child_process';
import type { CliInput, CliNotice, CliResult, RunningCli } from './types.ts';

const CLI_TIMEOUT_MS = 90_000;
const OUTPUT_MAX_BYTES = 4_194_304;
const APPROVAL_NOTICE = /open (\S+), sign in, and type the code ([A-Z]+-[A-Z]+)/u;

export function startCli({ stack, account, args, environment = {} }: CliInput): RunningCli {
  const variables = {
    PATH: process.env['PATH'] ?? '',
    LANG: 'C.UTF-8',
    MECHANE_ORIGIN: stack.origin.origin,
    XDG_CONFIG_HOME: account.configurationRoot,
    ...environment,
  };

  const commandArgs = [...stack.cli.args, ...args, '--output', 'json'];
  const child = spawn(stack.cli.command, commandArgs, { env: variables, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = { stdout: '', stderr: '', bytes: 0 };
  const notices = new Set<(notice: CliNotice) => void>();
  const timeout = setTimeout(() => child.kill('SIGKILL'), CLI_TIMEOUT_MS);

  const finished = new Promise<CliResult>((resolve, reject) => {
    child.once('error', () => reject(new Error('The CLI could not start')));
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      resolve({ status, signal, stdout: output.stdout, stderr: output.stderr });
    });
  });

  function receive(channel: 'stdout' | 'stderr', value: Buffer): void {
    output.bytes += value.length;

    if (output.bytes > OUTPUT_MAX_BYTES) {
      child.kill('SIGKILL');

      return;
    }

    output[channel] += value.toString('utf8');
    const match = APPROVAL_NOTICE.exec(output.stderr);

    if (match?.[1] === undefined || match[2] === undefined) {
      return;
    }

    const notice = { url: new URL(match[1]), userCode: match[2] };

    for (const resolve of notices) {
      resolve(notice);
    }

    notices.clear();
  }

  child.stdout.on('data', (value: Buffer) => receive('stdout', value));
  child.stderr.on('data', (value: Buffer) => receive('stderr', value));

  async function waitForApproval(): Promise<CliNotice> {
    const match = APPROVAL_NOTICE.exec(output.stderr);

    if (match?.[1] !== undefined && match[2] !== undefined) {
      return { url: new URL(match[1]), userCode: match[2] };
    }

    const received = new Promise<CliNotice>((resolve) => {
      notices.add(resolve);
    });

    const stopped = finished.then(() => {
      throw new Error('The CLI exited before requesting device approval');
    });

    return await Promise.race([received, stopped]);
  }

  async function stop(): Promise<void> {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }

    await finished;
  }

  return { finished, waitForApproval, stop };
}
