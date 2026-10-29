import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Option, Result } from 'effect';
import { ProcessStatus } from '../constants.ts';
import { TensorlakeRefused } from '../errors.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import { processUrl } from './process-url.ts';
import { readProcess } from './read-process.ts';
import type { RemoteProcessInput } from './types.ts';

const PROCESS_POLL_INTERVAL = Duration.millis(100);
const PROCESS_STOP_TIMEOUT = Duration.seconds(5);
const TERMINATE_SIGNAL = 15;

/** Lets the guest kill its command groups before the VM sleeps; SIGKILL would leave those groups alive. */
export async function endGuestProcess({ ...input }: RemoteProcessInput): Promise<void> {
  if (!(await processRunning(input))) {
    return;
  }

  const url = processUrl(input);
  url.pathname += '/signal';
  const body = JSON.stringify({ signal: TERMINATE_SIGNAL });

  await tensorlakeRequest({ apiKey: input.apiKey, url, init: { method: HttpMethod.Post, body } });

  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, PROCESS_STOP_TIMEOUT);

  while (await processRunning(input)) {
    const observedAt = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(observedAt, deadline)) {
      const failure = new TensorlakeRefused({ url, status: HttpStatusCode.Unavailable });
      const refused = Result.fail(failure);

      return Result.getOrThrow(refused);
    }

    await waitFor({ span: PROCESS_POLL_INTERVAL });
  }
}

async function processRunning({ ...input }: RemoteProcessInput): Promise<boolean> {
  const found = await readProcess(input);

  return Option.isSome(found) && found.value.status === ProcessStatus.Running;
}
