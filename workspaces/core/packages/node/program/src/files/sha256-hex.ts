import { createHash } from 'node:crypto';

/** A text, which counts as its UTF-8 bytes, or bytes. */
type ContentsInput = { readonly contents: string | Uint8Array };

/** The SHA-256 digest of the contents, a text as UTF-8 or bytes, as lowercase hex. */
export function sha256Hex({ contents }: ContentsInput): string {
  return createHash('sha256').update(contents).digest('hex');
}
