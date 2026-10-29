import { Bytes } from '@mechane/records';
import type { SourceChanges } from '@mechane/records';
import type { SourceCapture } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings } from '../../types.ts';
import { readSourcePatch } from './read-source-patch.ts';
import type { SourcePatch } from './types.ts';

/** The explicit path allowlist whose current contents the Worker will compare with its trusted base. */
type CaptureSourceInput = { readonly settings: GuestSettings; readonly capture: SourceCapture };

/** Reads the requested paths in order and refuses the patch as soon as its cumulative byte limit is exceeded. */
export const captureSource = Effect.fn('captureSource')(function* ({
  settings,
  capture,
}: CaptureSourceInput): Effect.fn.Return<SourceChanges, SourceGuestFailed> {
  const { sourceId, paths } = capture;
  const folder = yield* sourceFolder({ settings, capture });
  const initial: SourcePatch = { changes: [], bytes: Bytes.make(0) };

  const read: (patch: SourcePatch, path: string) => Effect.Effect<SourcePatch, SourceGuestFailed> = (patch, path) =>
    readSourcePatch({ patch, path, sourceId, folder });

  const patch = yield* Effect.reduce(paths, () => initial, read);

  return patch.changes;
});

/** Both the checkout and its parent must remain directories after the guest has been quiesced. */
const sourceFolder = Effect.fn('sourceFolder')(function* ({
  settings,
  capture,
}: CaptureSourceInput): Effect.fn.Return<string, SourceGuestFailed> {
  const { sourceId } = capture;
  const parent = join(settings.home, 'sources');
  const folder = join(parent, sourceId);

  for (const path of [parent, folder]) {
    const stat = yield* Effect.tryPromise({
      try: () => lstat(path),
      catch: () => new SourceGuestFailed({ sourceId, reason: 'source checkout is unavailable' }),
    });

    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return yield* new SourceGuestFailed({ sourceId, reason: 'source checkout is not a regular directory' });
    }
  }

  return folder;
});
