import { Effect } from 'effect';
import type { Server } from 'node:http';

type CloseServerInput = { readonly server: Server };

/** Closes the server and every connection it holds, so a waiting request does not hold the guest's stop. */
export const closeServer = Effect.fn('closeServer')(function* ({ server }: CloseServerInput): Effect.fn.Return<void> {
  yield* Effect.callback<void>((resume) => {
    const closed: () => void = () => resume(Effect.void);

    server.close(closed);
    server.closeAllConnections();
  });
});
