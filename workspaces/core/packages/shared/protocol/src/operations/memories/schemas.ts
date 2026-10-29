import { boundedText, RecordName, RecordText, SHA256_PATTERN, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { MEMORY_PATH_MAX_CHARS, MEMORY_PATH_PATTERN, MEMORY_TEXT_MAX_BYTES } from './constants.ts';

/** Where a mech keeps a memory, such as `people/scott`. */
export const MemoryPath = Schema.String.check(
  Schema.isMaxLength(MEMORY_PATH_MAX_CHARS),
  Schema.isPattern(MEMORY_PATH_PATTERN),
);

export type MemoryPath = typeof MemoryPath.Type;

/** What a memory says, whose first line summarizes it. */
export const MemoryText = boundedText({ maxBytes: MEMORY_TEXT_MAX_BYTES });

export type MemoryText = typeof MemoryText.Type;

/** The SHA-256 of a memory's text in lowercase hex, which a change names to replace or delete that memory. */
export const MemoryDigest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));

export type MemoryDigest = typeof MemoryDigest.Type;

/** A saved change's place in its mech's memory, dense from 1 in the order the mech's turns saved them. */
const MemoryVersion = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** A saved memory: its path, text and digest, and the version and turn that saved it, and when. */
export const Memory = wireStruct({
  fields: {
    path: RecordName,
    text: RecordText,
    digest: MemoryDigest,
    version: MemoryVersion,
    turnId: TurnId,
    savedAt: WireTime,
  },
});

export type Memory = typeof Memory.Type;

/** A mech's saved memories, by path. */
export const MemoryList = Schema.Struct({ memories: Schema.Array(Memory) });

export type MemoryList = typeof MemoryList.Type;
