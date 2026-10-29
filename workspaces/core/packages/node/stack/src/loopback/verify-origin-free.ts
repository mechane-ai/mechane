import { Effect } from 'effect';
import type { Scope } from 'effect';
import { once } from 'node:events';
import { createServer } from 'node:net';
import type { Server } from 'node:net';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { closeLoopbackServer } from './close-loopback-server.ts';
import { loopbackPort } from './loopback-port.ts';

type VerifyOriginFreeInput = { readonly origin: URL };
type ListenAtOriginInput = VerifyOriginFreeInput & { readonly server: Server };

/** Checks that the persistent origin can be bound before starting its runtime. */
export const verifyOriginFree = Effect.fn('verifyOriginFree')(function* ({
  origin,
}: VerifyOriginFreeInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const server = createServer();

  const listen = Effect.tryPromise({
    try: () => listenAtOrigin({ server, origin }),
    catch: (cause) => new StackFailed({ step: StackStep.Listen, reason: String(cause) }),
  });

  const release: (listened: Server) => Effect.Effect<void> = (listened) => closeLoopbackServer({ server: listened });

  yield* Effect.acquireRelease(listen, release);
}, Effect.scoped);

async function listenAtOrigin({ origin, server }: ListenAtOriginInput): Promise<Server> {
  const port = loopbackPort({ origin });
  const listening = once(server, 'listening');

  server.listen(port, origin.hostname);
  await listening;

  return server;
}
