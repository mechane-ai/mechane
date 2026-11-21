import { randomBytes } from 'node:crypto';

const FRESH_SUFFIX_BYTES = 16;

type FreshFilePathInput = { readonly path: string };

/** The path of a fresh file beside `path`, on its filesystem, under a name no other write chose. */
export function freshFilePath({ path }: FreshFilePathInput): string {
  return `${path}.${randomBytes(FRESH_SUFFIX_BYTES).toString('hex')}.tmp`;
}
