import { Effect } from 'effect';
import type { Server } from 'node:net';

type CloseLoopbackServerInput = { readonly server: Server };

/** Releases the listener after its open connections finish. */
export const closeLoopbackServer = Effect.fn('closeLoopbackServer')(function* ({
  server,
}: CloseLoopbackServerInput): Effect.fn.Return<void> {
  yield* Effect.callback<void>((resume) => {
    const closed: () => void = () => resume(Effect.void);

    server.close(closed);
  });
});
