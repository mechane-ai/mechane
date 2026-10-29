import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createServer } from 'node:net';
import type { StackFailed } from '../errors.ts';
import { loopbackUrl } from './loopback-url.ts';
import { serveOnLoopback } from './serve-on-loopback.ts';

/** The operating system selects a free port; the reservation closes before the runtime binds it. */
export const freeLoopbackOrigin = Effect.fn('freeLoopbackOrigin')(function* (): Effect.fn.Return<
  URL,
  StackFailed,
  Scope.Scope
> {
  const server = createServer();
  const port = yield* serveOnLoopback({ server });

  const address = loopbackUrl({ port });

  return new URL(address);
}, Effect.scoped);
