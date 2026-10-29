import { MemoryDigest, MemoryPath, MemoryText } from '@mechane/protocol';
import { Schema } from 'effect';
import { Type } from 'typebox';

/**
 * A memory's path as the model passes it, which pi checks against this TypeBox schema, the only kind its tools take. It
 * carries no bounds: each tool decodes it with the protocol's schema, which counts bytes as the store does.
 */
export const PathParameter = Type.String({
  description: 'Lowercase segments of letters, digits, ".", "_" and "-" joined by "/", such as people/scott',
});

/** The digest of the memory now at the path, as memory_read showed it. */
export const DigestParameter = Type.String({ description: 'The digest memory_read showed for the memory' });

/** A write of a text by one tool task, with the text's digest. */
export const MemoryWrite = Schema.TaggedStruct('Write', {
  taskId: Schema.Number,
  path: MemoryPath,
  text: MemoryText,
  digest: MemoryDigest,
  /** The digest of the memory the write replaces; none to create one. */
  expectedDigest: Schema.Option(MemoryDigest),
});

export type MemoryWrite = typeof MemoryWrite.Type;

/** A deletion by one tool task of the memory that has the expected digest. */
export const MemoryDeletion = Schema.TaggedStruct('Delete', {
  taskId: Schema.Number,
  path: MemoryPath,
  expectedDigest: MemoryDigest,
});

export type MemoryDeletion = typeof MemoryDeletion.Type;

/** A change of the running turn's memory. */
export const MemoryChange = Schema.Union([MemoryWrite, MemoryDeletion]);

export type MemoryChange = typeof MemoryChange.Type;

/** What a change found: recorded, now or by an earlier attempt of its task, or refused, which records nothing. */
export const MemoryChangeOutcome = Schema.TaggedUnion({
  /** A write recorded, with the digest of its text. */
  Saved: { digest: MemoryDigest },
  /** A deletion recorded. */
  Deleted: {},
  /** A create at a path that holds a memory, which it would overwrite unread. */
  Exists: {},
  /** A change that names a digest other than the current memory's. */
  Changed: {},
  /** A change of a path that holds no memory. */
  Missing: {},
  /** A create past the most memories a mech keeps. */
  Full: {},
});

export type MemoryChangeOutcome = typeof MemoryChangeOutcome.Type;
