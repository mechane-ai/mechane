import type { Finding } from '@mechane/checks-kernel';
import { dirname, extname, join, relative, sep } from 'node:path';
import { countFindings } from './count-findings.ts';
import { depthFindings } from './depth-findings.ts';
import { siblingFindings } from './sibling-findings.ts';

type FolderInput = { readonly root: string; readonly files: ReadonlyArray<string> };

type AncestorsInput = { readonly root: string; readonly file: string };

/**
 * The layout findings of one source root's files. A folder may lie too deep or hold too many files of one extension,
 * role and fixed files aside, and a file may be named after a folder beside it.
 */
export function rootFindings({ root, files }: FolderInput): ReadonlyArray<Finding> {
  /** Whether the path names a file, which has an extension, rather than a folder. */
  const hasExtension: (file: string) => boolean = (file) => extname(file) !== '';
  const sourceFiles = files.filter(hasExtension);
  const byFolder = Map.groupBy(sourceFiles, (file) => dirname(file));
  const folders = new Set(sourceFiles.flatMap((file) => ancestors({ root, file })));

  /** The findings of one folder and the files it holds directly. */
  const folderFindings: (group: readonly [string, ReadonlyArray<string>]) => ReadonlyArray<Finding> = ([
    folder,
    members,
  ]) => [
    ...depthFindings({ root, folder }),
    ...countFindings({ folder, members }),
    ...siblingFindings({ members, folders }),
  ];

  return [...byFolder].flatMap(folderFindings);
}

/** Every folder between the source root and the file, the file's own folder included. */
function ancestors({ root, file }: AncestorsInput): ReadonlyArray<string> {
  const segments = relative(root, dirname(file))
    .split(sep)
    .filter((segment) => segment !== '');

  /** The folder of the segments up to and including the one at `index`. */
  const ancestor: (segment: string, index: number) => string = (_, index) =>
    join(root, ...segments.slice(0, index + 1));

  return segments.map(ancestor);
}
