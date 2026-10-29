import type { FileEdit } from '../types.ts';

/** The key that tells one edit from another: its file and where it starts. */
export function editKey({ path, edit }: FileEdit): string {
  return `${path}:${edit.range.start.line}:${edit.range.start.character}`;
}
