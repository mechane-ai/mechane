import { Option } from 'effect';
import type { ChildProcess } from 'node:child_process';
import { isProcessExited } from './is-process-exited.ts';

type SignalGroupInput = { readonly child: ChildProcess; readonly signal: NodeJS.Signals };

/** Signals the process group the stack started the process to lead, which reaches every process of the group. */
export function signalGroup({ child, signal }: SignalGroupInput): void {
  const leader = Option.fromNullishOr(child.pid);

  if (Option.isNone(leader) || isProcessExited({ child })) {
    return;
  }

  process.kill(-leader.value, signal);
}
