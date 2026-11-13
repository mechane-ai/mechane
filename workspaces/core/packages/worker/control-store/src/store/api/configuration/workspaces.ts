import {
  MechNotFound,
  PersonalWorkspaceProtected,
  PrincipalNotFound,
  WorkspaceCreationConflict,
  WorkspaceLastOwner,
  WorkspaceMemberNotFound,
  WorkspaceNotFound,
  WorkspacePolicyConflict,
} from '@mechane/protocol';
import { PrincipalId, RecordId, WorkspaceId } from '@mechane/records';
import { Record, Schema } from 'effect';
import type { Mech } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { recordConfigurationChange } from './audit.ts';
import { lockWorkspaceAuthority } from './authority.ts';
import type { MemberRecord, WorkspaceActor, WorkspacePolicy, WorkspaceRecord } from './types.ts';

type WorkspaceRow = {
  readonly kind: 'personal' | 'shared';
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
  readonly daily_cap_micros: number;
  readonly created_at: string;
};

type MemberRow = {
  readonly principal_id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
  readonly created_at: string;
};

type WorkspaceCreation = {
  readonly id: string;
  readonly name: string;
  readonly principalId: string;
  readonly credentialId?: string | null;
  readonly dailyAllowanceMicros: number;
};

type MemberChange = WorkspaceActor & { readonly memberPrincipalId: string; readonly role: 'owner' | 'member' | null };
type PolicyRow = { readonly policy: unknown; readonly daily_cap_micros: number };
type RuntimeAuthorityRow = PolicyRow & { readonly status: Mech['status']; readonly workspace_id: string | null };
type PolicyChange = WorkspaceActor & { readonly policy: WorkspacePolicy; readonly isCreateOnly: boolean };

