import { ExitStatus } from '@mechane/commands';
import { ErrorFamily } from '@mechane/protocol';
import { Option } from 'effect';
import { failedRecord } from './failed-record.ts';
import type { AnsweredFailure, FailureMessage } from './types.ts';

/** An error a deployment answered, and what the diagnostic says after its code and message, if anything. */
type AnsweredMessageInput = {
  readonly failed: AnsweredFailure;
  /** None when the diagnostic says no more than the deployment's code and message. */
  readonly note: Option.Option<string>;
};

/** The exit status of a command whose server answered with an error of each family. */
const FAMILY_EXIT_STATUS: Readonly<Record<ErrorFamily, ExitStatus>> = {
  [ErrorFamily.InvalidRequest]: ExitStatus.InvalidRequest,
  [ErrorFamily.Unauthenticated]: ExitStatus.Unauthenticated,
  [ErrorFamily.Forbidden]: ExitStatus.ForbiddenOrNotFound,
  [ErrorFamily.NotFound]: ExitStatus.ForbiddenOrNotFound,
  [ErrorFamily.Conflict]: ExitStatus.Conflict,
  [ErrorFamily.RateLimited]: ExitStatus.Unavailable,
  [ErrorFamily.Unavailable]: ExitStatus.Unavailable,
};

/** The report of an error a deployment answered: its family decides the status, and its record carries its fields. */
export function answeredMessage({ failed, note }: AnsweredMessageInput): FailureMessage {
  const record = failedRecord({ failed });
  const clause: (text: string) => string = (text) => `; ${text}`;

  return {
    status: FAMILY_EXIT_STATUS[failed.family],
    record,
    text: `${record.code}: ${failed.message}${Option.getOrElse(Option.map(note, clause), () => '')}`,
    isLabelled: true,
  };
}
