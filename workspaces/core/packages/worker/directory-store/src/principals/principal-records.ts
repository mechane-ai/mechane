import { MembershipRole } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { decodeFirst, decodeNonEmptyRows, decodeOne } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import type { Array } from 'effect';
import { PrincipalRow, WorkspaceRow } from '../schemas.ts';
import type {
  PrincipalForIdentityInput,
  PrincipalInput,
  PrincipalRecords,
  SignUpInput,
  WorkspaceInput,
  WorkspaceMembershipInput,
} from '../types.ts';

/** The model spend a workspace may make each UTC day. */
const AllowanceRow = wireStruct({ fields: { dailyAllowanceMicros: Schema.Int } });

type AllowanceRow = typeof AllowanceRow.Type;

const MembershipRow = Schema.Struct({ role: Schema.Enum(MembershipRole) });

/** The directory's principals, with the identity each signed up with and the workspaces it is a member of. */
export function principalRecords({ sql }: RecordsInput): PrincipalRecords {
  return {
    principal: (input) => principal({ sql, ...input }),
    principalForIdentity: (input) => principalForIdentity({ sql, ...input }),
    signUp: (input) => signUp({ sql, ...input }),
    workspacesOfPrincipal: (input) => workspacesOfPrincipal({ sql, ...input }),
    workspaceMembership: (input) => workspaceMembership({ sql, ...input }),
    dailyAllowanceMicros: (input) => dailyAllowanceMicros({ sql, ...input }),
  };
}

/** Every key and identity names an existing principal, so a missing one is a defect. */
function principal({ sql, principalId }: SqlCall<PrincipalInput>): PrincipalRow {
  const cursor = sql.exec('SELECT id, name FROM principals WHERE id = ?', principalId);

  return decodeOne({ cursor, schema: PrincipalRow });
}

function principalForIdentity({ sql, identity }: SqlCall<PrincipalForIdentityInput>): Option.Option<PrincipalRow> {
  const cursor = sql.exec(
    'SELECT principals.id, principals.name FROM principal_identities JOIN principals ON principals.id = principal_identities.principal_id WHERE principal_identities.provider = ? AND principal_identities.subject = ?',
    identity.provider,
    identity.subject,
  );

  return decodeFirst({ cursor, schema: PrincipalRow });
}

function signUp({ sql, principal: created, identity, workspace, now }: SqlCall<SignUpInput>): void {
  const createdAtMs = DateTime.toEpochMillis(now);

  sql.exec('INSERT INTO principals (id, name, created_at_ms) VALUES (?, ?, ?)', created.id, created.name, createdAtMs);
  sql.exec(
    'INSERT INTO principal_identities (provider, subject, principal_id, created_at_ms) VALUES (?, ?, ?, ?)',
    identity.provider,
    identity.subject,
    created.id,
    createdAtMs,
  );
  sql.exec(
    'INSERT INTO workspaces (id, name, daily_allowance_micros, created_at_ms) VALUES (?, ?, ?, ?)',
    workspace.id,
    workspace.name,
    workspace.dailyAllowanceMicros,
    createdAtMs,
  );
  sql.exec(
    'INSERT INTO memberships (workspace_id, principal_id, role, created_at_ms) VALUES (?, ?, ?, ?)',
    workspace.id,
    created.id,
    MembershipRole.Owner,
    createdAtMs,
  );
}

/** A sign-up makes the principal's personal workspace and its membership, which nothing removes, so one is listed. */
function workspacesOfPrincipal({
  sql,
  principalId,
}: SqlCall<PrincipalInput>): Array.NonEmptyReadonlyArray<WorkspaceRow> {
  const cursor = sql.exec(
    'SELECT workspaces.id, workspaces.name, memberships.role, workspaces.daily_allowance_micros, workspaces.created_at_ms FROM memberships JOIN workspaces ON workspaces.id = memberships.workspace_id WHERE memberships.principal_id = ? ORDER BY workspaces.created_at_ms, workspaces.rowid',
    principalId,
  );

  return decodeNonEmptyRows({ cursor, schema: WorkspaceRow });
}

/** Only a member's request reaches a workspace's mechs, so the workspace exists and a missing one is a defect. */
function dailyAllowanceMicros({ sql, workspaceId }: SqlCall<WorkspaceInput>): number {
  const cursor = sql.exec('SELECT daily_allowance_micros FROM workspaces WHERE id = ?', workspaceId);

  return decodeOne({ cursor, schema: AllowanceRow }).dailyAllowanceMicros;
}

function workspaceMembership({
  sql,
  principalId,
  workspaceId,
}: SqlCall<WorkspaceMembershipInput>): Option.Option<MembershipRole> {
  const cursor = sql.exec(
    'SELECT role FROM memberships WHERE principal_id = ? AND workspace_id = ?',
    principalId,
    workspaceId,
  );

  const membership = decodeFirst({ cursor, schema: MembershipRow });

  return Option.map(membership, ({ role }) => role);
}
