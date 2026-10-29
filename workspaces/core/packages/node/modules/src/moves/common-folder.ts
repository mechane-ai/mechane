import { Array } from 'effect';
import { dirname, sep } from 'node:path';

type CommonFolderInput = { readonly paths: ReadonlyArray<string> };

/** One folder's segments, and every other folder's. */
type SharedSegmentsInput = {
  readonly first: ReadonlyArray<string>;
  readonly rest: ReadonlyArray<ReadonlyArray<string>>;
};

/** The deepest folder that holds every path. */
export function commonFolder({ paths }: CommonFolderInput): string {
  /** The segments of the folder that holds the path. */
  const folderSegments: (path: string) => ReadonlyArray<string> = (path) => dirname(path).split(sep);
  const folders = paths.map(folderSegments);

  if (!Array.isReadonlyArrayNonEmpty(folders)) {
    return '';
  }

  const [first, ...rest] = folders;

  return sharedSegments({ first, rest }).join(sep);
}

/** The leading segments of the first folder that every other folder shares. */
function sharedSegments({ first, rest }: SharedSegmentsInput): ReadonlyArray<string> {
  /** Whether every other folder has the segment at the same depth. */
  const isShared: (segment: string, depth: number) => boolean = (segment, depth) =>
    rest.every((other) => other[depth] === segment);

  return Array.takeWhile(first, isShared);
}
