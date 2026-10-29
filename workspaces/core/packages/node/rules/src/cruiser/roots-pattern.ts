import type { WorkspaceMember } from '../types.ts';
import { escapedPath } from './escaped-path.ts';

/** The members whose source roots the pattern matches below. */
type RootsPatternInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** A pattern of every path below the members' source roots. */
export function rootsPattern({ members }: RootsPatternInput): string {
  const rootPatterns: (member: WorkspaceMember) => ReadonlyArray<string> = ({ roots }) =>
    roots.map((root) => escapedPath({ path: root }));

  return `^(?:${members.flatMap(rootPatterns).join('|')})/`;
}
