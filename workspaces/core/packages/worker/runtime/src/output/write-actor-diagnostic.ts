import { safeFailureLocation } from '@mechane/utilities';

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
  'http.ts',
  'http.js',
]);

export function writeActorOperationFailure(cause: unknown): void {
  const location = safeFailureLocation({ cause, allowedNames: FAILURE_NAMES, allowedFiles: FAILURE_FILES });

  console.error({ event: 'actor.operation_failed', ...location });
}
