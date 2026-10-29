import { Effect } from 'effect';
import type { Server } from 'node:net';

type CloseLoopbackServerInput = { readonly server: Server };

/** Stops the server listening, once its open connections have ended. */
export const closeLoopbackServer = Effect.fn('closeLoopbackServer')(function* ({
  server,
}: CloseLoopbackServerInput): Effect.fn.Return<void> {
  yield* Effect.callback<void>((resume) => {
    const closed: () => void = () => resume(Effect.void);

    server.close(closed);
  });
});
