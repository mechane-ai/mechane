import { HttpHeader, MachineId, RecordId } from '@mechane/records';
import type { ExecutionId, SandboxCompletionReceipt, WorkspaceStep } from '@mechane/sandbox-wire';
import { safeCloudflareRay, safeFailureLocation } from '@mechane/utilities';
import { DateTime, Duration, Option, Result, Schema } from 'effect';

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
type CacheSavedInput = { readonly machineId: MachineId; readonly bytes: number; readonly elapsed: Duration.Duration };
type CacheFailedInput = { readonly machineId: MachineId };

export type WorkspaceTransferFailurePhase = 'fetch' | 'http' | 'body' | 'decode';

type WorkspaceTransferFailureInput = {
  readonly machineId: MachineId;
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly part: Option.Option<number>;
  readonly phase: WorkspaceTransferFailurePhase;
  readonly response: Option.Option<Response>;
  readonly elapsed: Duration.Duration;
};

/** Transfer errors can contain private guest text; report only the boundary's known metadata. */
export function writeWorkspaceTransferFailure({
  machineId,
  generation,
  step,
  part,
  phase,
  response,
  elapsed,
}: WorkspaceTransferFailureInput): void {
  const written = Result.try(() => {
    if (!Schema.is(MachineId)(machineId) || !Schema.is(RecordId)(generation)) {
      return;
    }

    const status = Option.map(response, (value) => value.status);

    const ray = Option.flatMap(response, (value) => {
      const header = value.headers.get(HttpHeader.CloudflareRay);

      return Option.fromNullishOr(header);
    });

    const cloudflareRay = safeCloudflareRay({ ray });
    const elapsedMs = Duration.toMillis(elapsed);
    const recordedPart = Option.getOrUndefined(part);
    const recordedStatus = Option.getOrUndefined(status);
    const recordedRay = Option.getOrUndefined(cloudflareRay);

    const line = JSON.stringify({
      event: 'sandbox.workspace_transfer_failed',
      machineId,
      generation,
      step,
      part: recordedPart,
      phase,
      status: recordedStatus,
      cloudflareRay: recordedRay,
      elapsedMs,
    });

    console.error(line);
  });

  // Reporting must preserve the original transfer failure.
  Result.getOrElse(written, () => undefined);
}

export function writeWorkspaceCacheSaved({ machineId, bytes, elapsed }: CacheSavedInput): void {
  const elapsedMs = Duration.toMillis(elapsed);
  const line = JSON.stringify({ event: 'sandbox.workspace_cache_saved', machineId, bytes, elapsedMs });

  console.log(line);
}

export function writeWorkspaceCacheFailed({ machineId }: CacheFailedInput): void {
  const line = JSON.stringify({ event: 'sandbox.workspace_cache_failed', machineId });

  console.warn(line);
}

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
