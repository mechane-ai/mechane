import type { ErrorCode, ExitStatus } from '@mechane/commands';
import { Option } from 'effect';
import type { FailureMessage } from './types.ts';

/** A failure of a step on a file, whose diagnostic is its message alone. */
type BareMessageInput = { readonly code: ErrorCode; readonly status: ExitStatus; readonly message: string };

/** The report of a failed step on a file: its message, which names the step and the file, is its whole diagnostic. */
export function bareMessage({ code, status, message }: BareMessageInput): FailureMessage {
  return { status, record: { code, message, family: Option.none() }, text: message, isLabelled: false };
}
