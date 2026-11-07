import type { HttpMethod } from '@mechane/records';
import { Bytes, BYTES_PER_MEBIBYTE, HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { guestProcessPath, ProcessId, ProcessObservation, ProcessStart } from '@mechane/sandbox-wire';
import type { ProcessHandle } from '@mechane/sandbox-wire';
import { Duration, Option, Result, Schema } from 'effect';
import { ANSWER_SLACK } from '../constants.ts';
import { boundGuestResponse } from '../files/bound-guest-response.ts';
import type { GuestConnection } from '../types.ts';

type ProcessGuestInput = {
  readonly guest: GuestConnection;
  readonly handle: ProcessHandle;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Put | typeof HttpMethod.Delete;
  /** None for reads and stops, which must not carry a command or credentials. */
  readonly start: Option.Option<ProcessStart>;
};

const PROCESS_RESPONSE_MAX_BYTES = Bytes.make(BYTES_PER_MEBIBYTE);

class ProcessGuestFailed extends Schema.TaggedError<ProcessGuestFailed>()('ProcessGuestFailed', {
  processId: ProcessId,
  status: Schema.Int,
}) {}

/** A GET never submits a command or credentials, including recovery after an interrupted start. */
export async function processGuest({
  guest,
  handle,
  method,
  start,
}: ProcessGuestInput): Promise<Option.Option<ProcessObservation>> {
  const path = guestProcessPath(handle);
  const timeout = Duration.toMillis(ANSWER_SLACK);
  const signal = AbortSignal.timeout(timeout);
  const codec = Schema.fromJsonString(ProcessStart);
  const encoded = Option.map(start, (request) => Schema.encodeSync(codec)(request));
  const body = Option.getOrNull(encoded);

  const response = await guest.fetch({
    path,
    init: { method, signal, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });

  if (response.status === HttpStatusCode.NotFound) {
    return Option.none();
  }

  if (response.status !== HttpStatusCode.Ok) {
    const cause = new ProcessGuestFailed({ processId: handle.processId, status: response.status });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  const bounded = boundGuestResponse({ response, maximumBytes: PROCESS_RESPONSE_MAX_BYTES });
  const text = await bounded.text();
  const responseCodec = Schema.fromJsonString(ProcessObservation);
  const result = Schema.decodeUnknownResult(responseCodec)(text);
  const observation = Result.getOrThrow(result);

  if (observation.handle.machineId !== handle.machineId || observation.handle.processId !== handle.processId) {
    const cause = new ProcessGuestFailed({ processId: handle.processId, status: HttpStatusCode.Conflict });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  return Option.some(observation);
}
