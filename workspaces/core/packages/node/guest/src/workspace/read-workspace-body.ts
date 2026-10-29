import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import { Bytes } from '@mechane/records';
import { Effect } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import { readGuestBody } from '../read-guest-body.ts';
import type { WorkspaceRequest } from '../types.ts';

/** Reads a workspace request without buffering more than one protocol part. */
export const readWorkspaceBody = Effect.fn('readWorkspaceBody')(function* ({
  request,
  generation,
  step,
}: WorkspaceRequest): Effect.fn.Return<Buffer, WorkspaceFailed> {
  const maximumBytes = Bytes.make(SANDBOX_ARCHIVE_PART_BYTES);

  return yield* readGuestBody({
    request,
    maximumBytes,
    onLimit: () => new WorkspaceFailed({ generation, step, reason: 'workspace request exceeds its byte limit' }),
    onError: (error) => new WorkspaceFailed({ generation, step, reason: error.message }),
  });
});
