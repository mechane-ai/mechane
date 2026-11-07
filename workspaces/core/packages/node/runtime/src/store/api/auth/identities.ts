import { randomUUID } from 'node:crypto';
import type { Identity } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import type { AuthPrincipal, AuthSession, OpenIdentitySession } from './types.ts';

type SessionRow = { readonly principal_id: string; readonly expires_at: string };
type OpenSignIn = { readonly tokenHash: string; readonly returnTo: string; readonly expiresAt: string };
type HashedToken = { readonly tokenHash: string };
type PrincipalId = { readonly principalId: string };
type IdentityRow = { readonly provider: 'github'; readonly subject: string; readonly login: string };
type ReturnRow = { readonly return_to: string };
type MembershipInput = { readonly principalId: string; readonly workspaceId: string };
type MembershipRow = { readonly role: 'owner' | 'member' };

export function createIdentityStore(context: StoreContext) {
  return {
    async openSignIn({ tokenHash, returnTo, expiresAt }: OpenSignIn): Promise<void> {
      await context.client.query('DELETE FROM mechane.oauth_states WHERE expires_at<=now()');
      await context.client.query('INSERT INTO mechane.oauth_states(token_hash,return_to,expires_at) VALUES($1,$2,$3)', [
        tokenHash,
        returnTo,
        expiresAt,
      ]);
    },

    async claimSignIn({ tokenHash }: HashedToken): Promise<string | null> {
      const result = await context.client.query<ReturnRow>(
        'DELETE FROM mechane.oauth_states WHERE token_hash=$1 AND expires_at>now() RETURNING return_to',
        [tokenHash],
      );

      return result.rows[0]?.return_to ?? null;
    },

    async openIdentitySession(input: OpenIdentitySession): Promise<AuthPrincipal> {
      return await context.atomic(async ({ client }) => {
        await client.query('DELETE FROM mechane.browser_sessions WHERE expires_at<=now()');

        const identityKey = `${input.identity.provider}:${input.identity.subject}`;

        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [identityKey]);

        const existing = await client.query<AuthPrincipal>(
          'SELECT principal.id,principal.name FROM mechane.principals principal JOIN mechane.identities identity ON identity.principal_id=principal.id WHERE identity.provider=$1 AND identity.subject=$2',
          [input.identity.provider, input.identity.subject],
        );

        const principal = existing.rows[0] ?? { id: randomUUID(), name: input.identity.login };

        if (existing.rows.length === 0) {
          await client.query('INSERT INTO mechane.principals(id,name) VALUES($1,$2)', [principal.id, principal.name]);
          await client.query(
            'INSERT INTO mechane.identities(provider,subject,login,principal_id) VALUES($1,$2,$3,$4)',
            [input.identity.provider, input.identity.subject, input.identity.login, principal.id],
          );

          const workspaceId = randomUUID();

          await client.query(
            'INSERT INTO mechane.workspaces(id,name,creator_id,daily_cap_micros,personal_owner_id) VALUES($1,$2,$3,$4,$3)',
            [workspaceId, input.identity.login, principal.id, input.personalDailyCapMicros],
          );
          await client.query("INSERT INTO mechane.memberships(workspace_id,principal_id,role) VALUES($1,$2,'owner')", [
            workspaceId,
            principal.id,
          ]);
        }

        await client.query('UPDATE mechane.principals SET name=$2 WHERE id=$1', [principal.id, input.identity.login]);
        await client.query('UPDATE mechane.identities SET login=$3 WHERE provider=$1 AND subject=$2', [
          input.identity.provider,
          input.identity.subject,
          input.identity.login,
        ]);

        if (input.bootstrap !== null && existing.rows.length === 0) {
          await client.query(
            'INSERT INTO mechane.workspaces(id,name,creator_id,daily_cap_micros) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',
            [input.bootstrap.workspaceId, input.bootstrap.workspaceName, principal.id, input.bootstrap.dailyCapMicros],
          );
          await client.query(
            "INSERT INTO mechane.memberships(workspace_id,principal_id,role) VALUES($1,$2,'owner') ON CONFLICT(workspace_id,principal_id) DO NOTHING",
            [input.bootstrap.workspaceId, principal.id],
          );
        }

        await client.query(
          'INSERT INTO mechane.browser_sessions(token_hash,principal_id,expires_at) VALUES($1,$2,$3)',
          [input.tokenHash, principal.id, input.expiresAt],
        );

        return { id: principal.id, name: input.identity.login };
      });
    },

    async findSession({ tokenHash }: HashedToken): Promise<AuthSession | null> {
      const result = await context.client.query<SessionRow>(
        'SELECT principal_id,expires_at FROM mechane.browser_sessions WHERE token_hash=$1 AND expires_at>now()',
        [tokenHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return { principalId: row.principal_id, expiresAt: row.expires_at };
    },

    async closeSession({ tokenHash }: HashedToken): Promise<void> {
      await context.client.query('DELETE FROM mechane.browser_sessions WHERE token_hash=$1', [tokenHash]);
    },

    async principalIdentities({ principalId }: PrincipalId): Promise<ReadonlyArray<Identity>> {
      const result = await context.client.query<IdentityRow>(
        'SELECT provider,subject,login FROM mechane.identities WHERE principal_id=$1',
        [principalId],
      );

      return result.rows;
    },

    async findPrincipal({ principalId }: PrincipalId): Promise<AuthPrincipal | null> {
      const result = await context.client.query<AuthPrincipal>('SELECT id,name FROM mechane.principals WHERE id=$1', [
        principalId,
      ]);

      return result.rows[0] ?? null;
    },

    async getMembership({ principalId, workspaceId }: MembershipInput): Promise<'owner' | 'member' | null> {
      const result = await context.client.query<MembershipRow>(
        'SELECT role FROM mechane.memberships WHERE principal_id=$1 AND workspace_id=$2',
        [principalId, workspaceId],
      );

      return result.rows[0]?.role ?? null;
    },
  };
}
