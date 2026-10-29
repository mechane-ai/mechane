import { parsedSources, WORKSPACE_FOLDER, workspaceMembers, writeChanges } from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import type { Normalizer } from '@mechane/rule-shapes';
import { gatedGlobs } from '@mechane/rules';
import { Effect } from 'effect';
import { relative } from 'node:path';
import { entryFiles } from './entry-files.ts';
import { settledChanges } from './settled-changes.ts';

/** A normalizer, and the absolute paths whose files it rewrites, every file when they are none. */
type NormalizeInput = { readonly normalizer: Normalizer; readonly paths: ReadonlyArray<string> };

/**
 * Runs one normalizer over the files under `paths`, or every file when they are none, until it settles, and writes what
 * it changes. It leaves the files its behavior leaves to the live release verification.
 */
export const normalize = Effect.fn('normalize')(function* ({
  normalizer,
  paths,
}: NormalizeInput): Effect.fn.Return<void, ChecksFailure> {
  const members = yield* workspaceMembers();

  const changes = yield* settledChanges({
    normalizer,
    sources: yield* parsedSources({ members }),
    entries: yield* entryFiles({ members }),
    roots: members.flatMap(({ sourceRoots }) => sourceRoots),
    scope: { paths: paths.map((path) => relative(WORKSPACE_FOLDER, path)), excluded: gatedGlobs({ rule: normalizer }) },
  });

  return yield* writeChanges({ changes });
});
