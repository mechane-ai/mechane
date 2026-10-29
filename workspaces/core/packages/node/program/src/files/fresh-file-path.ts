type FreshFilePathInput = { readonly path: string };

/** The path of a fresh file beside `path`, on its filesystem, under a name no other write chose. */
export function freshFilePath({ path }: FreshFilePathInput): string {
  return `${path}.${crypto.randomUUID()}.tmp`;
}
