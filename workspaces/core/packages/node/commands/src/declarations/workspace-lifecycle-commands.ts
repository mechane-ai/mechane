import { MachineId, RecordId, renamedWireStruct, SandboxOperationId } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const MechIdentifier = RecordId.pipe(Schema.brand('MechIdentifier'));
const DELETE_CONFIRMED = Schema.Literal(true);
const TARGET_FIELDS = { mechId: MechIdentifier } as const;
const TARGET_RENAMES = { mechId: 'mech-id' } as const;
const CHANGE_FIELDS = { ...TARGET_FIELDS, operationId: Schema.optionalKey(SandboxOperationId) } as const;
const CHANGE_RENAMES = { ...TARGET_RENAMES, operationId: 'operation-id' } as const;

const CHANGE_FLAGS = {
  'operation-id': { kind: FlagKind.Text, summary: 'resume the operation id printed by an earlier attempt' },
} as const;

const WORKSPACE_LIFECYCLE_COMMAND = {
  shape: CommandShape.Document,
  operations: ['listWorkspaces', 'manageSandbox'],
  arguments: [MECH_ARGUMENT],
} as const;

/** Sandbox maintenance retains a stable retry identity across interrupted calls. */
export const WORKSPACE_LIFECYCLE_COMMANDS = {
  'sandbox show': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'show the sandbox image, provider state and any pending maintenance without waking it',
    flags: {},
    input: renamedWireStruct({ fields: TARGET_FIELDS, renames: TARGET_RENAMES }),
  },
  'sandbox upgrade': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'replace an idle sandbox with the deployed image, preserving its files',
    flags: CHANGE_FLAGS,
    input: renamedWireStruct({ fields: CHANGE_FIELDS, renames: CHANGE_RENAMES }),
  },
  'sandbox restore': {
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'restoreSandbox'],
    arguments: [MECH_ARGUMENT],
    summary: 'restore the last saved files after confirmed machine loss; unsaved files are not captured',
    flags: {
      'operation-id': { kind: FlagKind.Text, summary: 'one required UUID retained across every retry' },
      'machine-id': { kind: FlagKind.Text, summary: 'the lost machine id in the observed recovery state' },
      'recovery-generation': { kind: FlagKind.Text, summary: 'the exact observed failed generation' },
      'committed-generation': { kind: FlagKind.Text, summary: 'the exact last saved generation to restore' },
    },
    input: renamedWireStruct({
      fields: {
        ...TARGET_FIELDS,
        operationId: SandboxOperationId,
        machineId: MachineId,
        recoveryGeneration: RecordId,
        committedGeneration: RecordId,
      },
      renames: {
        ...TARGET_RENAMES,
        operationId: 'operation-id',
        machineId: 'machine-id',
        recoveryGeneration: 'recovery-generation',
        committedGeneration: 'committed-generation',
      },
    }),
  },
  'sandbox delete': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'permanently delete sandbox files; the next command starts an empty workspace',
    flags: {
      ...CHANGE_FLAGS,
      confirm: { kind: FlagKind.Switch, summary: 'confirm permanent deletion of this sandbox and its files' },
    },
    input: renamedWireStruct({
      fields: { ...CHANGE_FIELDS, isConfirmed: DELETE_CONFIRMED },
      renames: { ...CHANGE_RENAMES, isConfirmed: 'confirm' },
    }),
  },
  'sandbox cancel': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'cancel the pending sandbox maintenance operation',
    flags: { 'operation-id': { kind: FlagKind.Text, summary: 'the pending operation id shown by sandbox show' } },
    input: renamedWireStruct({
      fields: { ...TARGET_FIELDS, operationId: SandboxOperationId },
      renames: CHANGE_RENAMES,
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
