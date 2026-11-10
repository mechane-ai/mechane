import { ReceiptStatus, SandboxCommandOutcome } from '@mechane/sandbox-wire';
import type { SettledReceipt } from '@mechane/sandbox-wire';
import type { SqlCall } from '@mechane/store';
import { DateTime, Duration, Option, Schema } from 'effect';
import { ExecutionStatus } from '../constants.ts';
import type { PersistenceFailureInput } from '../types.ts';

/** Records a finished command whose live files could not be saved without changing prior terminal results. */
export function failPersistence({
  sql,
  executionId,
  machineId,
  receipt,
  reason,
  now,
}: SqlCall<PersistenceFailureInput>): void {
  const durationMillis = Duration.toMillis(receipt.duration);
  const settledAtMillis = DateTime.toEpochMillis(now);
  const outcome = commandOutcome({ receipt });
  const codec = Schema.fromJsonString(SandboxCommandOutcome);
  const command = Schema.encodeSync(codec)(outcome);
  const observedExitCode = outcomeExitCode({ outcome });
  const exitCode = Option.getOrNull(observedExitCode);

  sql.exec(
    'UPDATE executions SET status = ?, duration_ms = ?, output_text = ?, omitted_bytes = ?, settled_at_ms = ?, persistence_failure = ?, command_outcome = ?, exit_code = ? WHERE id = ? AND machine_id = ? AND status = ?',
    ExecutionStatus.PersistenceFailed,
    durationMillis,
    receipt.output.text,
    receipt.output.omittedBytes,
    settledAtMillis,
    reason,
    command,
    exitCode,
    executionId,
    machineId,
    ExecutionStatus.Dispatched,
  );
}

type CommandOutcomeInput = { readonly receipt: SettledReceipt };

function commandOutcome({ receipt }: CommandOutcomeInput): SandboxCommandOutcome {
  if (receipt.state === ReceiptStatus.Exited) {
    return { state: receipt.state, exitCode: receipt.exitCode };
  }

  return { state: receipt.state };
}

type OutcomeInput = { readonly outcome: SandboxCommandOutcome };

function outcomeExitCode({ outcome }: OutcomeInput): Option.Option<number> {
  if (outcome.state === ReceiptStatus.Exited) {
    return Option.some(outcome.exitCode);
  }

  return Option.none();
}
