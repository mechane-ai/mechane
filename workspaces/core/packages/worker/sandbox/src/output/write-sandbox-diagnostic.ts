import type { SandboxCompletionReceipt } from '@mechane/sandbox-wire';
import { Option, Predicate } from 'effect';

type CompletionFailureInput = Pick<SandboxCompletionReceipt, 'executionId' | 'kind'>;
type FailureLocation = { readonly name: string; readonly frames: ReadonlyArray<string> };
type FailureInput = { readonly cause: unknown };
const DIAGNOSTIC_MAX_FRAMES = 4;

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
  const location = failureLocation({ cause });

  console.error('Sandbox operation failed', location);
}

function failureLocation({ cause }: FailureInput): FailureLocation {
  if (!Predicate.isError(cause)) {
    return { name: 'UnknownFailure', frames: [] };
  }

  const stack = Option.fromNullishOr(cause.stack);

  const frames = Option.map(stack, (text) => {
    const lines = text.split('\n');
    const locations = lines.filter((line) => /^\s+at /.test(line));

    return locations.slice(0, DIAGNOSTIC_MAX_FRAMES);
  });

  const locations = Option.getOrElse(frames, () => []);

  return { name: cause.name, frames: locations };
}
