import type { FileDigest } from '../types.ts';

/** The archive checksum and the single image descriptor that an installation must verify. */
export type GuestImage = FileDigest & { readonly digest: string };

/** Public source selected for one root-level module entry. */
export type ModuleSourceFile = { readonly name: string; readonly path: string };
