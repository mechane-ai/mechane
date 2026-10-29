import type { CheckInput, Finding, InputUnreadable } from '@mechane/checks-kernel';
import { listFiles } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { fileNameFindings } from './file-name-findings.ts';
import { rootFindings } from './root-findings.ts';

type ListedRootFindingsInput = { readonly root: string };

/** The layout findings of one source root, over every file listed below it. */
const listedRootFindings = Effect.fn('listedRootFindings')(function* ({
  root,
}: ListedRootFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const files = yield* listFiles({ folder: root, extension: '' });

  return rootFindings({ root, files });
});

/**
 * Checks each folder below a source root: the files of one extension it holds directly, and its depth below the root.
 * No file is named after a sibling folder, and each behavior file is named for an export.
 */
export const checkLayout = Effect.fn('checkLayout')(function* ({
  members,
  sources,
}: CheckInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const roots = members.flatMap((member) => member.sourceRoots);
  const groups = yield* Effect.forEach(roots, (root) => listedRootFindings({ root }), { concurrency: 1 });

  return [...groups.flat(), ...fileNameFindings({ sources })];
});
