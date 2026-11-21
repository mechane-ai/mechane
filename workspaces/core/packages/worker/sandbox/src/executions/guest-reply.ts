import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { ExecutionRequest, guestExecutionPath } from '@mechane/sandbox-wire';
import type { ExecutionEnvironment } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import type { DispatchedExecution, GuestTransport } from '../types.ts';
import type { GuestReply } from './types.ts';

/** The guest a dispatched execution's request goes to, and how long the request waits for it to settle. */
type GuestReplyInput = {
  /** None observes an existing command without submitting credentials. */
  readonly environment: Option.Option<ExecutionEnvironment>;
  readonly guest: GuestTransport;
  readonly execution: DispatchedExecution;
  readonly wait: Duration.Duration;
};

/**
 * Sends a dispatched execution's request to its guest and reads the reply, none when the request or its reading failed.
 * The guest joins the run the execution's id names, so a repeat is a wait, not a second run.
 */
export async function guestReply({
  guest,
  execution,
  wait,
  environment,
}: GuestReplyInput): Promise<Option.Option<GuestReply>> {
  const { id: executionId, machineId, command, timeout } = execution;

  const submission: RequestInit = Option.match(environment, {
    onNone: () => ({ method: HttpMethod.Get }),
    onSome: () => {
      const body = Schema.encodeSync(Schema.fromJsonString(ExecutionRequest))({ command, timeout, environment });

      return { method: HttpMethod.Put, body };
    },
  });

  const path = guestExecutionPath({ machineId, executionId, wait });
  const timeoutDuration = Duration.sum(wait, ANSWER_SLACK);
  const timeoutMs = Duration.toMillis(timeoutDuration);
  const signal = AbortSignal.timeout(timeoutMs);

  const fetchPromise = guest.fetch({
    path,
    init: { ...submission, headers: { [HttpHeader.ContentType]: MediaType.Json }, signal },
  });

  const response = await capturePromise({ promise: fetchPromise });

  if (Result.isFailure(response)) {
    return Option.none();
  }

  const textPromise = response.success.text();
  const text = await capturePromise({ promise: textPromise });

  if (Result.isFailure(text)) {
    return Option.none();
  }

  return Option.some({ status: response.success.status, body: text.success });
}
