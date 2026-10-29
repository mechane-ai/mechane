import { callDirectory } from '@mechane/bindings';
import { catalog, RequestInvalid } from '@mechane/protocol';
import type { KeyPage, ObjectUnavailable } from '@mechane/protocol';
import { DirectoryKeyPage } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/**
 * Lists a page of the caller's own keys, oldest first. No other principal's key is ever read, so a cursor that names
 * one is refused as one that names no key is.
 */
export const listKeys = Effect.fn('listKeys')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.listKeys>): Effect.fn.Return<KeyPage, RequestInvalid | ObjectUnavailable> {
  const query = Schema.encodeSync(catalog.listKeys.query)(input);

  const page = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.keysOfPrincipal({ principalId: caller.principal.id, query }),
    answer: DirectoryKeyPage,
  });

  return yield* Match.valueTags(page, {
    Listed: ({ keys, hasMore }) => Effect.succeed({ keys, hasMore }),
    CursorMissing: () => new RequestInvalid({ reason: 'after names no key of yours' }),
  });
});