const StoredPolicy = Schema.Struct({
  isSuspended: Schema.Boolean,
  hasSandboxes: Schema.Boolean,
  machines: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  dailyAllowanceMicros: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export function createWorkspaceRecords(context: StoreContext) {
  return {
    async listWorkspaces(principalId: string): Promise<ReadonlyArray<WorkspaceRecord>> {
      const result = await context.client.query<WorkspaceRow>(
        `SELECT workspace.id, workspace.name, membership.role, workspace.daily_cap_micros, workspace.created_at,
          CASE WHEN workspace.personal_owner_id IS NULL THEN 'shared' ELSE 'personal' END AS kind
         FROM mechane.workspaces workspace JOIN mechane.memberships membership ON membership.workspace_id = workspace.id
         WHERE membership.principal_id = $1 ORDER BY (workspace.personal_owner_id IS NOT NULL), workspace.created_at, workspace.id`,
        [principalId],
      );

      return result.rows.map(workspaceRecord);
    },
    async createWorkspace(input: WorkspaceCreation): Promise<WorkspaceRecord> {
      return await context.atomic(async (transaction) => {
        const created = await transaction.client.query(
          `INSERT INTO mechane.workspaces(id,name,creator_id,daily_cap_micros)
           VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING RETURNING id`,
          [input.id, input.name, input.principalId, input.dailyAllowanceMicros],
        );

        const result = await transaction.client.query<WorkspaceRow & { readonly creator_id: string }>(
          `SELECT id,name,creator_id,daily_cap_micros,created_at,'owner'::text AS role,
           CASE WHEN personal_owner_id IS NULL THEN 'shared' ELSE 'personal' END AS kind
           FROM mechane.workspaces WHERE id = $1 FOR UPDATE`,
          [input.id],
        );

        const workspace = result.rows[0];

        if (workspace === undefined || workspace.name !== input.name || workspace.creator_id !== input.principalId) {
          throw new WorkspaceCreationConflict({ workspaceId: WorkspaceId.make(input.id) });
        }

        if (created.rows.length > 0) {
          await transaction.client.query(
            'INSERT INTO mechane.memberships(workspace_id,principal_id,role) VALUES($1,$2,$3)',
            [input.id, input.principalId, 'owner'],
          );
          await recordConfigurationChange({
            context: transaction,
            ...input,
            workspaceId: input.id,
            action: 'workspace.created',
            targetId: input.id,
          });
        } else {
          const membership = await transaction.client.query(
            'SELECT principal_id FROM mechane.memberships WHERE workspace_id = $1 AND principal_id = $2 AND role = $3',
            [input.id, input.principalId, 'owner'],
          );

          if (membership.rows.length === 0) {
            throw new WorkspaceCreationConflict({ workspaceId: WorkspaceId.make(input.id) });
          }
        }

        return workspaceRecord(workspace);
      });
    },
    async listWorkspaceMembers(actor: WorkspaceActor): Promise<ReadonlyArray<MemberRecord>> {
      return await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...actor, isOwnerRequired: true });

        const result = await transaction.client.query<MemberRow>(
          `SELECT membership.principal_id, principal.name, membership.role, membership.created_at
           FROM mechane.memberships membership JOIN mechane.principals principal ON principal.id = membership.principal_id
           WHERE membership.workspace_id = $1 ORDER BY membership.created_at, membership.principal_id`,
          [actor.workspaceId],
        );

        return result.rows.map(memberRecord);
      });
    },
    async changeWorkspaceMember(input: MemberChange): Promise<MemberRecord | null> {
      return await context.atomic(async (transaction) => {
        const authority = await lockWorkspaceAuthority({ context: transaction, ...input, isOwnerRequired: true });

        if (authority.personal_owner_id !== null) {
          throw new PersonalWorkspaceProtected({ workspaceId: WorkspaceId.make(input.workspaceId) });
        }

        const principal = await transaction.client.query('SELECT id FROM mechane.principals WHERE id = $1', [
          input.memberPrincipalId,
        ]);

        if (principal.rows.length === 0) {
          throw new PrincipalNotFound({ principalId: PrincipalId.make(input.memberPrincipalId) });
        }

        const current = await transaction.client.query<{ readonly role: 'owner' | 'member' }>(
          'SELECT role FROM mechane.memberships WHERE workspace_id = $1 AND principal_id = $2',
          [input.workspaceId, input.memberPrincipalId],
        );

        if (current.rows.length === 0 && input.role === null) {
          throw new WorkspaceMemberNotFound({ principalId: PrincipalId.make(input.memberPrincipalId) });
        }

        if (current.rows[0]?.role === 'owner' && input.role !== 'owner') {
          const owners = await transaction.client.query(
            'SELECT principal_id FROM mechane.memberships WHERE workspace_id = $1 AND role = $2',
            [input.workspaceId, 'owner'],
          );

          if (owners.rows.length === 1) {
            throw new WorkspaceLastOwner({ workspaceId: WorkspaceId.make(input.workspaceId) });
          }
        }

        if (input.role === null) {
          await transaction.client.query(
            'DELETE FROM mechane.memberships WHERE workspace_id = $1 AND principal_id = $2',
            [input.workspaceId, input.memberPrincipalId],
          );
          await recordConfigurationChange({
            context: transaction,
            ...input,
            action: 'workspace.member-removed',
            targetId: input.memberPrincipalId,
          });

          return null;
        }

        await transaction.client.query(
          `INSERT INTO mechane.memberships(workspace_id,principal_id,role) VALUES($1,$2,$3)
           ON CONFLICT(workspace_id,principal_id) DO UPDATE SET role = EXCLUDED.role`,
          [input.workspaceId, input.memberPrincipalId, input.role],
        );
        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'workspace.member-set',
          targetId: input.memberPrincipalId,
        });

        const result = await transaction.client.query<MemberRow>(
          `SELECT membership.principal_id, principal.name, membership.role, membership.created_at
           FROM mechane.memberships membership JOIN mechane.principals principal ON principal.id = membership.principal_id
           WHERE membership.workspace_id = $1 AND membership.principal_id = $2`,
          [input.workspaceId, input.memberPrincipalId],
        );

        const member = result.rows[0];

        if (member === undefined) {
          throw new Error('membership write returned no member');
        }

        return memberRecord(member);
      });
    },
    async showWorkspacePolicy(workspaceId: string): Promise<WorkspacePolicy> {
      const policy = await readRuntimePolicy(context, workspaceId);

      if (policy === null) {
        throw new WorkspaceNotFound({ workspaceId: RecordId.make(workspaceId) });
      }

      return policy;
    },
    async getRuntimePolicy(input: { readonly workspaceId: string }): Promise<WorkspacePolicy | null> {
      return await readRuntimePolicy(context, input.workspaceId);
    },
    async getRuntimeAuthority(input: { readonly workspaceId: string; readonly mechId: string }) {
      const result = await context.client.query<RuntimeAuthorityRow>(
        `SELECT mech.status, workspace.id AS workspace_id, workspace.policy, workspace.daily_cap_micros
         FROM mechane.mechs AS mech LEFT JOIN mechane.workspaces AS workspace ON workspace.id = mech.workspace_id
         WHERE mech.workspace_id = $1 AND mech.id = $2`,
        [input.workspaceId, input.mechId],
      );

      const row = result.rows[0];

      if (row === undefined) {
        throw new MechNotFound({ mechId: input.mechId });
      }

      if (row.workspace_id === null) {
        return { status: row.status, policy: null };
      }

      return { status: row.status, policy: workspacePolicy(row) };
    },
    async setWorkspacePolicy(input: PolicyChange): Promise<WorkspacePolicy> {
      return await context.atomic(async (transaction) => {
        const result = await transaction.client.query<PolicyRow>(
          'SELECT policy,daily_cap_micros FROM mechane.workspaces WHERE id = $1 FOR UPDATE',
          [input.workspaceId],
        );

        const row = result.rows[0];

        if (row === undefined) {
          throw new WorkspaceNotFound({ workspaceId: RecordId.make(input.workspaceId) });
        }

        if (input.isCreateOnly && Schema.is(StoredPolicy)(row.policy)) {
          throw new WorkspacePolicyConflict({ workspaceId: WorkspaceId.make(input.workspaceId) });
        }

        await transaction.client.query(
          'UPDATE mechane.workspaces SET policy = $2,daily_cap_micros = $3 WHERE id = $1',
          [input.workspaceId, input.policy, input.policy.dailyAllowanceMicros],
        );
        await recordConfigurationChange({
          context: transaction,
          ...input,
          action: 'workspace.policy-changed',
          targetId: input.workspaceId,
        });

        return input.policy;
      });
    },
  };
}

