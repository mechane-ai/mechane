import { RecordId } from '@mechane/records';
import type { MachineId } from '@mechane/records';
import type { ExecutionId, SandboxCompletionReceipt } from '@mechane/sandbox-wire';
import { safeFailureLocation } from '@mechane/utilities';
import { DateTime, Duration, Schema } from 'effect';

type CompletionFailureInput = Pick<SandboxCompletionReceipt, 'executionId' | 'kind'>;
type FailureInput = { readonly cause: unknown };
const FAILURE_NAMES: ReadonlySet<string> = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError']);
const FAILURE_FILES: ReadonlySet<string> = new Set(['worker', 'worker.js', 'worker.mjs', 'index.js']);

type RestoreTiming = {
  readonly machineId: MachineId;
  readonly generation: RecordId;
  readonly startedAt: DateTime.Utc;
  readonly elapsed: Duration.Duration;
};

type RestoreStageTiming = RestoreTiming & { readonly stage: 'provider' | 'health' | 'manifest' | 'copy' };
type RestoreAdmissionTiming = RestoreTiming & { readonly executionId: ExecutionId };

export function writeRestoreStageTiming({
  stage,
  machineId,
  generation,
  startedAt,
  elapsed,
}: RestoreStageTiming): void {
  const startedAtMs = DateTime.toEpochMillis(startedAt);
  const elapsedMs = Duration.toMillis(elapsed);
  const line = JSON.stringify({ event: 'sandbox.restore_stage', stage, machineId, generation, startedAtMs, elapsedMs });

  console.log(line);
}

export function writeRestoreAdmissionTiming({
  executionId,
  machineId,
  generation,
  startedAt,
  elapsed,
}: RestoreAdmissionTiming): void {
  if (!Schema.is(RecordId)(executionId)) {
    return;
  }

  const startedAtMs = DateTime.toEpochMillis(startedAt);
  const elapsedMs = Duration.toMillis(elapsed);

  const line = JSON.stringify({
    event: 'sandbox.restore_admission',
    executionId,
    machineId,
    generation,
    startedAtMs,
    elapsedMs,
  });

  console.log(line);
}

/** Completion diagnostics expose stable receipt identity without credentials, response bodies, or command output. */
export function writeCompletionDeliveryFailure({ executionId, kind }: CompletionFailureInput): void {
  console.error('Sandbox completion delivery failed', { executionId, kind });
}

/** Background observation failure remains visible while idle retirement and durable callback retries continue. */
export function writeBackgroundObservationFailure(): void {
  console.error('Sandbox background observation failed');
}

/** Safe stack locations survive RPC, without exposing exception messages, command output, or submitted credentials. */
export function writeSandboxFailure({ cause }: FailureInput): void {
  const location = safeFailureLocation({ cause, allowedNames: FAILURE_NAMES, allowedFiles: FAILURE_FILES });

  console.error('Sandbox operation failed', location);
}
