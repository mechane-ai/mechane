import { ExecutionAccess } from '@mechane/protocol';
import { ManagedAgentId, PrincipalId, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

const Grant = Schema.fromJsonString(ExecutionAccess);
const TARGET = { agentId: ManagedAgentId, granteePrincipalId: PrincipalId } as const;
const RENAMES = { agentId: 'agent-id', granteePrincipalId: 'grantee-principal-id' } as const;

const IDENTITY = {
  arguments: [
    { name: 'agent-id', summary: 'the Managed Agent ID from ant beta:agents list' },
    { name: 'grantee-principal-id', summary: 'the Mechane principal that starts the authorized sessions' },
  ],
  shape: CommandShape.Document,
} as const;

export const EXECUTION_ACCESS_COMMANDS = {
  'execution-access show': {
    ...IDENTITY,
    summary: 'show the installed command grant for an agent and principal',
    operations: ['listWorkspaces', 'showManagedCommandAccess'],
    flags: {},
    input: renamedWireStruct({ fields: TARGET, renames: RENAMES }),
  },
  'execution-access set': {
    ...IDENTITY,
    summary: 'set the environment variables and credential references available to installed commands',
    operations: ['listWorkspaces', 'configureManagedCommandAccess'],
    flags: {
      access: { kind: FlagKind.Text, summary: 'JSON grant with variables and workspace credential references' },
    },
    input: renamedWireStruct({ fields: { ...TARGET, access: Grant }, renames: RENAMES }),
  },
  'execution-access revoke': {
    ...IDENTITY,
    summary: 'revoke the installed command grant for this agent and principal',
    operations: ['listWorkspaces', 'configureManagedCommandAccess'],
    flags: {},
    input: renamedWireStruct({ fields: TARGET, renames: RENAMES }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
