import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { guestSourcePath, SOURCE_CHECKOUT_TIMEOUT, SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { SourceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Result, Schema } from 'effect';
import type { GuestConnection } from '../../types.ts';
import type { SourceIdentity } from '../types.ts';
import { boundSourceResponse } from './bound-source-response.ts';

type SourceGuestInput = SourceIdentity & {
  readonly guest: GuestConnection;
  readonly machineId: RecordId;
  readonly step: SourceStep;
  /** Absent for source steps that operate only on the existing guest lease. */
  readonly body: Option.Option<string>;
};

type ReadSourceAnswerInput = { readonly response: Response };

/** Bounds guest response bytes before decoding a source result; transport failure never exposes response text. */
export async function callSourceGuest({
  guest,
  machineId,
  sourceId,
  generation,
  step,
  body,
}: SourceGuestInput): Promise<SourceGuestAnswer> {
  const path = guestSourcePath({ machineId, sourceId, generation, step });
  const timeout = Duration.toMillis(SOURCE_CHECKOUT_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const payload = Option.getOrNull(body);

  const init = {
    method: HttpMethod.Post,
    headers: { [HttpHeader.ContentType]: MediaType.Json },
    body: payload,
    signal,
  };

  const request = guest.fetch({ path, init });
  const response = await capturePromise({ promise: request });

  if (Result.isFailure(response) || !response.success.ok) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source guest did not complete the request' });
  }

  return await readSourceAnswer({ response: response.success });
}

async function readSourceAnswer({ response }: ReadSourceAnswerInput): Promise<SourceGuestAnswer> {
  const bounded = boundSourceResponse({ response });
  const reading = bounded.json();
  const answer = await capturePromise({ promise: reading });

  if (Result.isFailure(answer)) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source guest returned an invalid response' });
  }

  const decoded = Schema.decodeUnknownResult(SourceGuestAnswer)(answer.success);

  if (Result.isFailure(decoded)) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source guest returned an invalid response' });
  }

  return decoded.success;
}
