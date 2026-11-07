import { RecordName, RecordText, SHA256_PATTERN, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';

/** The SHA-256 of a memory's text in lowercase hex, which a change names to replace or delete that memory. */
const MemoryDigest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));

/** A memory version advances with each committed change. */
const MemoryVersion = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** A saved memory records its version and the run that wrote it when that provenance is available. */
export const Memory = wireStruct({
  fields: {
    path: RecordName,
    text: RecordText,
    digest: MemoryDigest,
    version: MemoryVersion,
    /** None means no authoring run is retained for this memory version. */
    turnId: Schema.OptionFromNullOr(TurnId),
    savedAt: WireTime,
  },
});

export type Memory = typeof Memory.Type;

/** A mech's saved memories, by path. */
export const MemoryList = Schema.Struct({ memories: Schema.Array(Memory) });

export type MemoryList = typeof MemoryList.Type;
