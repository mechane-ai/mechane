/** A file to put at `path`, with its contents and mode. */
export type FileInput = { readonly path: string; readonly contents: string | Uint8Array; readonly mode: number };
