import type { Bytes, SourceChanges } from '@mechane/records';

/** The bounded prefix read so far, retained only during one capture. */
export type SourcePatch = { readonly changes: SourceChanges; readonly bytes: Bytes };
