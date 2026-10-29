import type { Comment } from 'oxc-parser';

/** Each doc comment of a file by the offset of the code right after it, which that doc documents. */
export type AttachedDocs = ReadonlyMap<number, Comment>;
