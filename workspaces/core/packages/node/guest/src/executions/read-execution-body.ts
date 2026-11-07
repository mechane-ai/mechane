import { RequestInvalid } from '@mechane/protocol';
import { Bytes, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Effect } from 'effect';
import type { IncomingMessage } from 'node:http';
import { readGuestBody } from '../read-guest-body.ts';

const EXECUTION_REQUEST_MAX_BYTES = BYTES_PER_MEBIBYTE;

type ReadExecutionBodyInput = { readonly request: IncomingMessage };

/** The whole body of an execution's request, as text once it has arrived. */
export const readExecutionBody = Effect.fn('readExecutionBody')(function* ({
  request,
}: ReadExecutionBodyInput): Effect.fn.Return<string, RequestInvalid> {
  const maximumBytes = Bytes.make(EXECUTION_REQUEST_MAX_BYTES);

  const body = yield* readGuestBody({
    request,
    maximumBytes,
    onLimit: () => new RequestInvalid({ reason: 'execution request exceeds its byte limit' }),
    onError: (error) => new RequestInvalid({ reason: error.message }),
  });

  return body.toString('utf8');
});
