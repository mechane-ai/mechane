import type { SandboxCompletionReceipt } from '@mechane/sandbox-wire';
import { safeFailureLocation } from '@mechane/utilities';

type CompletionFailureInput = Pick<SandboxCompletionReceipt, 'executionId' | 'kind'>;
type FailureInput = { readonly cause: unknown };
const FAILURE_NAMES: ReadonlySet<string> = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError']);
const FAILURE_FILES: ReadonlySet<string> = new Set(['worker', 'worker.js', 'worker.mjs', 'index.js']);

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
