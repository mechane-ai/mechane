import { writeDiagnostic } from '@mechane/program';
import { once } from 'node:events';
import { startLocalStack } from './start-local-stack.ts';
import type { LocalStack, StackOptions } from './types.ts';

type StackProgramContext = { readonly stack: LocalStack; readonly signal: AbortSignal };

type StackProgramInput = {
  readonly options: StackOptions;
  readonly run: (context: StackProgramContext) => Promise<void>;
};

export async function runStackProgram({ options, run }: StackProgramInput): Promise<void> {
  const started = startLocalStack(options);
  const interrupted = new AbortController();
  const state = { isInterrupted: false };

  async function interrupt(): Promise<void> {
    if (state.isInterrupted) {
      return;
    }

    state.isInterrupted = true;

    try {
      const stack = await started;

      await stack.stop();

      interrupted.abort();

      process.exitCode = 1;
    } catch (cause) {
      state.isInterrupted = false;

      const detail = shutdownFailureMessage(cause);

      writeDiagnostic({ program: 'stack', line: `Shutdown did not complete: ${detail}. Repair and interrupt again` });
    }
  }

  function onSignal(): void {
    void interrupt();
  }

  async function stopAfterRun(stack: LocalStack): Promise<void> {
    try {
      await stack.stop();
    } catch (cause) {
      if (options.mode === 'persistent') {
        const detail = shutdownFailureMessage(cause);

        writeDiagnostic({ program: 'stack', line: `Shutdown did not complete: ${detail}. Repair and interrupt again` });

        if (!interrupted.signal.aborted) {
          await once(interrupted.signal, 'abort');
        }
      }

      throw cause;
    }
  }

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  try {
    const stack = await started;

    try {
      if (interrupted.signal.aborted) {
        return;
      }

      await run({ stack, signal: interrupted.signal });
    } catch (error) {
      try {
        const evidence = await stack.captureFailure('after-scenario-cleanup');

        process.stderr.write(`Local stack failure logs: ${evidence}\nRemove that private folder after review.\n`);
      } catch (retentionError) {
        throw new AggregateError([error, retentionError], 'The local stack failed and its logs could not be retained', {
          cause: retentionError,
        });
      }

      throw new Error('The local stack scenario failed', { cause: error });
    } finally {
      await stopAfterRun(stack);
    }
  } finally {
    if (!state.isInterrupted) {
      process.off('SIGTERM', onSignal);
      process.off('SIGINT', onSignal);
    }
  }
}

function shutdownFailureMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }

  return 'Inspect the local stack ownership record';
}
