import { Bytes, BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Effect } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { readGuestBody } from '../../read-guest-body.ts';
import type { SourceRequest } from '../../types.ts';

/** Source requests are bounded before their JSON or file contents are decoded. */
const SOURCE_BODY_MAX_BYTES = 512 * BYTES_PER_KIBIBYTE;

/** Reads a bounded source request and stops consuming the stream when it exceeds the limit. */
export const readSourceBody = Effect.fn('readSourceBody')(function* ({
  request,
  sourceId,
}: SourceRequest): Effect.fn.Return<string, SourceGuestFailed> {
  const maximumBytes = Bytes.make(SOURCE_BODY_MAX_BYTES);

  const body = yield* readGuestBody({
    request,
    maximumBytes,
    onLimit: () => new SourceGuestFailed({ sourceId, reason: 'source request exceeds its byte limit' }),
    onError: () => new SourceGuestFailed({ sourceId, reason: 'source request did not complete' }),
  });

  return body.toString('utf8');
});
