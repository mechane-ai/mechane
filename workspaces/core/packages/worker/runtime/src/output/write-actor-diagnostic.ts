import type { Report } from '@earendil-works/pi-durable';
import { RequestInvalid, ServiceUnavailable } from '@mechane/protocol';
import { HttpMethod, RecordId } from '@mechane/records';
import { safeFailureLocation } from '@mechane/utilities';
import { Option, Schema } from 'effect';

export type SandboxMaintenancePhase = 'fetch' | 'http' | 'body' | 'decode';

type SandboxMaintenanceFailureInput = {
  readonly cause: unknown;
  readonly pathname: string;
  readonly phase: SandboxMaintenancePhase;
  readonly status: Option.Option<number>;
  readonly ray: Option.Option<string>;
};

const CLOUDFLARE_RAY = /^[0-9A-Fa-f]{16}(?:-[A-Za-z]{3})?$/u;

const COMPLETION_FAILURE_REASONS: ReadonlyMap<string, string> = new Map([
  ['The completion has no matching execution receipt', 'missing_execution'],
  ['The completion kind differs from its execution receipt', 'execution_kind_mismatch'],
  ['The completion differs from its archived terminal receipt', 'archived_receipt_mismatch'],
  ['The completion differs from its durable environment receipt', 'environment_receipt_mismatch'],
  ['The native completion has no execution owner', 'missing_execution_owner'],
  ['The completion resume barrier is no longer active', 'resume_barrier_changed'],
  ['The active tool is still recording its execution outcome', 'active_tool'],
]);

const FAILURE_NAMES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'AggregateError',
  'DOMException',
  'AbortError',
  'TimeoutError',
  'SchemaError',
  'StoreConflict',
  'ToolUnavailableError',
  'ToolNotStartedError',
]);

const FAILURE_FILES: ReadonlySet<string> = new Set([
  'worker',
  'worker.js',
  'worker.mjs',
  'index.js',
  'session.js',
  'bash.ts',
  'bash.js',
  'record-store.ts',
  'record-store.js',
  'receipts.ts',
  'receipts.js',
  'sandbox-client.ts',
  'sandbox-client.js',
  'sandbox-transport.ts',
  'sandbox-transport.js',
  'sandbox-maintenance.ts',
  'sandbox-maintenance.js',
  'http.ts',
  'http.js',
]);

type BashRestoreTiming = { readonly executionId: string; readonly startedAtMs: number; readonly elapsedMs: number };

export function writeBashRestoreObservation(input: BashRestoreTiming): void {
  if (Schema.is(RecordId)(input.executionId)) {
    const line = JSON.stringify({ event: 'actor.restore_observe', ...input });

    console.log(line);
  }
}

export function writeBashRestoreAdmission(
  input: BashRestoreTiming & { readonly authorizationMs: number; readonly isResume: boolean },
): void {
  if (Schema.is(RecordId)(input.executionId)) {
    const line = JSON.stringify({ event: 'actor.restore_admission', ...input });

    console.log(line);
  }
}

export function writeBashUncertain(input: { readonly executionId: string; readonly cause: unknown }): void {
  try {
    if (Schema.is(RecordId)(input.executionId)) {
      const location = safeFailureLocation({
        cause: input.cause,
        allowedNames: FAILURE_NAMES,
        allowedFiles: FAILURE_FILES,
      });

      console.error({ event: 'actor.bash_uncertain', executionId: input.executionId, ...location });
    }
  } catch {
    // Reporting must not replace the command's uncertain outcome.
  }
}

export function writeCancellationDeferred(input: { readonly turnId: string; readonly cause: unknown }): void {
  const location = safeFailureLocation({
    cause: input.cause,
    allowedNames: FAILURE_NAMES,
    allowedFiles: FAILURE_FILES,
  });

  console.error({ event: 'actor.cancellation_deferred', turnId: input.turnId, ...location });
}

export function writeNativeReport(report: Report): void {
  const location = safeFailureLocation({
    cause: report.error,
    allowedNames: FAILURE_NAMES,
    allowedFiles: FAILURE_FILES,
  });

  if ('task' in report) {
    console.error({ event: 'actor.native_report', kind: report.kind, taskId: report.task.id, ...location });
  } else {
    console.error({ event: 'actor.native_report', kind: report.kind, ...location });
  }
}

export function writeActorOperationFailure(cause: unknown): void {
  const location = safeFailureLocation({ cause, allowedNames: FAILURE_NAMES, allowedFiles: FAILURE_FILES });

  console.error({ event: 'actor.operation_failed', ...location });
}

export function writeResumeCompletionFailure(input: {
  readonly cause: unknown;
  readonly mechId: string | undefined;
}): void {
  try {
    const location = safeFailureLocation({
      cause: input.cause,
      allowedNames: FAILURE_NAMES,
      allowedFiles: FAILURE_FILES,
    });

    const category = resumeCompletionCategory(input.cause);

    console.error({ event: 'actor.completions_deferred', mechId: input.mechId, category, ...location });
  } catch {
    // Reporting must not replace the original failure.
  }
}

function resumeCompletionCategory(cause: unknown): string {
  if (cause instanceof RequestInvalid || cause instanceof ServiceUnavailable) {
    return COMPLETION_FAILURE_REASONS.get(cause.reason) ?? 'other';
  }

  return 'other';
}

export function writeSandboxMaintenanceFailure({
  cause,
  pathname,
  phase,
  status,
  ray,
}: SandboxMaintenanceFailureInput): void {
  try {
    const location = safeFailureLocation({ cause, allowedNames: FAILURE_NAMES, allowedFiles: FAILURE_FILES });
    const correlatedRay = Option.filter(ray, (value) => CLOUDFLARE_RAY.exec(value)?.[0] === value);
    const cloudflareRay = Option.getOrUndefined(correlatedRay);

    console.error({
      event: 'sandbox.maintenance_failed',
      method: HttpMethod.Post,
      pathname,
      phase,
      status: Option.getOrUndefined(status),
      cloudflareRay,
      ...location,
    });
  } catch {
    // Reporting must not replace the maintenance failure.
  }
}

export function writeActorDeferred(input: {
  readonly kind: 'settlement' | 'release' | 'checkpoint';
  readonly attemptId?: string;
}): void {
  console.error({ event: `actor.${input.kind}_deferred`, attemptId: input.attemptId });
}
