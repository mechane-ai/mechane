import type { HandsOutcome } from '@mechane/harness-tools';
import { ExecutionEnvironmentRequired } from '@mechane/sandbox-wire';
import type { ExecutionEnvironment } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { askedExecution } from './asked-execution.ts';
import type { SettledExecutionInput } from './types.ts';

const isEnvironmentRequired = Schema.is(ExecutionEnvironmentRequired);

/** Rejoins the same execution until it settles. The sandbox owns machine admission and retained capacity. */
export async function settledExecution({
  sandbox,
  target,
  execution,
  prepareEnvironment,
  signal,
  aborted,
}: SettledExecutionInput): Promise<HandsOutcome> {
  let outcome: Option.Option<HandsOutcome> = Option.none();
  let environment: Option.Option<ExecutionEnvironment> = Option.none();
  let release: Option.Option<() => Promise<void>> = Option.none();

  while (Option.isNone(outcome)) {
    const answer = await askedExecution({ sandbox, target, execution, environment, signal, aborted });

    if (Option.isSome(answer)) {
      if (isEnvironmentRequired(answer.value)) {
        const preparation = await prepareEnvironment();

        if (Result.isFailure(preparation)) {
          return preparation.failure;
        }

        environment = Option.some(preparation.success.environment);
        release = preparation.success.release;
      } else {
        outcome = Option.some(answer.value);
      }
    }
  }

  if (Option.isSome(release)) {
    await release.value();
  }

  return outcome.value;
}