function workspaceRecord(row: WorkspaceRow): WorkspaceRecord {
  return {
    kind: row.kind,
    id: row.id,
    name: row.name,
    role: row.role,
    dailyAllowanceMicros: row.daily_cap_micros,
    createdAt: row.created_at,
  };
}

function memberRecord(row: MemberRow): MemberRecord {
  return { principalId: row.principal_id, name: row.name, role: row.role, createdAt: row.created_at };
}

function workspacePolicy(row: PolicyRow): WorkspacePolicy {
  if (Schema.is(StoredPolicy)(row.policy)) {
    return row.policy;
  }

  if (Schema.is(Schema.Struct({}))(row.policy) && Record.keys(row.policy).length === 0) {
    return { isSuspended: false, hasSandboxes: true, machines: 1, dailyAllowanceMicros: row.daily_cap_micros };
  }

  return Schema.decodeUnknownSync(StoredPolicy)(row.policy);
}

async function readRuntimePolicy(context: StoreContext, workspaceId: string): Promise<WorkspacePolicy | null> {
  const result = await context.client.query<PolicyRow>(
    'SELECT policy,daily_cap_micros FROM mechane.workspaces WHERE id = $1',
    [workspaceId],
  );

  const row = result.rows[0];

  if (row === undefined) {
    return null;
  }

  return workspacePolicy(row);
}
