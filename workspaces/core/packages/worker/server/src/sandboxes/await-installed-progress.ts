import { HttpStatusCode } from '@mechane/records';
import { ManagedSandboxResponseError } from '@mechane/runtime';
import { setTimeout as delay } from 'node:timers/promises';

const SANDBOX_PROGRESS_WINDOW_MS = 20_000;
const INITIAL_PROBE_DELAY_MS = 250;
const PROBE_DELAY_MAX_MS = 4000;

// A live checkpoint or restore can span several provider observations of one generation.
export async function awaitInstalledProgress<Result>(operation: () => Promise<Result>): Promise<Result> {
  const deadlineMs = performance.now() + SANDBOX_PROGRESS_WINDOW_MS;
  let retryDelayMs = INITIAL_PROBE_DELAY_MS;

  while (performance.now() < deadlineMs) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ManagedSandboxResponseError) || error.status !== HttpStatusCode.Unavailable) {
        throw error;
      }
    }

    const remainingMs = deadlineMs - performance.now();

    if (remainingMs <= 0) {
      break;
    }

    const waitMs = Math.min(retryDelayMs, remainingMs);

    await delay(waitMs);

    retryDelayMs = Math.min(PROBE_DELAY_MAX_MS, retryDelayMs + retryDelayMs);
  }

  return await operation();
}
