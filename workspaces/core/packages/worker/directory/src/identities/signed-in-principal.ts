import type { DirectoryStore, PrincipalRow } from '@mechane/directory-store';
import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import { PrincipalId, WorkspaceId } from '@mechane/records';
import type { BrowserIdentity, Micros } from '@mechane/records';
import { Option } from 'effect';
import type { DateTime } from 'effect';

/** A live browser session signing in, and the allowance of the workspace a first sign-in creates. */
type SignedInPrincipalInput = {
  readonly store: DirectoryStore;
  readonly session: BrowserIdentity;
  readonly dailyAllowanceMicros: Micros;
  readonly now: DateTime.Utc;
};

/** An identity's provider and subject establish ownership; its name only labels new records. */
export function signedInPrincipal({ store, session, dailyAllowanceMicros, now }: SignedInPrincipalInput): PrincipalRow {
  const identity = { provider: session.provider, subject: session.subject };
  const existing = store.principalForIdentity({ identity });

  if (Option.isSome(existing)) {
    return existing.value;
  }

  const principalId = PrincipalId.make(crypto.randomUUID());
  const workspaceId = WorkspaceId.make(crypto.randomUUID());
  const principal = { id: principalId, name: session.name };
  const workspace = { id: workspaceId, name: session.name, dailyAllowanceMicros };

  store.signUp({ principal, identity, workspace, now });
  writeLog({
    line: {
      event: LogEvent.IdentitySignedUp,
      principalId: principal.id,
      workspaceId: workspace.id,
      provider: session.provider,
    },
  });

  return principal;
}
