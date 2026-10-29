import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { ClaimedSignInRow } from '../schemas.ts';
import type { ClaimSignInInput, OpenSignInInput, SignInRecords } from '../types.ts';

/** The sign-ins that wait for GitHub's return, by their states' hashes, each claimed at most once. */
export function signInRecords({ sql }: RecordsInput): SignInRecords {
  return {
    openSignIn: (input) => openSignIn({ sql, ...input }),
    claimSignIn: (input) => claimSignIn({ sql, ...input }),
  };
}

function openSignIn({ sql, signIn }: SqlCall<OpenSignInInput>): void {
  sql.exec('DELETE FROM sign_ins WHERE expires_at_ms <= ?', DateTime.toEpochMillis(signIn.createdAt));
  sql.exec(
    'INSERT INTO sign_ins (state_hash, created_at_ms, expires_at_ms) VALUES (?, ?, ?)',
    signIn.stateHash,
    DateTime.toEpochMillis(signIn.createdAt),
    DateTime.toEpochMillis(signIn.expiresAt),
  );
}

function claimSignIn({ sql, stateHash, now }: SqlCall<ClaimSignInInput>): Option.Option<ClaimedSignInRow> {
  const cursor = sql.exec(
    'DELETE FROM sign_ins WHERE state_hash = ? AND expires_at_ms > ? RETURNING state_hash',
    stateHash,
    DateTime.toEpochMillis(now),
  );

  return decodeFirst({ cursor, schema: ClaimedSignInRow });
}
