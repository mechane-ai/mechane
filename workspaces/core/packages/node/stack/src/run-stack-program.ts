import { retainFailureLogs } from './retain-failure-logs.ts';
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

    interrupted.abort();

    process.exitCode = 1;

    try {
      const stack = await started;

      await stack.stop();
    } catch {
      console.error('Local stack cleanup did not complete');
    } finally {
      process.exit(1);
    }
  }

  function onSignal(): void {
    void interrupt();
  }

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  try {
    const stack = await started;

    try {
      if (state.isInterrupted) {
        return;
      }

      await run({ stack, signal: interrupted.signal });
    } catch (error) {
      try {
        const evidence = await retainFailureLogs(stack);

        process.stderr.write(`Local stack failure logs: ${evidence}\nRemove that private folder after review.\n`);
      } catch (retentionError) {
        throw new AggregateError([error, retentionError], 'The local stack failed and its logs could not be retained', {
          cause: retentionError,
        });
      }

      throw new Error('The local stack scenario failed', { cause: error });
    } finally {
      await stack.stop();
    }
  } finally {
    if (!state.isInterrupted) {
      process.off('SIGTERM', onSignal);
      process.off('SIGINT', onSignal);
    }
  }
}
