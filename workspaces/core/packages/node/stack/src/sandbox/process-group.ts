import type { ChildProcess } from 'node:child_process';

type SignalInput = { readonly child: ChildProcess; readonly signal: NodeJS.Signals };

export function signalProcessGroup({ child, signal }: SignalInput): void {
  if (child.pid === undefined) {
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    const isSystemError = error instanceof Error && 'code' in error;

    if (isSystemError && error.code === 'ESRCH') {
      return;
    }

    throw error;
  }
}
