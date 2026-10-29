import { SOURCE_ROOT_PATH } from './source.constants.ts';
import type { SourcePathPrefix } from './source.schemas.ts';

type SourcePathAllowedInput = { readonly path: string; readonly prefixes: ReadonlyArray<SourcePathPrefix> };
const PATH_SEPARATOR = '/';

/** A prefix grants its exact path and descendants, with a separate explicit repository root grant. */
export function sourcePathAllowed({ path, prefixes }: SourcePathAllowedInput): boolean {
  const includesPath: (prefix: SourcePathPrefix) => boolean = (prefix) => {
    if (prefix === SOURCE_ROOT_PATH || path === prefix) {
      return true;
    }

    if (!path.startsWith(prefix)) {
      return false;
    }

    return path.charAt(prefix.length) === PATH_SEPARATOR;
  };

  return prefixes.some(includesPath);
}
