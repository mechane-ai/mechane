import { KeyNotFound, PersonalWorkspaceProtected, RequestInvalid } from '@mechane/protocol';
import { RecordId, WorkspaceId } from '@mechane/records';
import { randomUUID } from 'node:crypto';
import type { StoreContext } from '../../context.ts';
import { recordConfigurationAudit } from '../configuration/audit.ts';
import { lockWorkspaceAuthority } from '../configuration/authority.ts';
import type { WorkspaceActor } from '../configuration/types.ts';
import { createKeyStore } from './keys.ts';

type Service = WorkspaceActor & { readonly credentialId: string | null; readonly subject: string };
type RotateKey = Service & { readonly tokenHash: string; readonly keyLifetimeSeconds: number };
type Principal = { readonly principal_id: string };
type Key = { readonly key_id: string; readonly expires_at: string };

async function authorize(context: StoreContext, service: Service) {
  const workspace = await lockWorkspaceAuthority({ context, ...service, isOwnerRequired: true });

  if (service.credentialId !== null) {
    const login = await context.client.query(
      `SELECT id FROM mechane.api_keys WHERE id=$1 AND principal_id=$2 AND purpose='login'
       AND revoked_at IS NULL AND expires_at>now() FOR SHARE`,
      [service.credentialId, service.principalId],
    );

    if (login.rows.length === 0) {
      throw new RequestInvalid({ reason: 'Manage service keys from an owner browser session or CLI login' });
    }
  }

  if (workspace.personal_owner_id !== null) {
    throw new PersonalWorkspaceProtected({ workspaceId: WorkspaceId.make(service.workspaceId) });
  }
}

async function findPrincipal(context: StoreContext, { workspaceId, subject }: Service) {
  const result = await context.client.query<Principal>(
    'SELECT principal_id FROM mechane.workspace_service_principals WHERE workspace_id=$1 AND subject=$2',
    [workspaceId, subject],
  );

  return result.rows[0]?.principal_id;
}

async function requirePrincipal(context: StoreContext, service: Service) {
  const principalId = await findPrincipal(context, service);

  if (principalId === undefined) {
    throw new RequestInvalid({ reason: 'Workspace service principal does not exist' });
  }

  return principalId;
}

async function ensurePrincipal(context: StoreContext, service: Service) {
  const existing = await findPrincipal(context, service);

  if (existing !== undefined) {
    return existing;
  }

  const principalId = randomUUID();

  await context.client.query('INSERT INTO mechane.principals(id,name) VALUES($1,$2)', [principalId, service.subject]);
  await context.client.query(
    'INSERT INTO mechane.workspace_service_principals(workspace_id,subject,principal_id) VALUES($1,$2,$3)',
    [service.workspaceId, service.subject, principalId],
  );

  return principalId;
}

export async function revokePrincipalKeys(context: StoreContext, principalId: string) {
  await context.client.query(
    'UPDATE mechane.api_keys SET revoked_at=now() WHERE principal_id=$1 AND revoked_at IS NULL',
    [principalId],
  );
}

export function createWorkspaceServiceStore(context: StoreContext) {
  return {
    async showWorkspaceServicePrincipal(service: Service) {
      return await context.atomic(async (transaction) => {
        await authorize(transaction, service);

        const principalId = await requirePrincipal(transaction, service);

        const result = await transaction.client.query<Key>(
          `SELECT id AS key_id,expires_at FROM mechane.api_keys
           WHERE principal_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,
          [principalId],
        );

        return { principal_id: principalId, subject: service.subject, active_key: result.rows[0] ?? null };
      });
    },

    async rotateWorkspaceServiceKey(service: RotateKey) {
      return await context.atomic(async (transaction) => {
        await authorize(transaction, service);

        const principalId = await ensurePrincipal(transaction, service);

        await transaction.client.query(
          "INSERT INTO mechane.memberships(workspace_id,principal_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING",
          [service.workspaceId, principalId],
        );
        await revokePrincipalKeys(transaction, principalId);

        const keyId = randomUUID();

        const issued = await transaction.client.query<{ readonly expires_at: string }>(
          `INSERT INTO mechane.api_keys(id,principal_id,token_hash,name,purpose,approved_by,expires_at)
           VALUES($1,$2,$3,$4,'named',$5,now()+make_interval(secs=>$6)) RETURNING expires_at`,
          [keyId, principalId, service.tokenHash, service.subject, service.principalId, service.keyLifetimeSeconds],
        );

        const key = issued.rows[0];

        if (key === undefined) {
          throw new Error('Service key issuance returned no key');
        }

        await recordConfigurationAudit({
          context: transaction,
          ...service,
          action: 'workspace.service-key-rotated',
          targetId: keyId,
        });

        return { principal_id: principalId, key_id: keyId, expires_at: key.expires_at };
      });
    },

    async revokeWorkspaceServiceKey(service: Service & { readonly keyId: string }) {
      return await context.atomic(async (transaction) => {
        await authorize(transaction, service);

        const principalId = await requirePrincipal(transaction, service);
        const key = await createKeyStore(transaction).revokeKey({ principalId, keyId: service.keyId });

        if (key === null) {
          throw new KeyNotFound({ keyId: RecordId.make(service.keyId) });
        }

        await recordConfigurationAudit({
          context: transaction,
          ...service,
          action: 'workspace.service-key-revoked',
          targetId: key.id,
        });

        return { key_id: key.id };
      });
    },

    async resolveWorkspaceServiceKey({ tokenHash }: { readonly tokenHash: string }) {
      const result = await context.client.query<Principal & { readonly key_id: string; readonly workspace_id: string }>(
        `SELECT service.workspace_id,service.principal_id,key.id AS key_id FROM mechane.api_keys key
         JOIN mechane.workspace_service_principals service ON service.principal_id=key.principal_id
         JOIN mechane.memberships membership ON membership.workspace_id=service.workspace_id AND membership.principal_id=service.principal_id
         WHERE key.token_hash=$1 AND key.revoked_at IS NULL AND key.expires_at>now() AND membership.role='member'`,
        [tokenHash],
      );

      return result.rows[0] ?? null;
    },
  };
}
