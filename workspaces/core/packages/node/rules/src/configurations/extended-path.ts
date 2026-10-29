import { posix } from 'node:path';

/** The folder of a generated configuration, relative to the workspace, and the configuration it extends. */
type ExtendedPathInput = { readonly folder: string; readonly program: string };

/** The path from a configuration's folder to the one it extends, as `extends` writes it: from `./` or `../`. */
export function extendedPath({ folder, program }: ExtendedPathInput): string {
  const path = posix.relative(folder, program);

  if (path.startsWith('.')) {
    return path;
  }

  return `./${path}`;
}
