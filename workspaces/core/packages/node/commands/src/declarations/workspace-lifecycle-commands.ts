import { DroneId, RecordId, renamedWireStruct, SandboxOperationId } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const MechIdentifier = RecordId.pipe(Schema.brand('MechIdentifier'));
const DELETE_CONFIRMED = Schema.Literal(true);

const TARGET_FIELDS = { mechId: MechIdentifier, droneId: Schema.optionalKey(DroneId) } as const;
const TARGET_RENAMES = { mechId: 'mech-id', droneId: 'drone' } as const;
const CHANGE_FIELDS = { ...TARGET_FIELDS, operationId: Schema.optionalKey(SandboxOperationId) } as const;
const CHANGE_RENAMES = { ...TARGET_RENAMES, operationId: 'operation-id' } as const;

const TARGET_FLAGS = {
  drone: { kind: FlagKind.Text, summary: 'manage this finished drone instead of the mech' },
} as const;

const CHANGE_FLAGS = {
  ...TARGET_FLAGS,
  'operation-id': { kind: FlagKind.Text, summary: 'resume the operation id printed by an earlier attempt' },
} as const;

const WORKSPACE_LIFECYCLE_COMMAND = {
  shape: CommandShape.Document,
  operations: ['listWorkspaces', 'manageSandbox'],
  arguments: [MECH_ARGUMENT],
} as const;

/** Workspace files survive idle suspension and finished drones; deletion is always explicit. */
export const WORKSPACE_LIFECYCLE_COMMANDS = {
  'sandbox show': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'show the sandbox image, provider state and any pending maintenance without waking it',
    flags: TARGET_FLAGS,
    input: renamedWireStruct({ fields: TARGET_FIELDS, renames: TARGET_RENAMES }),
  },
  'sandbox upgrade': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'replace an idle sandbox with the deployed image, preserving /home/node and verifying its archive first',
    flags: CHANGE_FLAGS,
    input: renamedWireStruct({ fields: CHANGE_FIELDS, renames: CHANGE_RENAMES }),
  },
  'sandbox export': {
    ...WORKSPACE_LIFECYCLE_COMMAND,
    summary: 'save an idle sandbox home directory as a verified private tar.gz archive',
    flags: {
      ...CHANGE_FLAGS,
      file: { kind: FlagKind.Text, summary: 'the new archive file to create; existing files are never overwritten' },
    },
    input: renamedWireStruct({ fields: { ...CHANGE_FIELDS, file: Schema.NonEmptyString }, renames: CHANGE_RENAMES }),
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
    summary: 'cancel maintenance before its binding swap, or finish retiring the old VM after that swap',
    flags: {
      ...TARGET_FLAGS,
      'operation-id': { kind: FlagKind.Text, summary: 'the pending operation id shown by sandbox show' },
    },
    input: renamedWireStruct({
      fields: { ...TARGET_FIELDS, operationId: SandboxOperationId },
      renames: CHANGE_RENAMES,
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
