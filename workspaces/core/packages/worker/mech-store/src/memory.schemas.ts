import { renamedWireStruct, TurnId } from '@mechane/records';
import { Schema } from 'effect';

/** The digest a memory tool task's change recorded. */
export const RecordedChangeRow = Schema.Struct({
  /** Absent for a deletion, which leaves no text to digest. */
  digest: Schema.OptionFromNullOr(Schema.String),
});

export type RecordedChangeRow = typeof RecordedChangeRow.Type;

/** A saved memory: the newest saved change of its path, and the turn that saved it, and when. */
export const SavedMemoryRow = renamedWireStruct({
  fields: {
    path: Schema.String,
    text: Schema.String,
    digest: Schema.String,
    version: Schema.Int,
    turnId: TurnId,
    savedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { savedAt: 'saved_at_ms' },
});

export type SavedMemoryRow = typeof SavedMemoryRow.Type;

/** The memory at a path as the running turn sees it, and the version it was saved under. */
export const TurnMemoryRow = Schema.Struct({
  text: Schema.String,
  digest: Schema.String,
  /** Absent while the turn's own change holds the memory, which no version saved yet. */
  version: Schema.OptionFromNullOr(Schema.Int),
});

export type TurnMemoryRow = typeof TurnMemoryRow.Type;
