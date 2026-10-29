import type { NameUse } from '../types.ts';

/** A use and the key of the declaration it takes. */
export type KeyedUse = { readonly key: string; readonly use: NameUse };
