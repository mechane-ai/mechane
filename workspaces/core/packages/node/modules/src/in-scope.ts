import { matchesGlob, sep } from 'node:path';
import type { NormalizerScope } from './types.ts';

/** A file relative to the workspace, and the files a normalizer rewrites. */
type InScopeInput = { readonly path: string; readonly scope: NormalizerScope };

/**
 * Whether a normalizer rewrites what the file holds: it lies under one of the scope's paths, or the paths are none, and
 * no excluded glob matches it.
 */
export function inScope({ path, scope }: InScopeInput): boolean {
  /** Whether the file is the path or lies below it. */
  const isBelow: (prefix: string) => boolean = (prefix) => path === prefix || path.startsWith(`${prefix}${sep}`);
  const isUnder = scope.paths.length === 0 || scope.paths.some(isBelow);

  return isUnder && !scope.excluded.some((glob) => matchesGlob(path, glob));
}
