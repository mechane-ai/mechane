import type { Finding } from '@mechane/checks-kernel';
import { basename, dirname, extname, join } from 'node:path';

/** A folder's files, and every folder below the source root. */
type SiblingFindingsInput = { readonly members: ReadonlyArray<string>; readonly folders: ReadonlySet<string> };

/** A file named after a folder beside it, such as `session.ts` beside `session/`, competes with that folder's entry. */
export function siblingFindings({ members, folders }: SiblingFindingsInput): ReadonlyArray<Finding> {
  /** Whether a folder beside the file has its stem. */
  const isNamedForFolder: (file: string) => boolean = (file) =>
    folders.has(join(dirname(file), basename(file, extname(file))));

  /** The finding of a file named for the folder beside it. */
  const siblingFinding: (file: string) => Finding = (file) => ({
    check: 'layout',
    location: file,
    message: `Rename the file or the folder beside it, such as \`${basename(file, extname(file))}-store${extname(file)}\``,
  });

  return members.filter(isNamedForFolder).map(siblingFinding);
}
