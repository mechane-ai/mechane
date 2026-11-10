import { loopbackUrl, serveOnLoopback } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createServer } from 'node:net';
import type { StackFailed } from '../errors.ts';
import { stackListenFailure } from './stack-listen-failure.ts';

/** The operating system selects a free port; the reservation closes before the runtime binds it. */
export const freeLoopbackOrigin = Effect.fn('freeLoopbackOrigin')(function* (): Effect.fn.Return<
  URL,
  StackFailed,
  Scope.Scope
> {
  const server = createServer();
  const listening = serveOnLoopback({ server });
  const port = yield* Effect.mapError(listening, stackListenFailure);

  const address = loopbackUrl({ port });

  return new URL(address);
}, Effect.scoped);
