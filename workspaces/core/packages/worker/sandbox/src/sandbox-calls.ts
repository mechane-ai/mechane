import { capturePromise, serialCalls } from '@mechane/utilities';
import { Result } from 'effect';
import { writeSandboxFailure } from './output/write-sandbox-diagnostic.ts';

type SandboxCalls = ReturnType<typeof serialCalls>;

/** Serial operations preserve their original failure location before Durable Object RPC removes the inner stack. */
export function sandboxCalls(): SandboxCalls {
  const calls = serialCalls();

  const run: SandboxCalls['run'] = async ({ run: operation }) => {
    const promise = calls.run({ run: operation });
    const result = await capturePromise({ promise });

    if (Result.isFailure(result)) {
      writeSandboxFailure({ cause: result.failure });
    }

    return Result.getOrThrow(result);
  };

  return { run };
}
