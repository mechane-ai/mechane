import type { Finding } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import { CONTRACTS } from '@mechane/rules';
import { basename, extname } from 'node:path';
import { isBehaviorStem } from './is-behavior-stem.ts';

/** A folder, and the files it holds directly. */
type CountFindingsInput = { readonly folder: string; readonly members: ReadonlyArray<string> };

/** The files of one extension a folder holds, a TypeScript role or fixed file aside (ST-15), past the limit. */
export function countFindings({ folder, members }: CountFindingsInput): ReadonlyArray<Finding> {
  const { folderFiles } = CONTRACTS['code-folder-size'].values;

  /** Whether the file counts toward the limit: any file but a TypeScript role or fixed file. */
  const isCounted: (file: string) => boolean = (file) =>
    extname(file) !== TYPESCRIPT_EXTENSION || isBehaviorStem({ stem: basename(file, TYPESCRIPT_EXTENSION) });

  const byExtension = Map.groupBy(members.filter(isCounted), (file) => extname(file));

  /** The finding of a folder past the limit for one extension. */
  const countFinding: (group: readonly [string, ReadonlyArray<string>]) => Finding = ([extension, files]) => ({
    check: 'layout',
    location: folder,
    message: `Split the folder's ${files.length} ${extension} files, role and fixed files aside, into subfolders of at most ${folderFiles}, such as \`${folder}/rows/\``,
  });

  return [...byExtension].filter(([, files]) => files.length > folderFiles).map(countFinding);
}
