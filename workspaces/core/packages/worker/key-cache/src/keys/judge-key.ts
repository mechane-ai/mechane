import type { CachedKeyRow, LiveKeyRow } from '@mechane/key-cache-store';
import { JudgedKey } from '@mechane/rpc';
import { DateTime, Match, Option, Schema } from 'effect';

/** A shard's row of a key, and the instant of the call that judges it. */
type JudgeKeyInput = { readonly row: CachedKeyRow; readonly now: DateTime.Utc };

/** A shard's key no revocation reached, and the instant of the call that judges its expiry. */
type JudgeLiveKeyInput = { readonly key: LiveKeyRow; readonly now: DateTime.Utc };

/** Judges a shard's row of a key by the shard's clock; a revoked key is refused before an expired one. */
export function judgeKey({ row, now }: JudgeKeyInput): typeof JudgedKey.Encoded {
  const judged = Match.valueTags(row, {
    Revoked: () => JudgedKey.cases.Revoked.make({}),
    Live: (key) => judgeLiveKey({ key, now }),
  });

  return Schema.encodeSync(JudgedKey)(judged);
}

/** Resolves a live key with its principal, or refuses it once it expired. */
function judgeLiveKey({ key, now }: JudgeLiveKeyInput): JudgedKey {
  const { keyId, keyName, purpose, createdAt, expiresAt, principalId, principalName } = key;

  if (DateTime.isLessThanOrEqualTo(expiresAt, now)) {
    return JudgedKey.cases.Expired.make({ expiresAt });
  }

  return JudgedKey.cases.Resolved.make({
    key: { id: keyId, name: keyName, purpose, createdAt, expiresAt, revokedAt: Option.none() },
    principal: { id: principalId, name: principalName },
  });
}
