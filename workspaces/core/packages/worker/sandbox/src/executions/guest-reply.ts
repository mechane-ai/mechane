import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { ExecutionRequest, guestExecutionPath } from '@mechane/sandbox-wire';
import { Duration, Option, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import type { DispatchedExecution, GuestTransport } from '../types.ts';
import type { GuestReply } from './types.ts';

/** The guest a dispatched execution's request goes to, and how long the request waits for it to settle. */
type GuestReplyInput = {
  readonly guest: GuestTransport;
  readonly execution: DispatchedExecution;
  readonly wait: Duration.Duration;
};

/**
 * Sends a dispatched execution's request to its guest and reads the reply, none when the request or its reading failed.
 * The guest joins the run the execution's id names, so a repeat is a wait, not a second run.
 */
export async function guestReply({ guest, execution, wait }: GuestReplyInput): Promise<Option.Option<GuestReply>> {
  const { id: executionId, machineId, command, timeout } = execution;
  const body = Schema.encodeSync(Schema.fromJsonString(ExecutionRequest))({ command, timeout });

  const response = await guest
    .fetch({
      path: guestExecutionPath({ machineId, executionId, wait }),
      init: {
        method: HttpMethod.Put,
        headers: { [HttpHeader.ContentType]: MediaType.Json },
        body,
        signal: AbortSignal.timeout(Duration.toMillis(Duration.sum(wait, ANSWER_SLACK))),
      },
    })
    .then(Option.some, () => Option.none());

  if (Option.isNone(response)) {
    return Option.none();
  }

  const text = await response.value.text().then(Option.some, () => Option.none());

  return Option.map(text, (replyBody) => ({ status: response.value.status, body: replyBody }));
}
