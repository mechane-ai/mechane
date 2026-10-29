import type { SandboxArchive } from '@mechane/protocol';
import type { FileHandle } from 'node:fs/promises';

/** An open source file paired with the checksum every imported part must reconstruct. */
export type ImportArchive = { readonly handle: FileHandle; readonly archive: SandboxArchive };
