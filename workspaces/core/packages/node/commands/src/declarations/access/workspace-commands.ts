import { MembershipRole, NoFields } from '@mechane/protocol';
import { PrincipalId, RecordName, renamedWireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

const PRINCIPAL_ARGUMENT = {
  name: 'principal-id',
  summary: 'the principal UUID printed by mechane auth status',
} as const;

const OptionalWorkspaceId = Schema.optionalKey(WorkspaceId);
const MemberRole = Schema.Enum(MembershipRole);

/** Shared-workspace administration targets existing principals with explicit roles. */
export const WORKSPACE_COMMANDS = {
  'workspace create': {
    summary: 'create a shared workspace as an installation administrator',
    shape: CommandShape.Document,
    operations: ['createWorkspace'],
    flags: {
      'name': { kind: FlagKind.Text, summary: 'the shared workspace name' },
      'workspace-id': { kind: FlagKind.Text, summary: 'reuse the printed workspace UUID to retry the same creation' },
    },
    arguments: [],
    input: renamedWireStruct({
      fields: {
        /** Absent generates a new UUID that the CLI prints before sending. */
        id: OptionalWorkspaceId,
        name: RecordName,
      },
      renames: { id: 'workspace-id' },
    }),
  },
  'workspace list': {
    summary: 'list the workspaces you belong to, with your role and each daily model allowance',
    shape: CommandShape.Document,
    operations: ['listWorkspaces'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'workspace members': {
    summary: 'list the selected workspace members as an owner',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listWorkspaceMembers'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'workspace member set': {
    summary: 'add an existing principal or change their role in a shared workspace as an owner',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'setWorkspaceMember'],
    flags: { role: { kind: FlagKind.Text, summary: 'owner or member' } },
    arguments: [PRINCIPAL_ARGUMENT],
    input: renamedWireStruct({
      fields: { principalId: PrincipalId, role: MemberRole },
      renames: { principalId: 'principal-id' },
    }),
  },
  'workspace member remove': {
    summary: 'remove a principal from a shared workspace as an owner, keeping at least one owner',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'removeWorkspaceMember'],
    flags: {},
    arguments: [PRINCIPAL_ARGUMENT],
    input: renamedWireStruct({ fields: { principalId: PrincipalId }, renames: { principalId: 'principal-id' } }),
  },
  'allowance show': {
    summary: "show your workspace's daily model allowance and what the current UTC day has committed of it",
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showAllowance'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
