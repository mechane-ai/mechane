import type { Report } from '@earendil-works/pi-durable';
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
