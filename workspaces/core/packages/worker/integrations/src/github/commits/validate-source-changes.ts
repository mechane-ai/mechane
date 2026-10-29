import type { SourceGrant } from '@mechane/protocol';
import { Bytes } from '@mechane/records';
import type { SourceChanges } from '@mechane/records';
import { Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import type { GitHubTree, GitHubTreeEntry } from './schemas.ts';
import type { SourceValidation } from './types.ts';
import { validateSourceChange } from './validate-source-change.ts';

type ValidateSourceChangesInput = {
  readonly grant: SourceGrant;
  readonly changes: SourceChanges;
  readonly tree: GitHubTree;
};

/** Validates the complete patch before any blob or commit is created at GitHub. */
export function validateSourceChanges({
  grant,
  changes,
  tree,
}: ValidateSourceChangesInput): Result.Result<void, GitHubFailed> {
  const entryPair: (entry: GitHubTreeEntry) => [string, GitHubTreeEntry] = (entry) => [entry.path, entry];
  const entries = tree.tree.map(entryPair);
  const known = new Map(entries);
  const totalBytes = Bytes.make(0);
  const initial: SourceValidation = { seen: new Set(), totalBytes };
  const state = { validation: initial };

  for (const change of changes) {
    const next = validateSourceChange({ grant, change, known, validation: state.validation });

    if (Result.isFailure(next)) {
      return Result.fail(next.failure);
    }

    state.validation = next.success;
  }

  return Result.succeed(undefined);
}
