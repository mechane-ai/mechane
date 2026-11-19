import { ExecutionAccess as AccessSchema, RequestInvalid } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Record, Schema } from 'effect';
import type { Redacted } from 'effect';
import type { CredentialKeyring, ExecutionAccess } from '../../domain.ts';
import { recordConfigurationAudit } from '../api/configuration/audit.ts';
import { lockWorkspaceAuthority, requireCredentialReferences } from '../api/configuration/authority.ts';
import { executionCredentialReferences } from '../api/configuration/execution.ts';
import type { StoreContext } from '../context.ts';
import { readWorkspaceCredentialValues } from '../credentials.ts';
import { authorizeInstalledWork } from './installed-work-grant.ts';
import { ManagedStoreError } from './managed-record.ts';
import type { ManagedScope } from './types.ts';

type Target = { readonly scope: ManagedScope; readonly agentId: string; readonly granteePrincipalId: string };
type GrantRow = { readonly access: unknown };

type CommandEnvironment = {
  readonly variables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, Redacted.Redacted>>;
};

type WorkerAccess = { readonly workspaceId: string; readonly access: CommandEnvironment | null };

async function authorizeTarget(context: StoreContext, { scope, agentId, granteePrincipalId }: Target) {
  await lockWorkspaceAuthority({ context, ...scope, isOwnerRequired: true });

  const result = await context.client.query<{ readonly archived_at: string | null }>(
    `SELECT a.archived_at FROM mechane.managed_agents a
     JOIN mechane.memberships m ON m.workspace_id=a.workspace_id
     WHERE a.workspace_id=$1 AND a.id=$2 AND m.principal_id=$3 FOR SHARE OF a,m`,
    [scope.workspaceId, agentId, granteePrincipalId],
  );

  const agent = result.rows[0];

  if (agent === undefined) {
    throw new RequestInvalid({ reason: 'The agent and command grantee must belong to this workspace' });
  }

  return agent;
}

function readAccess(value: unknown): ExecutionAccess {
  const decoded = Schema.decodeUnknownResult(AccessSchema)(value);

  if (decoded._tag === 'Failure') {
    throw new RequestInvalid({ reason: 'Invalid command access configuration' });
  }

  return decoded.success;
}

export function createInstalledCommandAccess(context: StoreContext, keyring: CredentialKeyring) {
  return {
    get: (input: Target) =>
      context.atomic(async (transaction) => {
        await authorizeTarget(transaction, input);

        const result = await transaction.client.query<GrantRow>(
          'SELECT access FROM mechane.managed_command_grants WHERE workspace_id=$1 AND agent_id=$2 AND principal_id=$3',
          [input.scope.workspaceId, input.agentId, input.granteePrincipalId],
        );

        const grant = result.rows[0];

        if (grant === undefined) {
          return null;
        }

        return readAccess(grant.access);
      }),
    set: (input: Target & { readonly access: ExecutionAccess | null }) =>
      context.atomic(async (transaction) => {
        const { scope, agentId, granteePrincipalId } = input;
        const agent = await authorizeTarget(transaction, input);
        const target = [scope.workspaceId, agentId, granteePrincipalId];
        let action = 'managed-command-grant.saved';
        let saved = input.access;

        if (input.access === null) {
          action = 'managed-command-grant.removed';

          await transaction.client.query(
            'DELETE FROM mechane.managed_command_grants WHERE workspace_id=$1 AND agent_id=$2 AND principal_id=$3',
            target,
          );
        } else {
          if (agent.archived_at !== null) {
            throw new RequestInvalid({ reason: 'Archived agents cannot receive command grants' });
          }

          const access = readAccess(input.access);

          await requireCredentialReferences({
            context: transaction,
            workspaceId: scope.workspaceId,
            references: executionCredentialReferences(access),
          });
          await transaction.client.query(
            `INSERT INTO mechane.managed_command_grants (workspace_id,agent_id,principal_id,access)
             VALUES($1,$2,$3,$4::jsonb) ON CONFLICT (workspace_id,agent_id,principal_id)
             DO UPDATE SET access=excluded.access`,
            [...target, JSON.stringify(access)],
          );

          saved = access;
        }

        await recordConfigurationAudit({
          context: transaction,
          workspaceId: scope.workspaceId,
          principalId: scope.principalId,
          credentialId: scope.apiKeyId ?? null,
          action,
          targetId: `${agentId}/${granteePrincipalId}`,
        });

        return saved;
      }),
    resolve: (input: { readonly sessionId: string; readonly token: string }): Promise<WorkerAccess> =>
      context.atomic(async (transaction) => {
        const allocation = await authorizeInstalledWork(transaction, { ...input, access: 'tool' });

        if (allocation === null) {
          throw new ManagedStoreError(
            HttpStatusCode.Forbidden,
            'The workspace or worker lease does not allow this sandbox command',
          );
        }

        const { workspaceId, sessionId } = allocation;

        const result = await transaction.client.query<GrantRow>(
          `SELECT g.access FROM mechane.managed_sessions s
           JOIN mechane.managed_agents a ON (a.workspace_id,a.id,a.runtime_id)=(s.workspace_id,s.agent_id,s.runtime_mech_id)
           JOIN mechane.managed_command_grants g ON (g.workspace_id,g.agent_id,g.principal_id)=(a.workspace_id,a.id,s.creator_id)
           JOIN mechane.mechs m ON (m.workspace_id,m.id)=(a.workspace_id,a.runtime_id)
           WHERE s.workspace_id=$1 AND s.id=$2 AND s.child_runtime_mech_ids='{}'::jsonb
             AND s.archived_at IS NULL AND s.status<>'terminated' AND a.archived_at IS NULL AND m.status='active'
           FOR SHARE OF a,g,m`,
          [workspaceId, sessionId],
        );

        const row = result.rows[0];

        if (row === undefined) {
          return { workspaceId, access: null };
        }

        const access = readAccess(row.access);
        const secrets: Record<string, Redacted.Redacted> = {};

        const credentials = await readWorkspaceCredentialValues(transaction, keyring, {
          workspaceId,
          references: Record.values(access.secrets),
        });

        for (const [name, reference] of Record.toEntries(access.secrets)) {
          const secret = credentials.get(reference);

          if (secret === undefined) {
            throw new ManagedStoreError(HttpStatusCode.Conflict, 'A command credential is unavailable');
          }

          secrets[name] = secret;
        }

        return { workspaceId, access: { variables: access.variables, secrets } };
      }),
  };
}
