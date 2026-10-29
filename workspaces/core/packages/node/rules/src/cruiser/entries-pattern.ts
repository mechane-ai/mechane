import { posix } from 'node:path';
import type { WorkspaceMember } from '../types.ts';
import { escapedPath } from './escaped-path.ts';

/** A member's entry point below its folder, the one file another member imports of it (ST-05). */
const ENTRY_POINT = 'src/index.ts';

/** The members whose entry points the pattern matches. */
type EntriesPatternInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** A pattern of the members' entry points, the one file of each that another member imports. */
export function entriesPattern({ members }: EntriesPatternInput): string {
  const entryPattern: (member: WorkspaceMember) => string = ({ folder }) =>
    escapedPath({ path: posix.join(folder, ENTRY_POINT) });

  return `^(?:${members.map(entryPattern).join('|')})$`;
}
