import type { SourcePublishPaths } from '@mechane/protocol';
import type { SourceChanges } from '@mechane/records';

type CaptureMatchesIntentInput = { readonly changes: SourceChanges; readonly paths: SourcePublishPaths };

/** An untrusted guest must return exactly the owner-selected path set, without duplicates. */
export function captureMatchesIntent({ changes, paths }: CaptureMatchesIntentInput): boolean {
  if (changes.length !== paths.length) {
    return false;
  }

  const remaining = new Set(paths);

  for (const change of changes) {
    if (!remaining.delete(change.path)) {
      return false;
    }
  }

  return remaining.size === 0;
}
