import { SourceCapture, SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { readSourceBody } from '../journal/read-source-body.ts';
import type { SourceStepInput } from '../types.ts';
import { captureSource } from './capture-source.ts';

/** The capture request carries only explicit paths and no credentials. */
const SourceCaptureBody = Schema.fromJsonString(SourceCapture);

/** Refuses a capture for another source before reading any checkout file. */
export const readSourceChanges = Effect.fn('readSourceChanges')(function* ({
  settings,
  ...request
}: SourceStepInput): Effect.fn.Return<SourceGuestAnswer, SourceGuestFailed> {
  const { sourceId } = request;
  const body = yield* readSourceBody(request);

  const capture = yield* Schema.decodeUnknownEffect(SourceCaptureBody)(body).pipe(
    Effect.mapError(() => new SourceGuestFailed({ sourceId, reason: 'source capture request is invalid' })),
  );

  if (capture.sourceId !== sourceId) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source capture identity differs' });
  }

  const changes = yield* captureSource({ settings, capture });

  return SourceGuestAnswer.cases.Changes.make({ changes });
});
