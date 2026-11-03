import { Record } from 'effect';
import { posix } from 'node:path';
import type { WorkspaceMember } from '../types.ts';
import { escapedPath } from './escaped-path.ts';

/** The members whose entry points the pattern matches. */
type EntriesPatternInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/** Only exact manifest targets are public; an allowed package never opens its whole source folder. */
export function entriesPattern({ members }: EntriesPatternInput): string {
  const entryPatterns: (member: WorkspaceMember) => ReadonlyArray<string> = ({ folder, exports }) =>
    Record.values(exports).map((entry) => escapedPath({ path: posix.join(folder, entry) }));

  return `^(?:${members.flatMap(entryPatterns).join('|')})$`;
}
