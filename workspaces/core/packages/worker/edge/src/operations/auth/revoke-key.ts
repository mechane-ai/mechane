import { callDirectory, callKeyCache } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { KeyNotFound } from '@mechane/protocol';
import type { catalog, KeyMetadata, ObjectUnavailable } from '@mechane/protocol';
import { KeyRevocation, KeyTokenAnswer } from '@mechane/rpc';
import type { OwnedKey } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** The caller's key to tombstone, and the settings that bind its directory and shard. */
type TombstoneInput = { readonly settings: WorkerSettings; readonly owned: OwnedKey };

/**
 * Revokes one of the caller's keys; another principal's key is not found, exactly as a missing one is. The key's cache
 * shard writes its tombstone before the directory revokes it, so no shard resolves the key after the revocation
 * answers. A retry finishes a revocation cut off between the two.
 */
export const revokeKey = Effect.fn('revokeKey')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.revokeKey>): Effect.fn.Return<KeyMetadata, KeyNotFound | ObjectUnavailable> {
  const owned = { principalId: caller.principal.id, keyId: input.keyId };

  yield* tombstone({ settings, owned });

  const revocation = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.revokeKey(owned),
    answer: KeyRevocation,
  });

  return yield* Match.valueTags(revocation, {
    Revoked: ({ key }) => Effect.succeed(key),
    NotFound: () => new KeyNotFound({ keyId: owned.keyId }),
  });
});

/** Writes the tombstone of the caller's key in its cache shard, by the token's hash the directory holds for it. */
const tombstone = Effect.fn('tombstone')(function* ({
  settings,
  owned,
}: TombstoneInput): Effect.fn.Return<void, KeyNotFound | ObjectUnavailable> {
  const found = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.keyTokenHash(owned),
    answer: KeyTokenAnswer,
  });

  const { tokenHash } = yield* Match.valueTags(found, {
    Found: (answer) => Effect.succeed(answer),
    NotFound: () => new KeyNotFound({ keyId: owned.keyId }),
  });

  yield* callKeyCache({
    settings,
    tokenHash,
    call: ({ keyCache }) => keyCache.revokeKey({ tokenHash }),
    answer: Schema.Undefined,
  });
});
