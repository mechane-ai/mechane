import { Exit } from 'effect';
import { failureLine } from './failure-line.ts';
import { writeDiagnostic } from './output/write-diagnostic.ts';
import type { DescribeInput } from './types.ts';

/** The value a run ended with. */
type SucceededInput<A> = { readonly value: A };

/** A program's exit, and how the program reports it. */
type ReportExitInput<A, E, S> = {
  readonly exit: Exit.Exit<A, E>;
  /** The program's name, which prefixes its diagnostic. */
  readonly program: string;
  /** What the program was doing, which prefixes the trace of a defect. */
  readonly operation: string;
  /** The diagnostic of an expected failure, as the program's message table words it. */
  readonly describe: (input: DescribeInput<E>) => string;
  /** The status of a run that ended with its value, once it writes what the value calls for. */
  readonly succeeded: (input: SucceededInput<A>) => S;
  /** The status of a failed run. */
  readonly failed: S;
};

/**
 * The status a program ends with, a member of its own exit statuses. A failed run first writes its diagnostic: its
 * expected failure as `describe` words it, or else the defect's trace.
 */
export function reportExit<A, E, S>({
  exit,
  program,
  operation,
  describe,
  succeeded,
  failed,
}: ReportExitInput<A, E, S>): S {
  if (Exit.isSuccess(exit)) {
    return succeeded({ value: exit.value });
  }

  writeDiagnostic({ program, line: failureLine({ cause: exit.cause, operation, describe }) });

  return failed;
}
