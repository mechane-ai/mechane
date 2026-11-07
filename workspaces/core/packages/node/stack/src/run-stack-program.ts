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
