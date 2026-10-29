import { dirname, relative } from 'node:path';

/** A file that imports and a file it imports, both relative to one folder. */
type RelativeSpecifierInput = { readonly importer: string; readonly target: string };

/** The specifier from the importer's folder to the target, which starts with `./` or `../` as a relative one must. */
export function relativeSpecifier({ importer, target }: RelativeSpecifierInput): string {
  const path = relative(dirname(importer), target);

  if (path.startsWith('../')) {
    return path;
  }

  return `./${path}`;
}
