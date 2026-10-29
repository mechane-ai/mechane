import { callDirectory, callKeyCache } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { KeyAccessAnswer, KeyExpired, KeyRevoked, KeyUnrecognized } from '@mechane/protocol';
import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { CachedResolution, JudgedKey } from '@mechane/rpc';
import { Effect, Match } from 'effect';

/** A key its shard holds and judged live, with its principal. */
type CachedKey = typeof JudgedKey.cases.Resolved.Type;

type CachedKeyInput = { readonly settings: WorkerSettings; readonly tokenHash: string };

/**
 * The key of the token's hash as its cache shard judges it. A shard that holds no row of the token stores the key the
 * directory resolved, which a revocation's tombstone written first outlasts. A token the directory does not know is
 * never stored.
 */
export const cachedKey = Effect.fn('cachedKey')(function* ({
  settings,
  tokenHash: hash,
}: CachedKeyInput): Effect.fn.Return<CachedKey, AuthenticationFailure | ObjectUnavailable> {
  const cached = yield* callKeyCache({
    settings,
    tokenHash: hash,
    call: ({ keyCache }) => keyCache.resolveKey({ tokenHash: hash }),
    answer: CachedResolution,
  });

  const judged = yield* Match.valueTags(cached, {
    Missing: () => filledKey({ settings, tokenHash: hash }),
    Resolved: (key) => Effect.succeed(key),
    Revoked: (key) => Effect.succeed(key),
    Expired: (key) => Effect.succeed(key),
  });

  return yield* Match.valueTags(judged, {
    Resolved: (resolved) => Effect.succeed(resolved),
    Revoked: () => new KeyRevoked(),
    Expired: ({ expiresAt }) => new KeyExpired({ expiresAt }),
  });
});

/** Fills the key's shard from the directory's access of the key, and answers what the shard then judges it. */
const filledKey = Effect.fn('filledKey')(function* ({
  settings,
  tokenHash: hash,
}: CachedKeyInput): Effect.fn.Return<JudgedKey, KeyUnrecognized | ObjectUnavailable> {
  const found = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.keyAccess({ tokenHash: hash }),
    answer: KeyAccessAnswer,
  });

  const access = yield* Match.valueTags(found, {
    Found: (answer) => Effect.succeed(answer.access),
    Unknown: () => new KeyUnrecognized(),
  });

  return yield* callKeyCache({
    settings,
    tokenHash: hash,
    call: ({ keyCache }) => keyCache.fillKey({ tokenHash: hash, access }),
    answer: JudgedKey,
  });
});
