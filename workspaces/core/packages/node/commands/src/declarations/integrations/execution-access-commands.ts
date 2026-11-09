import { ExecutionAccess } from '@mechane/protocol';
import { MechId, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { MECH_ARGUMENT } from '../constants.ts';

const AccessJson = Schema.fromJsonString(Schema.OptionFromNullOr(ExecutionAccess));

/** Execution grants expose credential references only and require live workspace ownership. */
export const EXECUTION_ACCESS_COMMANDS = {
  'execution-access show': {
    summary: 'show a mech execution grant without resolving its credentials',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showExecutionAccess'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId }, renames: { mechId: 'mech-id' } }),
  },
  'execution-access set': {
    summary: 'replace execution access for future commands; pass null to revoke',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'configureExecutionAccess'],
    flags: {
      access: {
        kind: FlagKind.Text,
        summary: 'JSON grant with environment variables and credential references; null revokes access',
      },
    },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId, access: AccessJson }, renames: { mechId: 'mech-id' } }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
