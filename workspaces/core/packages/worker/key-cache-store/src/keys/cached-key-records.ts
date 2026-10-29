import type { FillKeyInput } from '@mechane/protocol';
import { decodeFirst, decodeOne } from '@mechane/store';
import type { RecordsInput, SqlCall, StatementCursor } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { CachedKeyRow } from '../schemas.ts';
import type { CachedKeyInput, CachedKeyRecords, RevokeKeyInput } from '../types.ts';

/** A shard's keys by their tokens' hashes: the directory's fills, and the tombstones of revocations. */
export function cachedKeyRecords({ sql }: RecordsInput): CachedKeyRecords {
  return {
    cachedKey: (input) => cachedKey({ sql, ...input }),
    fillKey: (input) => fillKey({ sql, ...input }),
    revokeKey: (input) => revokeKey({ sql, ...input }),
  };
}

function cachedKey({ sql, tokenHash }: SqlCall<CachedKeyInput>): Option.Option<CachedKeyRow> {
  return decodeFirst({ cursor: keyRow({ sql, tokenHash }), schema: CachedKeyRow });
}

/**
 * A fill that a revocation's tombstone came before keeps the tombstone, so a revoked key never resolves again. Either
 * way the token has a row after it, so a missing one is a defect.
 */
function fillKey({ sql, tokenHash, access }: SqlCall<FillKeyInput>): CachedKeyRow {
  const { key, principal } = access;

  sql.exec(
    'INSERT INTO cached_keys (token_hash, key_id, key_name, purpose, created_at_ms, expires_at_ms, principal_id, principal_name, revoked_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (token_hash) DO NOTHING',
    tokenHash,
    key.id,
    key.name,
    key.purpose,
    key.createdAtMs,
    key.expiresAtMs,
    principal.id,
    principal.name,
    key.revokedAtMs,
  );

  return decodeOne({ cursor: keyRow({ sql, tokenHash }), schema: CachedKeyRow });
}

function revokeKey({ sql, tokenHash, now }: SqlCall<RevokeKeyInput>): void {
  sql.exec(
    'INSERT INTO cached_keys (token_hash, revoked_at_ms) VALUES (?, ?) ON CONFLICT (token_hash) DO UPDATE SET revoked_at_ms = COALESCE(revoked_at_ms, excluded.revoked_at_ms)',
    tokenHash,
    DateTime.toEpochMillis(now),
  );
}

/** Selects the shard's row of the token's hash, tagged by whether a revocation reached it. */
function keyRow({ sql, tokenHash }: SqlCall<CachedKeyInput>): StatementCursor {
  return sql.exec(
    "SELECT CASE WHEN revoked_at_ms IS NULL THEN 'Live' ELSE 'Revoked' END AS _tag, key_id, key_name, purpose, created_at_ms, expires_at_ms, principal_id, principal_name FROM cached_keys WHERE token_hash = ?",
    tokenHash,
  );
}
