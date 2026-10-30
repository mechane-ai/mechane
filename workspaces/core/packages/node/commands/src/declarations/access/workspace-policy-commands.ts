import { Micros, renamedWireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { OptionalSwitch } from '../switch.schemas.ts';

const WorkspacePolicyTarget = renamedWireStruct({
  fields: { workspaceId: WorkspaceId },
  renames: { workspaceId: 'workspace-id' },
});

type WorkspacePolicyTarget = typeof WorkspacePolicyTarget.Type;

const WorkspacePolicyChange = renamedWireStruct({
  fields: {
    workspaceId: WorkspaceId,
    isSuspended: Schema.fromJsonString(Schema.Boolean),
    hasSandboxes: Schema.fromJsonString(Schema.Boolean),
    machines: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
    dailyAllowanceMicros: Schema.NumberFromString.pipe(Schema.decodeTo(Micros)),
    isCreateOnly: OptionalSwitch,
  },
  renames: {
    workspaceId: 'workspace-id',
    isSuspended: 'suspended',
    hasSandboxes: 'sandboxes',
    dailyAllowanceMicros: 'daily-allowance-micros',
    isCreateOnly: 'create-only',
  },
});

type WorkspacePolicyChange = typeof WorkspacePolicyChange.Type;

const WORKSPACE_ARGUMENT = { name: 'workspace-id', summary: 'the workspace UUID to administer' } as const;

/** Installation administrators target workspaces explicitly, including those suspended from ordinary member access. */
export const WORKSPACE_POLICY_COMMANDS = {
  'workspace policy show': {
    summary: 'show effective workspace policy as an installation administrator',
    shape: CommandShape.Document,
    operations: ['showWorkspacePolicy'],
    flags: {},
    arguments: [WORKSPACE_ARGUMENT],
    input: WorkspacePolicyTarget,
  },
  'workspace policy set': {
    summary: 'replace workspace policy immediately, within installation limits',
    shape: CommandShape.Document,
    operations: ['setWorkspacePolicy'],
    flags: {
      'suspended': {
        kind: FlagKind.Text,
        summary: 'true refuses ordinary access and queued work; false resumes access',
      },
      'sandboxes': { kind: FlagKind.Text, summary: 'true permits sandbox machines when the installation enables them' },
      'machines': { kind: FlagKind.Text, summary: 'the maximum number of concurrent machines for this workspace' },
      'daily-allowance-micros': { kind: FlagKind.Text, summary: 'the workspace daily model budget in micro-dollars' },
      'create-only': { kind: FlagKind.Switch, summary: 'refuse to replace an existing policy during an import' },
    },
    arguments: [WORKSPACE_ARGUMENT],
    input: WorkspacePolicyChange,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
