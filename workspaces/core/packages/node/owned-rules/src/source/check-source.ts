import { folderPrefixPath } from '@mechane/checks-kernel';
import type { Finding } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { CONTRACTS } from '@mechane/rules';
import { commentWidthFindings } from './comment-width-findings.ts';
import { patternFindings } from './pattern-findings.ts';

/** Each TypeScript file of the source roots, parsed. */
type CheckSourceInput = { readonly sources: ReadonlyArray<ParsedSource> };

type TestFileInput = { readonly path: string };

/** Checks comment widths in every TypeScript file of the source roots, and patterns outside tests. */
export function checkSource({ sources }: CheckSourceInput): ReadonlyArray<Finding> {
  /** Whether the file is production source, outside every test root. */
  const isProduction: (source: ParsedSource) => boolean = ({ path }) => !isTestFile({ path });

  return [
    ...sources.flatMap((file) => commentWidthFindings({ file })),
    ...patternFindings({ files: sources.filter(isProduction) }),
  ];
}

/** Tests may repeat a pattern that production declares once. */
function isTestFile({ path }: TestFileInput): boolean {
  /** Whether the file sits below the test root. */
  const isBelow: (root: string) => boolean = (root) => path.startsWith(folderPrefixPath({ folder: root }));

  return CONTRACTS['code-shared-definitions'].values.testRoots.some(isBelow);
}
