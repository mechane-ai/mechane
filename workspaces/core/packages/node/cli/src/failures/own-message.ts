import type { ErrorCode, ExitStatus } from '@mechane/commands';
import { Option } from 'effect';
import type { FailureMessage } from './types.ts';

/** A failure the CLI reports under its own code: its status, its message, and what to do next, if anything. */
type OwnMessageInput = {
  readonly code: ErrorCode;
  readonly status: ExitStatus;
  readonly message: string;
  /** None when the diagnostic says no more than the message. */
  readonly next: Option.Option<string>;
};

/** The report of a failure under the CLI's own code, whose diagnostic says what to do next after the message. */
export function ownMessage({ code, status, message, next }: OwnMessageInput): FailureMessage {
  const clause: (step: string) => string = (step) => `; ${step}`;

  return {
    status,
    record: { code, message, family: Option.none() },
    text: `${message}${Option.getOrElse(Option.map(next, clause), () => '')}`,
    isLabelled: true,
  };
}
