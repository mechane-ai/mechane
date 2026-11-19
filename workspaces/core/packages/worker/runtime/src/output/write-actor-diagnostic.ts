import { HttpMethod } from '@mechane/records';
import { safeCloudflareRay, safeFailureLocation } from '@mechane/utilities';
import { Option } from 'effect';

export type SandboxMaintenancePhase = 'fetch' | 'http' | 'body' | 'decode';

type SandboxMaintenanceFailureInput = {
  readonly cause: unknown;
  readonly pathname: string;
  readonly phase: SandboxMaintenancePhase;
  readonly status: Option.Option<number>;
  readonly ray: Option.Option<string>;
};

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
    const correlatedRay = safeCloudflareRay({ ray });
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
