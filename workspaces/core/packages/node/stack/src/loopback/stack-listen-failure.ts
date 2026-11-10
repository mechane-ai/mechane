import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

type StackListenFailureInput = { readonly reason: string };

/** Keeps generic listener failures in the stack's existing startup diagnostics. */
export function stackListenFailure({ reason }: StackListenFailureInput): StackFailed {
  return new StackFailed({ step: StackStep.Listen, reason });
}
