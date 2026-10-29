import { folderPrefixPath } from '@mechane/checks-kernel';
import type { CheckInput, Finding } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';

/** What the orphan check reads: the members, for the roots their compiler configurations include, and the files. */
type OrphanFindingsInput = Pick<CheckInput, 'members' | 'files'>;

/** What an orphan's finding asks for. */
const ORPHAN_MESSAGE =
  "Move the file into the member it belongs to, such as `packages/node/cli/src/`, since it lies outside every member's tsconfig include";

/**
 * Finds each TypeScript file outside every folder or file a member's compiler configuration includes, which no program
 * type-checks. One example is a branch's file that a merge left at a path a move emptied.
 */
export function orphanFindings({ members, files }: OrphanFindingsInput): ReadonlyArray<Finding> {
  const roots = members.flatMap((member) => member.includedRoots);

  /** Whether the file is TypeScript outside every root a member's configuration includes. */
  const isOrphan: (file: string) => boolean = (file) => {
    const isBelow: (root: string) => boolean = (root) =>
      file === root || file.startsWith(folderPrefixPath({ folder: root }));

    return file.endsWith(TYPESCRIPT_EXTENSION) && !roots.some(isBelow);
  };

  return files.filter(isOrphan).map((file) => ({ check: 'orphans', location: file, message: ORPHAN_MESSAGE }));
}
