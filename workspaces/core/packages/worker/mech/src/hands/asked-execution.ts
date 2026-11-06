import type { HandsOutcome } from '@mechane/harness-tools';
import { SandboxRefusal } from '@mechane/harness-tools';
import { SandboxExecutionAnswer } from '@mechane/rpc';
import { EXECUTION_WAIT_MAX, OptionalExecutionEnvironment } from '@mechane/sandbox-wire';
import type { ExecutionEnvironment, ExecutionEnvironmentRequired } from '@mechane/sandbox-wire';
import { unlessStopped } from '@mechane/utilities';
import { Duration, Match, Option, Result, Schema } from 'effect';
import { refusedOutcome } from './refused-outcome.ts';
import type { SettledExecutionInput } from './types.ts';

/** The sandbox an execution runs in, the execution, and how its tool call ends early. */
type AskedExecutionInput = Omit<SettledExecutionInput, 'prepareEnvironment'> & {
  /** None observes an existing command without submitting credentials. */
  readonly environment: Option.Option<ExecutionEnvironment>;
};

/**
 * Asks the sandbox for the execution with the same input each time, returning none while it runs within its own
 * timeout. Aborting an invocation stops only its wait so routine harness handoff can rejoin the command; the host
 * separately stops unfinished commands when a turn or drone ends canceled.
 */
export async function askedExecution({
  sandbox,
  target,
  execution,
  environment,
  signal,
  aborted,
}: AskedExecutionInput): Promise<Option.Option<HandsOutcome | ExecutionEnvironmentRequired>> {
  signal.throwIfAborted();

  const { executionId, command, timeout } = execution;

  // The answer decodes below, so the wait reads it as unknown.
  const encodedEnvironment = Schema.encodeSync(OptionalExecutionEnvironment)(environment);

  const asked: Promise<unknown> = sandbox.runExecution({
    executionId,
    command,
    timeoutMs: Duration.toMillis(timeout),
    waitMs: Duration.toMillis(EXECUTION_WAIT_MAX),
    environment: encodedEnvironment,
  });

  const answer = await unlessStopped({ promise: asked, stop: aborted });

  // The abort that stopped the wait fails the ask here, so a stopped wait's none never reaches the caller.
  signal.throwIfAborted();

  return Option.flatMap(answer, (progress) => {
    const decoded = Schema.decodeUnknownResult(SandboxExecutionAnswer)(progress);
    const value = Result.getOrThrow(decoded);

    return Match.valueTags(value, {
      Running: () => Option.none(),
      ExecutionEnvironmentRequired: (required) => Option.some(required),
      Exited: (ended) => Option.some(ended),
      TimedOut: (ended) => Option.some(ended),
      Uncertain: (ended) => Option.some(ended),
      Unavailable: (ended) => Option.some(ended),
      PersistenceFailed: (ended) => Option.some(ended),
      Disabled: () => {
        const refused = refusedOutcome({ target, reason: SandboxRefusal.NoSandbox });

        return Option.some(refused);
      },
      CapacityReached: () => {
        const refused = refusedOutcome({ target, reason: SandboxRefusal.MachinesFull });

        return Option.some(refused);
      },
    });
  });
}
