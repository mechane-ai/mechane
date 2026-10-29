import { Cause, Option } from 'effect';
import type { DescribeInput } from './types.ts';

type FailureLineInput<E> = {
  readonly cause: Cause.Cause<E>;
  /** The step the program was taking, which prefixes the trace of a defect. */
  readonly operation: string;
  readonly describe: (input: DescribeInput<E>) => string;
};

/** The diagnostic of a failed run: its expected failure as `describe` words it, or else the defect's trace. */
export function failureLine<E>({ cause, operation, describe }: FailureLineInput<E>): string {
  const failure = Cause.findErrorOption(cause);

  if (Option.isNone(failure)) {
    return `${operation}: ${Cause.pretty(cause)}`;
  }

  return describe({ failure: failure.value });
}
