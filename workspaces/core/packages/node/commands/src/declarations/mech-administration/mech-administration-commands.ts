import { ModelId } from '@mechane/deployment';
import { MechName, MechStatus } from '@mechane/protocol';
import { CreationRequestId, MechId, Micros, RecordText, renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { MECH_ARGUMENT } from '../constants.ts';
import { MechCommandInput } from '../schemas.ts';
import { CHANGE_RENAMES, REVISION_FLAG } from './constants.ts';
import { CHANGE_FIELDS } from './schemas.ts';

/** The source definition, destination name, and optional retry identity for a clone. */
const MechCloneInput = renamedWireStruct({
  fields: {
    mechId: MechId,
    name: MechName,
    /** Absent when the CLI should generate and print a fresh request ID before sending. */
    requestId: Schema.optionalKey(CreationRequestId),
  },
  renames: { mechId: 'mech-id', requestId: 'request-id' },
});

type MechCloneInput = typeof MechCloneInput.Type;

/** The mech and exclusive revision cursor for a page of its saved definitions. */
const MechRevisionsInput = renamedWireStruct({
  fields: {
    mechId: MechId,
    /** Absent selects revision zero so the page begins with the first saved definition. */
    after: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed('0')),
    ),
  },
  renames: { mechId: 'mech-id' },
});

type MechRevisionsInput = typeof MechRevisionsInput.Type;

/** A revision-checked definition update whose omitted fields preserve their saved values. */
const MechUpdateInput = renamedWireStruct({
  fields: {
    ...CHANGE_FIELDS,
    /** Absent when the saved display name should remain unchanged. */
    name: Schema.optionalKey(MechName),
    /** Absent when the saved model should remain unchanged. */
    model: Schema.optionalKey(ModelId),
    /** Absent preserves saved instructions; an empty string clears them. */
    instructions: Schema.optionalKey(RecordText),
    /** Absent when the saved daily spending cap should remain unchanged. */
    dailyCapMicros: Schema.optionalKey(Schema.NumberFromString.pipe(Schema.decodeTo(Micros))),
    /** Absent when the current lifecycle state should remain unchanged. */
    status: Schema.optionalKey(Schema.Enum(MechStatus)),
  },
  renames: { ...CHANGE_RENAMES, dailyCapMicros: 'daily-cap-micros' },
});

type MechUpdateInput = typeof MechUpdateInput.Type;

/** A display-name change guarded by the current definition revision. */
const MechRenameInput = renamedWireStruct({ fields: { ...CHANGE_FIELDS, name: MechName }, renames: CHANGE_RENAMES });

type MechRenameInput = typeof MechRenameInput.Type;

/** Commands for inspecting, changing, and copying definitions while preserving existing identities and history. */
export const MECH_ADMINISTRATION_COMMANDS = {
  'mech clone': {
    summary:
      'copy a definition into a fresh identity with empty history and no connection grants, bindings, or watches',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'cloneMech'],
    flags: {
      'name': { kind: FlagKind.Text, summary: 'the new mech display name' },
      'request-id': { kind: FlagKind.Text, summary: 'reuse the printed request id to retry the same clone' },
    },
    arguments: [MECH_ARGUMENT],
    input: MechCloneInput,
  },
  'mech show': {
    summary: 'show the mech definition, lifecycle, and current and active revisions',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showMech'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
  'mech update': {
    summary: 'update a definition with a revision check; running work keeps its definition until the next safe turn',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'updateMech'],
    flags: {
      ...REVISION_FLAG,
      'name': { kind: FlagKind.Text, summary: 'a new display name; the mech keeps its identity and history' },
      'model': { kind: FlagKind.Text, summary: 'one of the deployment model offers' },
      'instructions': { kind: FlagKind.Text, summary: 'the mission for future turns; an empty string clears it' },
      'daily-cap-micros': { kind: FlagKind.Text, summary: 'the daily spending cap in micro-dollars' },
      'status': { kind: FlagKind.Text, summary: 'active, paused, or archived' },
    },
    arguments: [MECH_ARGUMENT],
    input: MechUpdateInput,
  },
  'mech rename': {
    summary: 'rename a mech without changing its identity, history, or connections',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'updateMech'],
    flags: { ...REVISION_FLAG, name: { kind: FlagKind.Text, summary: 'the new display name' } },
    arguments: [MECH_ARGUMENT],
    input: MechRenameInput,
  },
  'mech revisions': {
    summary: 'list a page of definition revisions with who changed each one and when',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listMechRevisions'],
    flags: { after: { kind: FlagKind.Text, summary: 'list revisions after this number; 0 when absent' } },
    arguments: [MECH_ARGUMENT],
    input: MechRevisionsInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
