import { KeyRow } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { decodeFirst, readPage } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { KeyRowPage } from '../schemas.ts';
import type {
  IssueKeyInput,
  KeyForTokenInput,
  KeyRecords,
  KeysOfPrincipalInput,
  OwnedKeyInput,
  RevokeKeyInput,
} from '../types.ts';

/** The token's hash of a key, which its revocation reads first to tombstone the key in its cache shard. */
const TokenHashRow = wireStruct({ fields: { tokenHash: Schema.String } });

type TokenHashRow = typeof TokenHashRow.Type;

/** The directory's keys by their tokens' hashes: their issue, their reads by token or owner, and their revocation. */
export function keyRecords({ sql }: RecordsInput): KeyRecords {
  return {
    issueKey: (input) => issueKey({ sql, ...input }),
    keyForToken: (input) => keyForToken({ sql, ...input }),
    keysOfPrincipal: (input) => keysOfPrincipal({ sql, ...input }),
    keyTokenHash: (input) => keyTokenHash({ sql, ...input }),
    revokeKey: (input) => revokeKey({ sql, ...input }),
  };
}

function issueKey({ sql, key }: SqlCall<IssueKeyInput>): void {
  sql.exec(
    'INSERT INTO keys (id, token_hash, principal_id, name, purpose, created_at_ms, expires_at_ms, revoked_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    key.id,
    key.tokenHash,
    key.principalId,
    key.name,
    key.purpose,
    key.createdAtMs,
    key.expiresAtMs,
    key.revokedAtMs,
  );
}

function keyForToken({ sql, tokenHash }: SqlCall<KeyForTokenInput>): Option.Option<KeyRow> {
  const cursor = sql.exec(
    'SELECT id, principal_id, name, purpose, created_at_ms, expires_at_ms, revoked_at_ms FROM keys WHERE token_hash = ?',
    tokenHash,
  );

  return decodeFirst({ cursor, schema: KeyRow });
}

/** The cursor resolves within the principal's keys, so another principal's key names none, as a missing one does. */
function keysOfPrincipal({ sql, principalId, after }: SqlCall<KeysOfPrincipalInput>): KeyRowPage {
  const page = readPage({
    after,
    lastRow: ({ last }) => sql.exec('SELECT rowid FROM keys WHERE id = ? AND principal_id = ?', last, principalId),
    rowsAfter: ({ rowid, count }) =>
      sql.exec(
        'SELECT id, principal_id, name, purpose, created_at_ms, expires_at_ms, revoked_at_ms FROM keys WHERE principal_id = ? AND rowid > ? ORDER BY rowid LIMIT ?',
        principalId,
        rowid,
        count,
      ),
    schema: KeyRow,
  });

  return Option.match(page, {
    onNone: () => KeyRowPage.cases.CursorMissing.make({}),
    onSome: ({ rows, hasMore }) => KeyRowPage.cases.Listed.make({ keys: rows, hasMore }),
  });
}

function keyTokenHash({ sql, principalId, keyId }: SqlCall<OwnedKeyInput>): Option.Option<string> {
  const cursor = sql.exec('SELECT token_hash FROM keys WHERE id = ? AND principal_id = ?', keyId, principalId);

  const row = decodeFirst({ cursor, schema: TokenHashRow });

  return Option.map(row, ({ tokenHash }) => tokenHash);
}

function revokeKey({ sql, principalId, keyId, now }: SqlCall<RevokeKeyInput>): Option.Option<KeyRow> {
  const cursor = sql.exec(
    'UPDATE keys SET revoked_at_ms = COALESCE(revoked_at_ms, ?) WHERE id = ? AND principal_id = ? RETURNING id, principal_id, name, purpose, created_at_ms, expires_at_ms, revoked_at_ms',
    DateTime.toEpochMillis(now),
    keyId,
    principalId,
  );

  return decodeFirst({ cursor, schema: KeyRow });
}
