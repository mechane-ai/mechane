import { ModelId } from '@mechane/deployment';
import {
  isWellFormedText,
  Micros,
  PAGE_RENAMES,
  PrincipalId,
  RecordId,
  RecordName,
  RecordText,
  renamedWireStruct,
  Sequence,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { INSTRUCTIONS_MAX_CHARS, MechStatus, NativeTool } from './constants.ts';

/** What a mech is told to be and do, which its conversation renders after every other section of its prompt. */
export const Instructions = Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, INSTRUCTIONS_MAX_CHARS));

export type Instructions = typeof Instructions.Type;

/** A positive revision number that identifies an immutable saved definition. */
const DefinitionRevision = Schema.Int.check(Schema.isGreaterThan(0));

/** Names a runtime-owned tool that a definition may expose independently of its MCP grants. */
export const NativeToolName = Schema.Enum(NativeTool);

export type NativeToolName = typeof NativeToolName.Type;

/** Selects native model tools; an empty selection exposes none. */
const NativeTools = Schema.Array(NativeToolName);

/**
 * Where a forked mech's life left its parent's: the parent, and the sequence of the parent's last event at the fork, 0
 * when it had none. The fork holds the parent's events up to that one, and none after.
 */
export const ForkPoint = wireStruct({ fields: { mechId: RecordId, sequence: Sequence } });

export type ForkPoint = typeof ForkPoint.Type;

const MECH_SUMMARY_FIELDS = {
  id: RecordId,
  name: RecordName,
  model: ModelId,
  revision: DefinitionRevision,
  status: Schema.Enum(MechStatus),
  creatorId: RecordId,
  createdAt: WireTime,
  /** Native definitions created independently have no source point. */
  forkedFrom: Schema.OptionFromNullOr(ForkPoint),
} as const;

/** A mech as its workspace lists it. */
export const MechSummary = wireStruct({ fields: MECH_SUMMARY_FIELDS });

export type MechSummary = typeof MechSummary.Type;

/** A mech: who created it, when, the mech it was forked from, the model and instructions it runs with, and its cap. */
export const Mech = wireStruct({
  fields: {
    ...MECH_SUMMARY_FIELDS,
    /** None for a mech created without instructions, which the wire sends as null. */
    instructions: Schema.OptionFromNullOr(RecordText),
    /** Absent in older responses; None selects the standard native tools. */
    nativeTools: Schema.optional(Schema.OptionFromNullOr(NativeTools)),
    dailyCapMicros: Micros,
    /** None while the actor has not installed its first definition. */
    activeRevision: Schema.OptionFromNullOr(DefinitionRevision),
    updatedAt: WireTime,
    updaterId: PrincipalId,
  },
});

export type Mech = typeof Mech.Type;

/** One saved definition and the actor and time of its change. */
const MechRevision = wireStruct({
  fields: {
    revision: DefinitionRevision,
    name: RecordName,
    model: ModelId,
    /** Absent when this revision gives the mech no additional instructions. */
    instructions: Schema.OptionFromNullOr(RecordText),
    /** Absent in older responses; None selects the standard native tools for this revision. */
    nativeTools: Schema.optional(Schema.OptionFromNullOr(NativeTools)),
    dailyCapMicros: Micros,
    status: Schema.Enum(MechStatus),
    updatedAt: WireTime,
    updaterId: PrincipalId,
  },
});

/** A page of saved definitions in revision order, with whether more follow it. */
export const MechRevisionPage = renamedWireStruct({
  fields: { revisions: Schema.Array(MechRevision), hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type MechRevisionPage = typeof MechRevisionPage.Type;

/** A workspace's mechs, oldest first. */
export const MechList = Schema.Struct({ mechs: Schema.Array(MechSummary) });

export type MechList = typeof MechList.Type;

/** One page of a workspace's mechs, oldest first, and whether more follow it. */
export const MechPage = renamedWireStruct({
  fields: { ...MechList.fields, hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type MechPage = typeof MechPage.Type;
