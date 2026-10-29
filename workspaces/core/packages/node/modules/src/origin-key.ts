/** A declaration's file, relative to the workspace, and its name. */
type OriginKeyInput = { readonly path: string; readonly name: string };

/** The key of a declaration by its file and name, which tells its uses from every other's. */
export function originKey({ path, name }: OriginKeyInput): string {
  return `${path}#${name}`;
}
