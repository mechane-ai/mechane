import { Option } from 'effect';
import { dirname, join } from 'node:path';

/** A file that imports, relative to the workspace, and a specifier it names. */
type ResolvedPathInput = { readonly importer: string; readonly specifier: string };

/** The workspace file a relative specifier names, relative to the workspace; none for a package's specifier. */
export function resolvedPath({ importer, specifier }: ResolvedPathInput): Option.Option<string> {
  if (!specifier.startsWith('.')) {
    return Option.none();
  }

  return Option.some(join(dirname(importer), specifier));
}
