import { RequestInvalid } from '@mechane/protocol';
import { Effect } from 'effect';
import type { IncomingMessage } from 'node:http';

type ReadExecutionBodyInput = { readonly request: IncomingMessage };

/** The whole body of an execution's request, as text once it has arrived. */
export const readExecutionBody = Effect.fn('readExecutionBody')(function* ({
  request,
}: ReadExecutionBodyInput): Effect.fn.Return<string, RequestInvalid> {
  return yield* Effect.callback<string, RequestInvalid>((resume) => {
    const chunks: Array<Buffer> = [];

    const keepChunk: (chunk: Buffer) => void = (chunk) => {
      chunks.push(chunk);
    };

    const settle: () => void = () => resume(Effect.succeed(Buffer.concat(chunks).toString('utf8')));

    const refuse: (error: Error) => void = (error) =>
      resume(Effect.fail(new RequestInvalid({ reason: error.message })));

    request.on('data', keepChunk);
    request.on('end', settle);
    request.on('error', refuse);
  });
});
