import type { Comment } from 'oxc-parser';

/** Each doc comment of a file by the offset of the code right after it, which that doc documents. */
export type AttachedDocs = ReadonlyMap<number, Comment>;

/** Each supported interface's declaring file and names, followed through named re-exports. */
export type DocumentedExports = ReadonlyMap<string, ReadonlySet<string>>;
