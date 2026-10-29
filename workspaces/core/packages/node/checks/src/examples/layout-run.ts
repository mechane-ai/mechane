import { folderPrefixPath } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import { rootFindings } from '@mechane/owned-rules';
import { runFindings } from './run-findings.ts';
import type { ExampleIndex, RunFinding } from './types.ts';

/** How the layout rule decides on an example's tree: each member's source root over the example's files below it. */
export function layoutRun({ members, files }: ExampleIndex): ReadonlyArray<RunFinding> {
  const paths = files.map(({ path }) => path);

  /** One source root's layout findings over the example's files below it. */
  const rootRun: (root: string) => ReadonlyArray<Finding> = (root) => {
    const prefix = folderPrefixPath({ folder: root });

    return rootFindings({ root, files: paths.filter((path) => path.startsWith(prefix)) });
  };

  const findings = members.flatMap(({ sourceRoots }) => sourceRoots).flatMap(rootRun);

  return runFindings({ findings });
}
