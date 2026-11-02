import type { HandsOutcome } from '@mechane/harness-tools';
import { Option } from 'effect';
import { askedExecution } from './asked-execution.ts';
import type { SettledExecutionInput } from './types.ts';

/** Rejoins the same execution until it settles. The sandbox owns machine admission and retained capacity. */
export async function settledExecution({
  sandbox,
  target,
  execution,
  signal,
  aborted,
}: SettledExecutionInput): Promise<HandsOutcome> {
  let outcome: Option.Option<HandsOutcome> = Option.none();

  while (Option.isNone(outcome)) {
    outcome = await askedExecution({ sandbox, target, execution, signal, aborted });
  }

  return outcome.value;
}
