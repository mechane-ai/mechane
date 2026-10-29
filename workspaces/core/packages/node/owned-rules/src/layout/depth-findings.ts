import type { Finding } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';
import { relative, sep } from 'node:path';

/** A source root, and a folder below it. */
type DepthFindingsInput = { readonly root: string; readonly folder: string };

/** A folder that lies more levels below its source root than the declared depth. */
export function depthFindings({ root, folder }: DepthFindingsInput): ReadonlyArray<Finding> {
  const { folderDepth } = CONTRACTS['code-folder-size'].values;

  const depth = relative(root, folder)
    .split(sep)
    .filter((segment) => segment !== '').length;

  if (depth <= folderDepth) {
    return [];
  }

  return [
    {
      check: 'layout',
      location: folder,
      message: `Move the folder up to at most ${folderDepth} levels below ${root}, such as \`${root}/store/rows\`, since it sits ${depth} levels below`,
    },
  ];
}
