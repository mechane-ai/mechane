import { Option } from 'effect';
import type { ChildInput } from '../types.ts';

/** Whether the process has exited, with its own code or on a signal. */
export function isProcessExited({ child }: ChildInput): boolean {
  return Option.isSome(Option.fromNullishOr(child.exitCode)) || Option.isSome(Option.fromNullishOr(child.signalCode));
}
