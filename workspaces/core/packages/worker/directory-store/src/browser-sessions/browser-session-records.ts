import { BrowserIdentity } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import type { BrowserSessionRecords, LiveBrowserSessionInput, OpenBrowserSessionInput } from '../types.ts';

/** Stores hashed browser sessions and resolves their unexpired identities. */
export function browserSessionRecords({ sql }: RecordsInput): BrowserSessionRecords {
  return {
    openBrowserSession: (input) => openBrowserSession({ sql, ...input }),
    liveBrowserSession: (input) => liveBrowserSession({ sql, ...input }),
  };
}

function openBrowserSession({ sql, session }: SqlCall<OpenBrowserSessionInput>): void {
  sql.exec('DELETE FROM identity_sessions WHERE expires_at_ms <= ?', DateTime.toEpochMillis(session.createdAt));
  sql.exec(
    'INSERT INTO identity_sessions (token_hash, provider, subject, name, created_at_ms, expires_at_ms) VALUES (?, ?, ?, ?, ?, ?)',
    session.tokenHash,
    session.provider,
    session.subject,
    session.name,
    DateTime.toEpochMillis(session.createdAt),
    DateTime.toEpochMillis(session.expiresAt),
  );
}

function liveBrowserSession({ sql, tokenHash, now }: SqlCall<LiveBrowserSessionInput>): Option.Option<BrowserIdentity> {
  const cursor = sql.exec(
    'SELECT provider, subject, name FROM identity_sessions WHERE token_hash = ? AND expires_at_ms > ?',
    tokenHash,
    DateTime.toEpochMillis(now),
  );

  return decodeFirst({ cursor, schema: BrowserIdentity });
}
