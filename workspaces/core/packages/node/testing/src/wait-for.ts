import { setTimeout } from 'node:timers/promises';

type WaitForInput<T> = {
  readonly name: string;
  readonly read: () => Promise<T>;
  readonly accept: (value: T) => boolean;
  readonly timeoutMs?: number;
};

const OBSERVATION_DEADLINE_MS = 60_000;
const OBSERVATION_INTERVAL_MS = 100;
const OBSERVATION_INTERVAL_MAX_MS = 1000;
const OBSERVATION_BACKOFF_FACTOR = 2;

export async function waitFor<T>({
  name,
  read,
  accept,
  timeoutMs = OBSERVATION_DEADLINE_MS,
}: WaitForInput<T>): Promise<T> {
  const deadlineMs = Date.now() + timeoutMs;
  let intervalMs = OBSERVATION_INTERVAL_MS;

  do {
    const result = await read();

    if (accept(result)) {
      return result;
    }

    const remainingMs = deadlineMs - Date.now();

    if (remainingMs <= 0) {
      throw new Error(`Timed out waiting for ${name}`);
    }

    const waitMs = Math.min(intervalMs, remainingMs);

    await setTimeout(waitMs);

    intervalMs = Math.min(intervalMs * OBSERVATION_BACKOFF_FACTOR, OBSERVATION_INTERVAL_MAX_MS);
  } while (Date.now() < deadlineMs);

  throw new Error(`Timed out waiting for ${name}`);
}
