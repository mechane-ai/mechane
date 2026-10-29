import { Effect, Option, Result, Schema } from 'effect';
import type { Scope } from 'effect';
import type { Server } from 'node:net';
import { LOOPBACK_HOST, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { closeLoopbackServer } from './close-loopback-server.ts';

type ServerInput = { readonly server: Server };

/** The address a listening TCP server reports, read only for its port. */
const BoundAddress = Schema.Struct({ port: Schema.Int });

type BoundAddress = typeof BoundAddress.Type;

/**
 * Listens with `server` on a port the operating system picks on the loopback host until the scope closes, and answers
 * with the port.
 */
export const serveOnLoopback = Effect.fn('serveOnLoopback')(function* ({
  server,
}: ServerInput): Effect.fn.Return<number, StackFailed, Scope.Scope> {
  yield* Effect.acquireRelease(listen({ server }), () => closeLoopbackServer({ server }));

  const bound = Result.getSuccess(Schema.decodeUnknownResult(BoundAddress)(server.address()));

  if (Option.isNone(bound)) {
    return yield* new StackFailed({ step: StackStep.Listen, reason: `${LOOPBACK_HOST} gave no TCP address` });
  }

  return bound.value.port;
});

/** Starts listening on a free port of the loopback host. */
const listen = Effect.fn('listen')(function* ({ server }: ServerInput): Effect.fn.Return<void, StackFailed> {
  yield* Effect.callback<void, StackFailed>((resume) => {
    const refuse: (error: Error) => void = (error) =>
      resume(Effect.fail(new StackFailed({ step: StackStep.Listen, reason: error.message })));

    const listening: () => void = () => resume(Effect.void);

    server.once('error', refuse);
    server.listen(0, LOOPBACK_HOST, listening);
  });
});
