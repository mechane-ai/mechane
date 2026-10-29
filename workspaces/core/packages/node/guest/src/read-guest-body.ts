import type { Bytes } from '@mechane/records';
import { Effect, Result } from 'effect';
import type { IncomingMessage } from 'node:http';

/** A byte limit and the caller's errors for an oversized or interrupted request. */
type ReadGuestBodyInput<Failure> = {
  readonly request: IncomingMessage;
  readonly maximumBytes: Bytes;
  readonly onLimit: () => Failure;
  readonly onError: (error: Error) => Failure;
};

type RejectGuestBodyInput<Failure> = {
  readonly failure: () => Failure;
  readonly resume: (answer: Effect.Effect<Buffer, Failure>) => void;
};

/** Buffers at most the caller's byte limit and destroys the request as soon as that limit is exceeded. */
export const readGuestBody = Effect.fn('readGuestBody')(function* <Failure>({
  request,
  maximumBytes,
  onLimit,
  onError,
}: ReadGuestBodyInput<Failure>): Effect.fn.Return<Buffer, Failure> {
  return yield* Effect.callback<Buffer, Failure>((resume) => {
    const chunks: Array<Buffer> = [];
    const state = { bytes: 0 };

    const keepChunk: (chunk: Buffer) => void = (chunk) => {
      state.bytes += chunk.byteLength;

      if (state.bytes > maximumBytes) {
        rejectGuestBody({ resume, failure: onLimit });
        request.destroy();

        return;
      }

      chunks.push(chunk);
    };

    const settle: () => void = () => {
      const body = Buffer.concat(chunks);
      const completed = Result.succeed(body);
      const accepted = Effect.fromResult(completed);

      resume(accepted);
    };

    const refuse: (error: Error) => void = (error) => rejectGuestBody({ resume, failure: () => onError(error) });

    request.on('data', keepChunk);
    request.on('end', settle);
    request.on('error', refuse);
  });
});

/** Keeps transport errors in the caller's declared failure channel. */
function rejectGuestBody<Failure>({ failure, resume }: RejectGuestBodyInput<Failure>): void {
  const error = failure();
  const failed = Result.fail(error);
  const rejected = Effect.fromResult(failed);

  resume(rejected);
}
