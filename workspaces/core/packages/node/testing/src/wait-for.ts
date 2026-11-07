import { setTimeout } from 'node:timers/promises';

type WaitForInput<T> = {
  readonly name: string;
  readonly read: () => Promise<T>;
  readonly accept: (value: T) => boolean;
  readonly timeoutMs?: number;
};

const OBSERVATION_DEADLINE_MS = 60_000;
const OBSERVATION_INTERVAL_MS = 100;

export async function waitFor<T>({
  name,
  read,
  accept,
  timeoutMs = OBSERVATION_DEADLINE_MS,
}: WaitForInput<T>): Promise<T> {
  const deadlineMs = Date.now() + timeoutMs;

  do {
    const result = await read();

    if (accept(result)) {
      return result;
    }

    if (Date.now() >= deadlineMs) {
      throw new Error(`Timed out waiting for ${name}`);
    }

    await setTimeout(OBSERVATION_INTERVAL_MS);
  } while (Date.now() < deadlineMs);

  throw new Error(`Timed out waiting for ${name}`);
}
