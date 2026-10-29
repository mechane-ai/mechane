import type { FailureReport } from '@mechane/cli-kernel';
import { Match } from 'effect';
import { FAILURE_MESSAGES } from './failure-messages.ts';
import type { Failure } from './types.ts';

/** A failure, and what begins its diagnostic: the command and origin of a run, or the step of a command line. */
type FailureReportInput = { readonly failure: Failure; readonly label: string };

/** How a failure is reported: its exit status, error record and diagnostic, as the CLI's message table derives them. */
export function failureReport({ failure, label }: FailureReportInput): FailureReport {
  const { status, record, text, isLabelled } = Match.valueTags(failure, FAILURE_MESSAGES);

  const diagnostic: string = (() => {
    if (isLabelled) {
      return `${label}: ${text}`;
    }

    return text;
  })();

  return { status, record, diagnostic };
}
