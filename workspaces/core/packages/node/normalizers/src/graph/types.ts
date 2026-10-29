import type { Move } from '@mechane/modules';

/** Each file's path, and the paths of the files it imports. */
export type FileGraph = ReadonlyMap<string, ReadonlySet<string>>;

/** The file graph with the imports of the moves accepted so far, and those moves in order. */
export type AcyclicState = { readonly graph: FileGraph; readonly accepted: ReadonlyArray<Move> };
