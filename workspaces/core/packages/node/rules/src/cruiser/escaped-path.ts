/** A path relative to the workspace, or a package's name. */
type EscapedPathInput = { readonly path: string };

/**
 * A path as a pattern that matches it alone. A dot is the one character of a package's name or folder that a pattern
 * reads as syntax, as npm names allow no other.
 */
export function escapedPath({ path }: EscapedPathInput): string {
  return path.replaceAll('.', '[.]');
}
