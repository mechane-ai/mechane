import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

type SpawnShellInput = {
  readonly command: string;
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
};

/** Spawns a detached Bash group; callers own its acknowledgement and errors. */
export function spawnShell({
  command,
  cwd,
  environment,
}: SpawnShellInput): ChildProcessByStdio<null, Readable, Readable> {
  return spawn('bash', ['-c', '--', command], {
    cwd,
    env: environment,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
